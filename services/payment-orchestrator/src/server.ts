import { createHash, randomBytes, randomUUID } from "node:crypto";
import { createServer, IncomingMessage, ServerResponse } from "node:http";

import {
  DEFAULT_BACKEND_SIGNER_PRIVATE_KEY,
  DEFAULT_PAYMENT_HASH_TTL_SEC,
  DEFAULT_TICKET_LEDGER_ADDRESS,
  DEFAULT_TICKET_LEDGER_CHAIN_ID,
  DEFAULT_WALLET_PREFUND_AMOUNT_WEI,
  type PaymentGateway,
  type PaymentOrchestratorConfig
} from "./config.js";
import {
  buildPurchaseTypedData,
  computePaymentHash,
  deriveAddressFromPrivateKey,
  signPurchaseTypedData,
  type PurchaseTypedData
} from "./ethereum.js";
import { log } from "./logger.js";
import { verifyWebhookSignature } from "./webhook-signature.js";

type PaymentStatus = "pending" | "confirmed" | "failed" | "cancelled";
type WebhookEventStatus = "processed" | "queued_retry" | "rejected";
type PaymentHashLookupStatus =
  | "pending"
  | "ready"
  | "expired"
  | "failed"
  | "cancelled"
  | "unavailable";
type PaymentHashLifecycleStatus = "issued" | "expired";

interface PaymentIntent {
  id: string;
  orderId: string;
  reservationId: string;
  userId: string;
  amount: number;
  currency: "VND";
  gateway: PaymentGateway;
  status: PaymentStatus;
  createdAt: string;
  updatedAt: string;
  gatewayTransactionId?: string;
  eventId?: number;
  ticketTypeId?: number;
  quantity?: number;
  ticketIds: string[];
  buyerWalletAddress?: string;
}

interface PaymentIntentInput {
  orderId?: string;
  reservationId?: string;
  amount?: number;
  currency?: string;
  gateway?: string;
  eventId?: number | string;
  ticketTypeId?: number | string;
  quantity?: number | string;
  ticketIds?: string[];
  buyerWalletAddress?: string;
  buyer?: string;
  walletAddress?: string;
}

interface WalletBootstrapInput {
  walletAddress?: string;
}

interface WebhookPayload {
  eventId?: string;
  paymentId?: string;
  orderId?: string;
  gatewayTransactionId?: string;
  status?: string;
  amount?: number;
  currency?: string;
  rawStatus?: string;
}

interface WebhookEvent {
  id: string;
  gateway: PaymentGateway;
  eventKey: string;
  paymentReference: string;
  payloadDigest: string;
  rawPayload: string;
  status: WebhookEventStatus;
  attemptCount: number;
  createdAt: string;
  updatedAt: string;
  lastError?: string;
}

interface RetryJob {
  id: string;
  eventKey: string;
  gateway: PaymentGateway;
  paymentReference: string;
  attempt: number;
  nextRetryAtMs: number;
  lastError: string;
}

interface WalletBootstrapRecord {
  walletAddress: string;
  userId: string;
  prefundTxHash: string;
  amountWei: string;
  fundedAt: string;
  updatedAt: string;
}

interface PaymentHashRecord {
  orderId: string;
  paymentId: string;
  userId: string;
  amount: number;
  nonce: string;
  paymentHash: string;
  signature: string;
  signerAddress: string;
  status: PaymentHashLifecycleStatus;
  issuedAt: string;
  expiresAt: string;
  eventId: number;
  ticketTypeId: number;
  quantity: number;
  ticketIds: string[];
  buyerWalletAddress: string;
  chainId: number;
  verifyingContract: string;
  typedData: PurchaseTypedData;
}

interface ProcessWebhookResult {
  processed: boolean;
  retriable: boolean;
  error?: string;
  payment?: PaymentIntent;
  paymentHashRecord?: PaymentHashRecord | null;
}

function sendJson(res: ServerResponse, statusCode: number, payload: unknown): void {
  res.statusCode = statusCode;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}

function toIso(ms: number): string {
  return new Date(ms).toISOString();
}

function extractSingleHeader(req: IncomingMessage, headerName: string): string | null {
  const value = req.headers[headerName.toLowerCase()];
  if (!value) {
    return null;
  }

  const normalized = Array.isArray(value) ? value[0] : value;
  const trimmed = normalized?.trim();
  return trimmed ? trimmed : null;
}

function extractUserId(req: IncomingMessage): string | null {
  return extractSingleHeader(req, "x-user-id");
}

function extractIdempotencyKey(req: IncomingMessage): string | null {
  return extractSingleHeader(req, "idempotency-key");
}

function createIdempotencyScope(method: string, path: string, key: string | null): string | null {
  if (!key) {
    return null;
  }

  return `${method}:${path}:${key}`;
}

async function readRawBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];

  for await (const chunk of req) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }

  return Buffer.concat(chunks).toString("utf-8");
}

function parseJson<T>(rawBody: string): T {
  const normalized = rawBody.trim();
  if (!normalized) {
    return {} as T;
  }

  return JSON.parse(normalized) as T;
}

function sha256Hex(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function normalizeStatus(rawStatus: string | undefined): PaymentStatus | null {
  if (!rawStatus) {
    return null;
  }

  const normalized = rawStatus.trim().toLowerCase();
  if (
    normalized === "paid" ||
    normalized === "success" ||
    normalized === "succeeded" ||
    normalized === "confirmed"
  ) {
    return "confirmed";
  }

  if (normalized === "failed" || normalized === "error" || normalized === "declined") {
    return "failed";
  }

  if (normalized === "cancelled" || normalized === "canceled") {
    return "cancelled";
  }

  if (normalized === "pending") {
    return "pending";
  }

  return null;
}

function gatewaySecret(config: PaymentOrchestratorConfig, gateway: PaymentGateway): string {
  return gateway === "momo" ? config.momoWebhookSecret : config.vnpayWebhookSecret;
}

function computeRetryDelayMs(config: PaymentOrchestratorConfig, attempt: number): number {
  const boundedAttempt = Math.max(1, attempt);
  const multiplier = 2 ** Math.min(5, boundedAttempt - 1);
  return config.retryBaseDelaySec * 1000 * multiplier;
}

function parsePositiveInteger(value: number | string | undefined): number | undefined {
  if (typeof value === "number") {
    return Number.isInteger(value) && value > 0 ? value : undefined;
  }

  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim();
  if (!/^[0-9]+$/.test(normalized)) {
    return undefined;
  }

  const parsed = Number(normalized);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : undefined;
}

function normalizeWalletAddress(value: string | null | undefined): string | undefined {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) {
    return undefined;
  }

  return /^0x[0-9a-f]{40}$/.test(normalized) ? normalized : undefined;
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values));
}

function normalizeTicketIds(value: string[] | undefined): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return uniqueStrings(
    value
      .map((ticketId) => (typeof ticketId === "string" ? ticketId.trim() : ""))
      .filter((ticketId) => ticketId.length > 0)
  );
}

function buildDefaultTicketIds(reservationId: string, quantity: number | undefined): string[] {
  const normalizedReservationId = reservationId.trim();
  if (!normalizedReservationId) {
    return [];
  }

  const count = quantity && quantity > 1 ? quantity : 1;
  if (count === 1) {
    return [normalizedReservationId];
  }

  return Array.from({ length: count }, (_, index) => `${normalizedReservationId}:${index + 1}`);
}

function buildPrefundTxHash(walletAddress: string, fundedAt: string): string {
  return `0x${sha256Hex(`prefund:${walletAddress}:${fundedAt}`)}`;
}

function paymentResponse(payment: PaymentIntent): Record<string, unknown> {
  return {
    paymentId: payment.id,
    orderId: payment.orderId,
    reservationId: payment.reservationId,
    userId: payment.userId,
    amount: payment.amount,
    currency: payment.currency,
    gateway: payment.gateway,
    status: payment.status,
    gatewayTransactionId: payment.gatewayTransactionId,
    eventId: payment.eventId,
    ticketTypeId: payment.ticketTypeId,
    quantity: payment.quantity,
    ticketIds: payment.ticketIds,
    buyerWalletAddress: payment.buyerWalletAddress,
    createdAt: payment.createdAt,
    updatedAt: payment.updatedAt
  };
}

function resolveHashLookupStatus(
  payment: PaymentIntent,
  paymentHashRecord: PaymentHashRecord | null
): PaymentHashLookupStatus {
  if (payment.status === "failed") {
    return "failed";
  }

  if (payment.status === "cancelled") {
    return "cancelled";
  }

  if (payment.status !== "confirmed") {
    return "pending";
  }

  if (!paymentHashRecord) {
    return "unavailable";
  }

  return paymentHashRecord.status === "expired" ? "expired" : "ready";
}

function resolveWebhookGateway(req: IncomingMessage, url: URL): PaymentGateway | null {
  const directMatch = /^\/webhooks\/(momo|vnpay)$/.exec(url.pathname);
  if (directMatch) {
    return directMatch[1] as PaymentGateway;
  }

  if (url.pathname !== "/webhook/payment" && url.pathname !== "/webhook/payment/") {
    return null;
  }

  const rawGateway =
    extractSingleHeader(req, "x-payment-gateway") ??
    url.searchParams.get("gateway")?.trim().toLowerCase() ??
    null;

  return rawGateway === "momo" || rawGateway === "vnpay" ? rawGateway : null;
}

export function createPaymentOrchestratorServer(config: PaymentOrchestratorConfig) {
  const castBinaryPath = config.castBinaryPath ?? "cast";
  const paymentHashTtlSec = config.paymentHashTtlSec ?? DEFAULT_PAYMENT_HASH_TTL_SEC;
  const backendSignerPrivateKey =
    config.backendSignerPrivateKey ?? DEFAULT_BACKEND_SIGNER_PRIVATE_KEY;
  const ticketLedgerChainId = config.ticketLedgerChainId ?? DEFAULT_TICKET_LEDGER_CHAIN_ID;
  const ticketLedgerAddress = normalizeWalletAddress(
    config.ticketLedgerAddress ?? DEFAULT_TICKET_LEDGER_ADDRESS
  );
  const prefundAmountWei = config.prefundAmountWei ?? DEFAULT_WALLET_PREFUND_AMOUNT_WEI;

  if (!ticketLedgerAddress) {
    throw new Error("Invalid TICKET_LEDGER_ADDRESS configuration");
  }

  const paymentsById = new Map<string, PaymentIntent>();
  const paymentIdByOrderId = new Map<string, string>();
  const webhookEventsByKey = new Map<string, WebhookEvent>();
  const retryJobsById = new Map<string, RetryJob>();
  const idempotencyResponses = new Map<string, unknown>();
  const nonceExpiryByValue = new Map<string, number>();
  const walletPrefundsByAddress = new Map<string, WalletBootstrapRecord>();
  const walletAddressByUserId = new Map<string, string>();
  const paymentHashesByOrderId = new Map<string, PaymentHashRecord>();

  let backendSignerAddress: string | null = null;

  const getBackendSignerAddress = (): string => {
    if (!backendSignerAddress) {
      backendSignerAddress = deriveAddressFromPrivateKey(backendSignerPrivateKey, castBinaryPath);
    }

    return backendSignerAddress;
  };

  const refreshPaymentHashRecord = (
    record: PaymentHashRecord | null,
    nowMs = Date.now()
  ): PaymentHashRecord | null => {
    if (!record) {
      return null;
    }

    if (record.status !== "expired" && new Date(record.expiresAt).getTime() <= nowMs) {
      record.status = "expired";
    }

    return record;
  };

  const cleanupTimer = setInterval(() => {
    const now = Date.now();

    for (const [nonce, expiresAtMs] of nonceExpiryByValue.entries()) {
      if (expiresAtMs <= now) {
        nonceExpiryByValue.delete(nonce);
      }
    }

    for (const record of paymentHashesByOrderId.values()) {
      refreshPaymentHashRecord(record, now);
    }
  }, 60_000);

  const findPaymentByReference = (reference: string): PaymentIntent | null => {
    const normalizedReference = reference.trim();
    if (!normalizedReference) {
      return null;
    }

    const direct = paymentsById.get(normalizedReference);
    if (direct) {
      return direct;
    }

    const paymentId = paymentIdByOrderId.get(normalizedReference);
    return paymentId ? (paymentsById.get(paymentId) ?? null) : null;
  };

  const findRetryJobByEventKey = (eventKey: string): RetryJob | null => {
    for (const retryJob of retryJobsById.values()) {
      if (retryJob.eventKey === eventKey) {
        return retryJob;
      }
    }

    return null;
  };

  const ensureIssuanceContext = (payment: PaymentIntent): void => {
    const userWalletAddress = walletAddressByUserId.get(payment.userId);
    const buyerWalletAddress =
      normalizeWalletAddress(payment.buyerWalletAddress) ?? userWalletAddress;
    if (buyerWalletAddress) {
      payment.buyerWalletAddress = buyerWalletAddress;
    }

    if (payment.ticketIds.length === 0) {
      payment.ticketIds = buildDefaultTicketIds(payment.reservationId, payment.quantity);
    }

    if (!payment.quantity && payment.ticketIds.length > 0) {
      payment.quantity = payment.ticketIds.length;
    }
  };

  const canIssuePaymentHash = (
    payment: PaymentIntent
  ): payment is PaymentIntent & {
    eventId: number;
    ticketTypeId: number;
    quantity: number;
    buyerWalletAddress: string;
  } => {
    ensureIssuanceContext(payment);

    return (
      payment.status === "confirmed" &&
      typeof payment.eventId === "number" &&
      payment.eventId > 0 &&
      typeof payment.ticketTypeId === "number" &&
      payment.ticketTypeId > 0 &&
      typeof payment.quantity === "number" &&
      payment.quantity > 0 &&
      typeof payment.buyerWalletAddress === "string" &&
      payment.buyerWalletAddress.length > 0 &&
      payment.ticketIds.length > 0
    );
  };

  const issuePaymentHashIfReady = (
    payment: PaymentIntent,
    nowMs = Date.now()
  ): PaymentHashRecord | null => {
    const existing = refreshPaymentHashRecord(
      paymentHashesByOrderId.get(payment.orderId) ?? null,
      nowMs
    );
    if (existing) {
      return existing;
    }

    if (!canIssuePaymentHash(payment)) {
      return null;
    }

    const nonce = `0x${randomBytes(32).toString("hex")}`;
    const paymentHash = computePaymentHash({
      castBinaryPath,
      orderId: payment.orderId,
      userId: payment.userId,
      ticketIds: payment.ticketIds,
      amount: BigInt(Math.trunc(payment.amount)),
      nonce
    });
    const typedData = buildPurchaseTypedData({
      chainId: ticketLedgerChainId,
      verifyingContract: ticketLedgerAddress,
      eventId: payment.eventId,
      ticketTypeId: payment.ticketTypeId,
      quantity: payment.quantity,
      paymentHash,
      buyer: payment.buyerWalletAddress
    });
    const signature = signPurchaseTypedData({
      castBinaryPath,
      privateKey: backendSignerPrivateKey,
      typedData
    });
    const issuedAt = toIso(nowMs);
    const expiresAt = toIso(nowMs + paymentHashTtlSec * 1000);
    const record: PaymentHashRecord = {
      orderId: payment.orderId,
      paymentId: payment.id,
      userId: payment.userId,
      amount: payment.amount,
      nonce,
      paymentHash,
      signature,
      signerAddress: getBackendSignerAddress(),
      status: "issued",
      issuedAt,
      expiresAt,
      eventId: payment.eventId,
      ticketTypeId: payment.ticketTypeId,
      quantity: payment.quantity,
      ticketIds: [...payment.ticketIds],
      buyerWalletAddress: payment.buyerWalletAddress,
      chainId: ticketLedgerChainId,
      verifyingContract: ticketLedgerAddress,
      typedData
    };

    paymentHashesByOrderId.set(payment.orderId, record);
    return record;
  };

  const buildPaymentHashResponse = (payment: PaymentIntent): Record<string, unknown> => {
    const paymentHashRecord = issuePaymentHashIfReady(payment);
    const refreshedRecord = refreshPaymentHashRecord(paymentHashRecord);
    const lookupStatus = resolveHashLookupStatus(payment, refreshedRecord);

    return {
      orderId: payment.orderId,
      paymentId: payment.id,
      paymentStatus: payment.status,
      status: lookupStatus,
      paymentHash: refreshedRecord?.paymentHash ?? null,
      signature: refreshedRecord?.signature ?? null,
      nonce: refreshedRecord?.nonce ?? null,
      signerAddress: refreshedRecord?.signerAddress ?? null,
      buyer: refreshedRecord?.buyerWalletAddress ?? payment.buyerWalletAddress ?? null,
      eventId: refreshedRecord?.eventId ?? payment.eventId ?? null,
      ticketTypeId: refreshedRecord?.ticketTypeId ?? payment.ticketTypeId ?? null,
      quantity: refreshedRecord?.quantity ?? payment.quantity ?? null,
      amount: refreshedRecord?.amount ?? payment.amount,
      ticketIds: refreshedRecord?.ticketIds ?? payment.ticketIds,
      domain:
        refreshedRecord === null
          ? null
          : {
              name: refreshedRecord.typedData.domain.name,
              version: refreshedRecord.typedData.domain.version,
              chainId: refreshedRecord.chainId,
              verifyingContract: refreshedRecord.verifyingContract
            },
      issuedAt: refreshedRecord?.issuedAt ?? null,
      expiresAt: refreshedRecord?.expiresAt ?? null,
      reason: lookupStatus === "unavailable" ? "PAYMENT_HASH_CONTEXT_INCOMPLETE" : null
    };
  };

  const enqueueRetry = (
    event: WebhookEvent,
    gateway: PaymentGateway,
    paymentReference: string,
    attempt: number,
    lastError: string
  ): RetryJob => {
    const existing = findRetryJobByEventKey(event.eventKey);
    const nextRetryAtMs = Date.now() + computeRetryDelayMs(config, attempt);

    if (existing) {
      existing.attempt = attempt;
      existing.nextRetryAtMs = nextRetryAtMs;
      existing.lastError = lastError;
      return existing;
    }

    const job: RetryJob = {
      id: `retry_${randomUUID().replace(/-/g, "")}`,
      eventKey: event.eventKey,
      gateway,
      paymentReference,
      attempt,
      nextRetryAtMs,
      lastError
    };

    retryJobsById.set(job.id, job);
    return job;
  };

  const processWebhookPayload = (
    event: WebhookEvent,
    payload: WebhookPayload
  ): ProcessWebhookResult => {
    const nowIso = new Date().toISOString();
    const payment = findPaymentByReference(event.paymentReference);

    if (!payment) {
      event.status = "queued_retry";
      event.lastError = "PAYMENT_NOT_FOUND";
      event.updatedAt = nowIso;
      return {
        processed: false,
        retriable: true,
        error: "PAYMENT_NOT_FOUND"
      };
    }

    if (typeof payload.amount === "number" && payload.amount !== payment.amount) {
      event.status = "rejected";
      event.lastError = "AMOUNT_MISMATCH";
      event.updatedAt = nowIso;
      return {
        processed: false,
        retriable: false,
        error: "AMOUNT_MISMATCH"
      };
    }

    if (payload.currency && payload.currency !== payment.currency) {
      event.status = "rejected";
      event.lastError = "CURRENCY_MISMATCH";
      event.updatedAt = nowIso;
      return {
        processed: false,
        retriable: false,
        error: "CURRENCY_MISMATCH"
      };
    }

    const normalizedStatus = normalizeStatus(payload.status ?? payload.rawStatus);
    if (!normalizedStatus) {
      event.status = "rejected";
      event.lastError = "INVALID_PAYMENT_STATUS";
      event.updatedAt = nowIso;
      return {
        processed: false,
        retriable: false,
        error: "INVALID_PAYMENT_STATUS"
      };
    }

    payment.status = normalizedStatus;
    payment.updatedAt = nowIso;

    if (payload.gatewayTransactionId) {
      payment.gatewayTransactionId = payload.gatewayTransactionId;
    }

    let paymentHashRecord: PaymentHashRecord | null = null;
    if (payment.status === "confirmed") {
      try {
        paymentHashRecord = issuePaymentHashIfReady(payment);
      } catch (error) {
        log(config.serviceName, "error", "Failed to issue payment hash", {
          paymentId: payment.id,
          orderId: payment.orderId,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    event.status = "processed";
    event.lastError = undefined;
    event.updatedAt = nowIso;

    return {
      processed: true,
      retriable: false,
      payment,
      paymentHashRecord
    };
  };

  const server = createServer(async (req, res) => {
    try {
      const method = req.method ?? "GET";
      const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);

      if (method === "GET" && url.pathname === "/healthz") {
        return sendJson(res, 200, {
          success: true,
          data: {
            service: config.serviceName,
            status: "ok",
            timestamp: new Date().toISOString(),
            paymentCount: paymentsById.size,
            pendingRetryCount: retryJobsById.size,
            issuedPaymentHashCount: paymentHashesByOrderId.size,
            prefundedWalletCount: walletPrefundsByAddress.size
          }
        });
      }

      if (
        method === "POST" &&
        (url.pathname === "/wallet/register" || url.pathname === "/api/wallet/register")
      ) {
        const userId = extractUserId(req);
        if (!userId) {
          return sendJson(res, 401, {
            success: false,
            error: {
              code: "UNAUTHORIZED",
              message: "Missing x-user-id header"
            }
          });
        }

        const rawBody = await readRawBody(req);
        let body: WalletBootstrapInput;
        try {
          body = parseJson<WalletBootstrapInput>(rawBody);
        } catch {
          return sendJson(res, 400, {
            success: false,
            error: {
              code: "INVALID_JSON",
              message: "Request body must be valid JSON"
            }
          });
        }

        const walletAddress = normalizeWalletAddress(body.walletAddress);
        if (!walletAddress) {
          return sendJson(res, 400, {
            success: false,
            error: {
              code: "INVALID_WALLET_ADDRESS",
              message: "walletAddress must be a valid EVM address"
            }
          });
        }

        const existing = walletPrefundsByAddress.get(walletAddress);
        if (existing && existing.userId !== userId) {
          return sendJson(res, 409, {
            success: false,
            error: {
              code: "WALLET_ALREADY_REGISTERED",
              message: "Wallet address is already registered to another user"
            }
          });
        }

        if (existing) {
          walletAddressByUserId.set(userId, walletAddress);
          return sendJson(res, 200, {
            success: true,
            data: {
              walletAddress,
              prefunded: true,
              prefundTxHash: existing.prefundTxHash,
              amountWei: existing.amountWei,
              fundedAt: existing.fundedAt
            }
          });
        }

        const fundedAt = new Date().toISOString();
        const record: WalletBootstrapRecord = {
          walletAddress,
          userId,
          prefundTxHash: buildPrefundTxHash(walletAddress, fundedAt),
          amountWei: prefundAmountWei,
          fundedAt,
          updatedAt: fundedAt
        };

        walletPrefundsByAddress.set(walletAddress, record);
        walletAddressByUserId.set(userId, walletAddress);

        return sendJson(res, 200, {
          success: true,
          data: {
            walletAddress,
            prefunded: true,
            prefundTxHash: record.prefundTxHash,
            amountWei: record.amountWei,
            fundedAt: record.fundedAt
          }
        });
      }

      const walletPrefundMatch = /^\/(?:api\/)?wallet\/prefund\/([^/]+)$/.exec(url.pathname);
      if (method === "GET" && walletPrefundMatch) {
        const walletAddress = normalizeWalletAddress(decodeURIComponent(walletPrefundMatch[1]));
        if (!walletAddress) {
          return sendJson(res, 400, {
            success: false,
            error: {
              code: "INVALID_WALLET_ADDRESS",
              message: "walletAddress must be a valid EVM address"
            }
          });
        }

        const record = walletPrefundsByAddress.get(walletAddress);
        return sendJson(res, 200, {
          success: true,
          data: {
            walletAddress,
            funded: Boolean(record),
            txHash: record?.prefundTxHash ?? null,
            amountWei: record?.amountWei ?? null,
            fundedAt: record?.fundedAt ?? null
          }
        });
      }

      if (
        method === "POST" &&
        (url.pathname === "/payments/intents" || url.pathname === "/api/payment/initiate")
      ) {
        const userId = extractUserId(req);
        if (!userId) {
          return sendJson(res, 401, {
            success: false,
            error: {
              code: "UNAUTHORIZED",
              message: "Missing x-user-id header"
            }
          });
        }

        const idempotencyScope = createIdempotencyScope(
          method,
          url.pathname,
          extractIdempotencyKey(req)
        );
        if (idempotencyScope && idempotencyResponses.has(idempotencyScope)) {
          return sendJson(res, 200, idempotencyResponses.get(idempotencyScope));
        }

        const rawBody = await readRawBody(req);
        let body: PaymentIntentInput;
        try {
          body = parseJson<PaymentIntentInput>(rawBody);
        } catch {
          return sendJson(res, 400, {
            success: false,
            error: {
              code: "INVALID_JSON",
              message: "Request body must be valid JSON"
            }
          });
        }

        const reservationId = body.reservationId?.trim() || `res_${randomUUID().replace(/-/g, "")}`;
        const amount = body.amount;
        const currency = (body.currency ?? "VND").trim().toUpperCase();
        const gateway = body.gateway?.trim().toLowerCase() as PaymentGateway | undefined;
        const eventId = parsePositiveInteger(body.eventId);
        const ticketTypeId = parsePositiveInteger(body.ticketTypeId);
        const quantity = parsePositiveInteger(body.quantity);
        const buyerWalletAddress = normalizeWalletAddress(
          body.buyerWalletAddress ?? body.buyer ?? body.walletAddress
        );
        const orderId = body.orderId?.trim() || `ord_${randomUUID().replace(/-/g, "")}`;
        const ticketIds = normalizeTicketIds(body.ticketIds);

        if (typeof amount !== "number" || !Number.isInteger(amount) || amount <= 0) {
          return sendJson(res, 400, {
            success: false,
            error: {
              code: "INVALID_PAYMENT_INTENT_PAYLOAD",
              message: "amount must be a positive integer"
            }
          });
        }

        if (currency !== "VND") {
          return sendJson(res, 400, {
            success: false,
            error: {
              code: "UNSUPPORTED_CURRENCY",
              message: "Only VND is supported"
            }
          });
        }

        if (!gateway || !config.allowedGateways.includes(gateway)) {
          return sendJson(res, 400, {
            success: false,
            error: {
              code: "UNSUPPORTED_GATEWAY",
              message: `Gateway must be one of: ${config.allowedGateways.join(", ")}`
            }
          });
        }

        if (paymentIdByOrderId.has(orderId)) {
          return sendJson(res, 409, {
            success: false,
            error: {
              code: "ORDER_ID_ALREADY_EXISTS",
              message: "orderId already exists"
            }
          });
        }

        const now = new Date().toISOString();
        const payment: PaymentIntent = {
          id: `pay_${randomUUID().replace(/-/g, "")}`,
          orderId,
          reservationId,
          userId,
          amount,
          currency: "VND",
          gateway,
          status: "pending",
          createdAt: now,
          updatedAt: now,
          eventId,
          ticketTypeId,
          quantity,
          ticketIds:
            ticketIds.length > 0 ? ticketIds : buildDefaultTicketIds(reservationId, quantity),
          buyerWalletAddress: buyerWalletAddress ?? walletAddressByUserId.get(userId)
        };

        paymentsById.set(payment.id, payment);
        paymentIdByOrderId.set(payment.orderId, payment.id);

        const response = {
          success: true,
          data: {
            ...paymentResponse(payment),
            paymentUrl: `https://sandbox-${gateway}.example/pay/${payment.id}`
          }
        };

        if (idempotencyScope) {
          idempotencyResponses.set(idempotencyScope, response);
        }

        return sendJson(res, 200, response);
      }

      if (method === "GET" && url.pathname === "/payments/reconciliation/jobs") {
        const jobs = Array.from(retryJobsById.values())
          .sort((left, right) => left.nextRetryAtMs - right.nextRetryAtMs)
          .map((job) => ({
            retryJobId: job.id,
            eventKey: job.eventKey,
            paymentReference: job.paymentReference,
            gateway: job.gateway,
            attempt: job.attempt,
            nextRetryAt: toIso(job.nextRetryAtMs),
            lastError: job.lastError
          }));

        return sendJson(res, 200, {
          success: true,
          data: jobs
        });
      }

      if (method === "POST" && url.pathname === "/payments/reconciliation/run") {
        const idempotencyScope = createIdempotencyScope(
          method,
          url.pathname,
          extractIdempotencyKey(req)
        );
        if (idempotencyScope && idempotencyResponses.has(idempotencyScope)) {
          return sendJson(res, 200, idempotencyResponses.get(idempotencyScope));
        }

        const nowMs = Date.now();
        let processedCount = 0;
        let requeuedCount = 0;
        let deadLetterCount = 0;

        const dueJobs = Array.from(retryJobsById.values())
          .filter((job) => job.nextRetryAtMs <= nowMs)
          .sort((left, right) => left.nextRetryAtMs - right.nextRetryAtMs);

        for (const job of dueJobs) {
          const event = webhookEventsByKey.get(job.eventKey);
          if (!event) {
            retryJobsById.delete(job.id);
            deadLetterCount += 1;
            continue;
          }

          event.attemptCount += 1;

          const payload = parseJson<WebhookPayload>(event.rawPayload);
          const result = processWebhookPayload(event, payload);

          if (result.processed) {
            retryJobsById.delete(job.id);
            processedCount += 1;
            continue;
          }

          if (!result.retriable) {
            retryJobsById.delete(job.id);
            deadLetterCount += 1;
            continue;
          }

          if (job.attempt >= config.maxWebhookRetries) {
            event.status = "rejected";
            event.lastError = `MAX_RETRY_EXCEEDED:${result.error ?? "UNKNOWN"}`;
            event.updatedAt = new Date().toISOString();
            retryJobsById.delete(job.id);
            deadLetterCount += 1;
            continue;
          }

          const nextAttempt = job.attempt + 1;
          const nextRetryAtMs = nowMs + computeRetryDelayMs(config, nextAttempt);

          job.attempt = nextAttempt;
          job.nextRetryAtMs = nextRetryAtMs;
          job.lastError = result.error ?? "UNKNOWN_RETRY_ERROR";
          requeuedCount += 1;
        }

        const response = {
          success: true,
          data: {
            processed: processedCount,
            requeued: requeuedCount,
            deadLettered: deadLetterCount,
            remaining: retryJobsById.size
          }
        };

        if (idempotencyScope) {
          idempotencyResponses.set(idempotencyScope, response);
        }

        return sendJson(res, 200, response);
      }

      const paymentHashMatch = /^\/(?:payments\/hash|api\/payment\/hash)\/([^/]+)$/.exec(
        url.pathname
      );
      if (method === "GET" && paymentHashMatch) {
        const paymentReference = decodeURIComponent(paymentHashMatch[1]);
        const payment = findPaymentByReference(paymentReference);

        if (!payment) {
          return sendJson(res, 404, {
            success: false,
            error: {
              code: "PAYMENT_NOT_FOUND",
              message: "Payment intent not found"
            }
          });
        }

        return sendJson(res, 200, {
          success: true,
          data: buildPaymentHashResponse(payment)
        });
      }

      const paymentIdMatch = /^\/payments\/([^/]+)$/.exec(url.pathname);
      if (method === "GET" && paymentIdMatch) {
        const payment = paymentsById.get(paymentIdMatch[1]);

        if (!payment) {
          return sendJson(res, 404, {
            success: false,
            error: {
              code: "PAYMENT_NOT_FOUND",
              message: "Payment intent not found"
            }
          });
        }

        return sendJson(res, 200, {
          success: true,
          data: paymentResponse(payment)
        });
      }

      const webhookGateway = resolveWebhookGateway(req, url);
      if (method === "POST" && webhookGateway) {
        const rawBody = await readRawBody(req);

        const verification = verifyWebhookSignature({
          signature: extractSingleHeader(req, "x-webhook-signature"),
          timestampHeader: extractSingleHeader(req, "x-webhook-timestamp"),
          nonce: extractSingleHeader(req, "x-webhook-nonce"),
          rawBody,
          secret: gatewaySecret(config, webhookGateway),
          nonceExpiryByValue,
          webhookMaxSkewSec: config.webhookMaxSkewSec,
          webhookNonceTtlSec: config.webhookNonceTtlSec
        });

        if (!verification.ok) {
          return sendJson(res, 401, {
            success: false,
            error: {
              code: verification.code,
              message: verification.message
            }
          });
        }

        let payload: WebhookPayload;
        try {
          payload = parseJson<WebhookPayload>(rawBody);
        } catch {
          return sendJson(res, 400, {
            success: false,
            error: {
              code: "INVALID_JSON",
              message: "Webhook payload must be valid JSON"
            }
          });
        }

        const paymentReference = payload.paymentId?.trim() || payload.orderId?.trim() || "";
        if (!paymentReference) {
          return sendJson(res, 400, {
            success: false,
            error: {
              code: "INVALID_WEBHOOK_PAYLOAD",
              message: "paymentId or orderId is required"
            }
          });
        }

        const digest = sha256Hex(rawBody);
        const eventSuffix = payload.eventId?.trim() || digest;
        const eventKey = `${webhookGateway}:${eventSuffix}`;

        if (webhookEventsByKey.has(eventKey)) {
          const existingEvent = webhookEventsByKey.get(eventKey) ?? null;
          const existingPayment = findPaymentByReference(paymentReference);
          return sendJson(res, 200, {
            success: true,
            data: {
              eventKey,
              status: "duplicate",
              paymentId: existingPayment?.id ?? null,
              orderId: existingPayment?.orderId ?? null,
              lastProcessedStatus: existingEvent?.status ?? null
            }
          });
        }

        const nowIso = new Date().toISOString();
        const event: WebhookEvent = {
          id: `wbh_${randomUUID().replace(/-/g, "")}`,
          gateway: webhookGateway,
          eventKey,
          paymentReference,
          payloadDigest: digest,
          rawPayload: rawBody,
          status: "processed",
          attemptCount: 1,
          createdAt: nowIso,
          updatedAt: nowIso
        };

        webhookEventsByKey.set(eventKey, event);

        const result = processWebhookPayload(event, payload);

        if (result.processed) {
          return sendJson(res, 200, {
            success: true,
            data: {
              eventKey,
              status: event.status,
              paymentId: result.payment?.id ?? null,
              orderId: result.payment?.orderId ?? null,
              paymentHashIssued: Boolean(result.paymentHashRecord)
            }
          });
        }

        if (result.retriable) {
          const retryJob = enqueueRetry(
            event,
            webhookGateway,
            paymentReference,
            1,
            result.error ?? "UNKNOWN_ERROR"
          );
          return sendJson(res, 202, {
            success: true,
            data: {
              eventKey,
              status: event.status,
              retryJobId: retryJob.id,
              paymentReference,
              nextRetryAt: toIso(retryJob.nextRetryAtMs)
            }
          });
        }

        return sendJson(res, 400, {
          success: false,
          error: {
            code: result.error ?? "WEBHOOK_REJECTED",
            message: "Webhook rejected"
          }
        });
      }

      return sendJson(res, 404, {
        success: false,
        error: {
          code: "NOT_FOUND",
          message: "Route not found"
        }
      });
    } catch (error) {
      log(config.serviceName, "error", "Unhandled request error", {
        error: error instanceof Error ? error.message : String(error)
      });

      return sendJson(res, 500, {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "Internal server error"
        }
      });
    }
  });

  server.on("close", () => {
    clearInterval(cleanupTimer);
  });

  return server;
}
