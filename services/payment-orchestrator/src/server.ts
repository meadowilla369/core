import { createHash, randomBytes, randomUUID } from "node:crypto";
import { createServer, IncomingMessage, ServerResponse } from "node:http";

import { createPostgresPool, queryMany, queryOne } from "@ticket-platform/local-infra";
import type { Pool } from "pg";

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
  hashStringId,
  computePrefundShortfall,
  computePaymentHash,
  deriveAddressFromPrivateKey,
  getNativeBalanceWei,
  sendNativePrefund,
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
type PaymentHashLifecycleStatus = "issued" | "used" | "expired";

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
  buyerWalletAddress?: string;
}

interface PaymentIntentInput {
  orderId?: string;
  reservationId?: string;
  amount?: number;
  currency?: string;
  gateway?: string;
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
  nonce: string;
  paymentHash: string;
  signature: string;
  signerAddress: string;
  status: PaymentHashLifecycleStatus;
  issuedAt: string;
  expiresAt: string;
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

interface PaymentIntentRow {
  id: string;
  order_id: string;
  gateway: PaymentGateway;
  status: PaymentStatus;
  created_at: string | Date;
  updated_at: string | Date;
  gateway_transaction_id: string | null;
  // from JOIN orders:
  reservation_id: string;
  user_id: string;
  amount: number | string;
  currency: "VND";
  buyer_wallet_address: string | null;
}

interface WebhookEventRow {
  id: string;
  gateway: PaymentGateway;
  event_key: string;
  payment_reference: string;
  payload_digest: string;
  raw_payload: string;
  status: WebhookEventStatus;
  attempt_count: number | string;
  created_at: string | Date;
  updated_at: string | Date;
  last_error: string | null;
}

interface RetryJobRow {
  id: string;
  event_key: string;
  attempt: number | string;
  next_retry_at: string | Date;
  last_error: string;
  created_at: string | Date;
  updated_at: string | Date;
}

interface WalletBootstrapRow {
  wallet_address: string;
  user_id: string;
  prefund_tx_hash: string;
  amount_wei: string;
  funded_at: string | Date;
  updated_at: string | Date;
}

interface PaymentHashRow {
  order_id: string;
  nonce: string;
  payment_hash: string;
  signature: string;
  signer_address: string;
  status: PaymentHashLifecycleStatus;
  issued_at: string | Date;
  expires_at: string | Date;
  chain_id: number | string;
  verifying_contract: string;
  typed_data: PurchaseTypedData;
}

interface IdempotencyRow {
  scope: string;
  response: unknown;
  expires_at: string | Date;
}

function sendJson(res: ServerResponse, statusCode: number, payload: unknown): void {
  res.statusCode = statusCode;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}

function toIso(value: string | Date): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
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
  if (["paid", "success", "succeeded", "confirmed"].includes(normalized)) {
    return "confirmed";
  }
  if (["failed", "error", "declined"].includes(normalized)) {
    return "failed";
  }
  if (["cancelled", "canceled"].includes(normalized)) {
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

function mapPayment(row: PaymentIntentRow): PaymentIntent {
  return {
    id: row.id,
    orderId: row.order_id,
    reservationId: row.reservation_id,
    userId: row.user_id,
    amount: Number(row.amount),
    currency: row.currency,
    gateway: row.gateway,
    status: row.status,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
    gatewayTransactionId: row.gateway_transaction_id ?? undefined,
    buyerWalletAddress: row.buyer_wallet_address ?? undefined
  };
}

function mapWebhookEvent(row: WebhookEventRow): WebhookEvent {
  return {
    id: row.id,
    gateway: row.gateway,
    eventKey: row.event_key,
    paymentReference: row.payment_reference,
    payloadDigest: row.payload_digest,
    rawPayload: row.raw_payload,
    status: row.status,
    attemptCount: Number(row.attempt_count),
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
    lastError: row.last_error ?? undefined
  };
}

function mapRetryJob(row: RetryJobRow): RetryJob {
  return {
    id: row.id,
    eventKey: row.event_key,
    attempt: Number(row.attempt),
    nextRetryAtMs: new Date(row.next_retry_at).getTime(),
    lastError: row.last_error
  };
}

function mapWalletBootstrap(row: WalletBootstrapRow): WalletBootstrapRecord {
  return {
    walletAddress: row.wallet_address,
    userId: row.user_id,
    prefundTxHash: row.prefund_tx_hash,
    amountWei: row.amount_wei,
    fundedAt: toIso(row.funded_at),
    updatedAt: toIso(row.updated_at)
  };
}

function mapPaymentHash(row: PaymentHashRow): PaymentHashRecord {
  return {
    orderId: row.order_id,
    nonce: row.nonce,
    paymentHash: row.payment_hash,
    signature: row.signature,
    signerAddress: row.signer_address,
    status: row.status,
    issuedAt: toIso(row.issued_at),
    expiresAt: toIso(row.expires_at),
    chainId: Number(row.chain_id),
    verifyingContract: row.verifying_contract,
    typedData: row.typed_data
  };
}

const PAYMENT_JOIN = `
  SELECT pi.id, pi.order_id, pi.gateway, pi.status, pi.gateway_transaction_id,
         pi.created_at, pi.updated_at,
         o.reservation_id, o.user_id, o.amount, o.currency, o.buyer_wallet_address
  FROM payment_intents pi
  JOIN orders o ON o.id = pi.order_id
`;

async function ensureSchema(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      reservation_id TEXT NOT NULL UNIQUE,
      user_id TEXT NOT NULL,
      amount INTEGER NOT NULL,
      currency TEXT NOT NULL DEFAULT 'VND',
      buyer_wallet_address TEXT,
      status TEXT NOT NULL CHECK (status IN ('pending', 'paid', 'cancelled', 'refunded')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS payment_intents (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL REFERENCES orders(id),
      gateway TEXT NOT NULL CHECK (gateway IN ('momo', 'vnpay')),
      status TEXT NOT NULL CHECK (status IN ('pending', 'confirmed', 'failed', 'cancelled')),
      gateway_transaction_id TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS payment_webhook_events (
      id TEXT PRIMARY KEY,
      gateway TEXT NOT NULL CHECK (gateway IN ('momo', 'vnpay')),
      event_key TEXT NOT NULL UNIQUE,
      payment_reference TEXT NOT NULL,
      payload_digest TEXT NOT NULL,
      raw_payload TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('processed', 'queued_retry', 'rejected')),
      attempt_count INTEGER NOT NULL,
      last_error TEXT,
      created_at TIMESTAMPTZ NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS payment_retry_jobs (
      id TEXT PRIMARY KEY,
      event_key TEXT NOT NULL UNIQUE REFERENCES payment_webhook_events(event_key) ON DELETE CASCADE,
      attempt INTEGER NOT NULL,
      next_retry_at TIMESTAMPTZ NOT NULL,
      last_error TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS payment_idempotency (
      scope TEXT PRIMARY KEY,
      response JSONB NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS payment_wallet_prefunds (
      wallet_address TEXT PRIMARY KEY,
      user_id TEXT NOT NULL UNIQUE,
      prefund_tx_hash TEXT NOT NULL,
      amount_wei TEXT NOT NULL,
      funded_at TIMESTAMPTZ NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS payment_hashes (
      order_id TEXT PRIMARY KEY,
      nonce TEXT NOT NULL,
      payment_hash TEXT NOT NULL,
      signature TEXT NOT NULL,
      signer_address TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('issued', 'used', 'expired')),
      issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      expires_at TIMESTAMPTZ NOT NULL,
      chain_id INTEGER NOT NULL,
      verifying_contract TEXT NOT NULL,
      typed_data JSONB NOT NULL
    );
  `);
}

async function cleanupExpiredState(pool: Pool): Promise<void> {
  await pool.query(`DELETE FROM payment_idempotency WHERE expires_at <= NOW()`);
  await pool.query(
    `UPDATE payment_hashes SET status = 'expired' WHERE status = 'issued' AND expires_at <= NOW()`
  );
}

async function getCachedIdempotency(pool: Pool, scope: string | null): Promise<unknown | null> {
  if (!scope) {
    return null;
  }

  const row = await queryOne<IdempotencyRow>(
    pool,
    `SELECT scope, response, expires_at FROM payment_idempotency WHERE scope = $1 AND expires_at > NOW()`,
    [scope]
  );

  return row?.response ?? null;
}

async function setCachedIdempotency(
  pool: Pool,
  scope: string | null,
  response: unknown
): Promise<void> {
  if (!scope) {
    return;
  }

  await pool.query(
    `
      INSERT INTO payment_idempotency (scope, response, expires_at)
      VALUES ($1, $2::jsonb, NOW() + INTERVAL '24 hours')
      ON CONFLICT (scope) DO UPDATE SET response = EXCLUDED.response, expires_at = EXCLUDED.expires_at
    `,
    [scope, JSON.stringify(response)]
  );
}

async function loadPaymentById(pool: Pool, paymentId: string): Promise<PaymentIntent | null> {
  const row = await queryOne<PaymentIntentRow>(pool, `${PAYMENT_JOIN} WHERE pi.id = $1`, [
    paymentId
  ]);
  return row ? mapPayment(row) : null;
}

async function findPaymentByReference(
  pool: Pool,
  reference: string
): Promise<PaymentIntent | null> {
  const normalizedReference = reference.trim();
  if (!normalizedReference) {
    return null;
  }

  const row = await queryOne<PaymentIntentRow>(
    pool,
    `${PAYMENT_JOIN} WHERE pi.id = $1 OR o.id = $1 LIMIT 1`,
    [normalizedReference]
  );
  return row ? mapPayment(row) : null;
}

async function findRetryJobByEventKey(pool: Pool, eventKey: string): Promise<RetryJob | null> {
  const row = await queryOne<RetryJobRow>(
    pool,
    `SELECT id, event_key, attempt, next_retry_at, last_error, created_at, updated_at
     FROM payment_retry_jobs WHERE event_key = $1`,
    [eventKey]
  );
  return row ? mapRetryJob(row) : null;
}

async function getWalletAddressForUser(pool: Pool, userId: string): Promise<string | undefined> {
  const row = await queryOne<{ wallet_address: string }>(
    pool,
    `SELECT wallet_address FROM payment_wallet_prefunds WHERE user_id = $1`,
    [userId]
  );
  return row?.wallet_address;
}

async function getPaymentHashByOrderId(
  pool: Pool,
  orderId: string
): Promise<PaymentHashRecord | null> {
  const row = await queryOne<PaymentHashRow>(
    pool,
    `SELECT order_id, nonce, payment_hash, signature, signer_address,
            status, issued_at, expires_at, chain_id, verifying_contract, typed_data
     FROM payment_hashes WHERE order_id = $1`,
    [orderId]
  );

  if (!row) {
    return null;
  }

  if (row.status === "issued" && new Date(row.expires_at).getTime() <= Date.now()) {
    await pool.query(`UPDATE payment_hashes SET status = 'expired' WHERE order_id = $1`, [orderId]);
    row.status = "expired";
  }

  return mapPaymentHash(row);
}

export async function createPaymentOrchestratorServer(config: PaymentOrchestratorConfig) {
  const castBinaryPath = config.castBinaryPath ?? "cast";
  const rpcUrl = config.rpcUrl?.trim() ? config.rpcUrl.trim() : undefined;
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

  const pool = createPostgresPool(process.env);
  await ensureSchema(pool);
  await cleanupExpiredState(pool);

  const cleanupTimer = setInterval(() => {
    void cleanupExpiredState(pool).catch((error) => {
      log(config.serviceName, "error", "Failed to cleanup payment persistence state", {
        error: error instanceof Error ? error.message : String(error)
      });
    });
  }, 60_000);

  let backendSignerAddress: string | null = null;
  const getBackendSignerAddress = (): string => {
    if (!backendSignerAddress) {
      backendSignerAddress = deriveAddressFromPrivateKey(backendSignerPrivateKey, castBinaryPath);
    }

    return backendSignerAddress;
  };

  const ensureIssuanceContext = async (payment: PaymentIntent): Promise<void> => {
    if (!normalizeWalletAddress(payment.buyerWalletAddress)) {
      payment.buyerWalletAddress = await getWalletAddressForUser(pool, payment.userId);
    }
  };

  const ensureWalletPrefund = async (
    walletAddress: string
  ): Promise<{
    txHash: string | null;
    amountWei: string;
  }> => {
    if (!rpcUrl) {
      return {
        txHash: null,
        amountWei: prefundAmountWei
      };
    }

    const currentBalanceWei = await getNativeBalanceWei({ rpcUrl, walletAddress });
    const shortfallWei = computePrefundShortfall(prefundAmountWei, currentBalanceWei);
    if (shortfallWei === 0n) {
      return {
        txHash: null,
        amountWei: "0"
      };
    }

    return {
      txHash: sendNativePrefund({
        rpcUrl,
        privateKey: backendSignerPrivateKey,
        walletAddress,
        amountWei: shortfallWei.toString(),
        castBinaryPath
      }),
      amountWei: shortfallWei.toString()
    };
  };

  const canIssuePaymentHash = (payment: PaymentIntent): boolean => {
    return (
      payment.status === "confirmed" &&
      typeof payment.buyerWalletAddress === "string" &&
      payment.buyerWalletAddress.length > 0
    );
  };

  const issuePaymentHashIfReady = async (
    payment: PaymentIntent,
    nowMs = Date.now()
  ): Promise<PaymentHashRecord | null> => {
    const existing = await getPaymentHashByOrderId(pool, payment.orderId);
    if (existing) {
      return existing;
    }

    await ensureIssuanceContext(payment);

    if (!canIssuePaymentHash(payment)) {
      return null;
    }

    const onchainData = await queryOne<{
      onchain_event_id: string | null;
      onchain_ticket_type_id: string | null;
      quantity: number | string;
    }>(
      pool,
      `SELECT e.onchain_event_id, tt.onchain_ticket_type_id, r.quantity
       FROM reservations r
       JOIN ticket_types tt ON tt.id = r.ticket_type_id
       JOIN events e ON e.id = tt.event_id
       WHERE r.id = $1`,
      [payment.reservationId]
    );

    if (
      !onchainData?.onchain_event_id ||
      !onchainData?.onchain_ticket_type_id ||
      !onchainData?.quantity
    ) {
      return null;
    }

    const nonce = `0x${randomBytes(32).toString("hex")}`;
    const paymentHash = computePaymentHash({
      castBinaryPath,
      orderId: payment.orderId,
      userId: payment.userId,
      amount: BigInt(Math.trunc(payment.amount)),
      nonce
    });
    const typedData = buildPurchaseTypedData({
      chainId: ticketLedgerChainId,
      verifyingContract: ticketLedgerAddress,
      eventId: Number(onchainData.onchain_event_id),
      ticketTypeId: Number(onchainData.onchain_ticket_type_id),
      quantity: Number(onchainData.quantity),
      paymentHash,
      buyer: payment.buyerWalletAddress!
    });
    const signature = signPurchaseTypedData({
      castBinaryPath,
      privateKey: backendSignerPrivateKey,
      typedData
    });
    const issuedAt = toIso(new Date(nowMs));
    const expiresAt = toIso(new Date(nowMs + paymentHashTtlSec * 1000));

    await pool.query(
      `INSERT INTO payment_hashes (
         order_id, nonce, payment_hash, signature, signer_address,
         status, issued_at, expires_at, chain_id, verifying_contract, typed_data
       )
       VALUES ($1, $2, $3, $4, $5, 'issued', $6::timestamptz, $7::timestamptz, $8, $9, $10::jsonb)`,
      [
        payment.orderId,
        nonce,
        paymentHash,
        signature,
        getBackendSignerAddress(),
        issuedAt,
        expiresAt,
        ticketLedgerChainId,
        ticketLedgerAddress,
        JSON.stringify(typedData)
      ]
    );

    return await getPaymentHashByOrderId(pool, payment.orderId);
  };

  const buildPaymentHashResponse = async (
    payment: PaymentIntent
  ): Promise<Record<string, unknown>> => {
    const paymentHashRecord = await issuePaymentHashIfReady(payment);
    const lookupStatus = resolveHashLookupStatus(payment, paymentHashRecord);

    const msg = paymentHashRecord?.typedData.message;
    return {
      orderId: payment.orderId,
      paymentId: payment.id,
      paymentStatus: payment.status,
      status: lookupStatus,
      paymentHash: paymentHashRecord?.paymentHash ?? null,
      signature: paymentHashRecord?.signature ?? null,
      nonce: paymentHashRecord?.nonce ?? null,
      signerAddress: paymentHashRecord?.signerAddress ?? null,
      buyer: payment.buyerWalletAddress ?? null,
      eventId: msg ? Number(msg.eventId) : null,
      ticketTypeId: msg ? Number(msg.ticketTypeId) : null,
      quantity: msg ? Number(msg.quantity) : null,
      amount: payment.amount,
      domain:
        paymentHashRecord === null
          ? null
          : {
              name: paymentHashRecord.typedData.domain.name,
              version: paymentHashRecord.typedData.domain.version,
              chainId: paymentHashRecord.chainId,
              verifyingContract: paymentHashRecord.verifyingContract
            },
      issuedAt: paymentHashRecord?.issuedAt ?? null,
      expiresAt: paymentHashRecord?.expiresAt ?? null,
      reason: lookupStatus === "unavailable" ? "PAYMENT_HASH_CONTEXT_INCOMPLETE" : null
    };
  };

  const enqueueRetry = async (
    event: WebhookEvent,
    attempt: number,
    lastError: string
  ): Promise<RetryJob> => {
    const existing = await findRetryJobByEventKey(pool, event.eventKey);
    const nextRetryAtMs = Date.now() + computeRetryDelayMs(config, attempt);

    if (existing) {
      await pool.query(
        `UPDATE payment_retry_jobs
         SET attempt = $2, next_retry_at = $3::timestamptz, last_error = $4, updated_at = NOW()
         WHERE id = $1`,
        [existing.id, attempt, new Date(nextRetryAtMs).toISOString(), lastError]
      );
      return { ...existing, attempt, nextRetryAtMs, lastError };
    }

    const jobId = `retry_${randomUUID().replace(/-/g, "")}`;
    await pool.query(
      `INSERT INTO payment_retry_jobs (id, event_key, attempt, next_retry_at, last_error)
       VALUES ($1, $2, $3, $4::timestamptz, $5)`,
      [jobId, event.eventKey, attempt, new Date(nextRetryAtMs).toISOString(), lastError]
    );

    return { id: jobId, eventKey: event.eventKey, attempt, nextRetryAtMs, lastError };
  };

  const processWebhookPayload = async (
    event: WebhookEvent,
    payload: WebhookPayload
  ): Promise<ProcessWebhookResult> => {
    const nowIso = new Date().toISOString();
    const payment = await findPaymentByReference(pool, event.paymentReference);

    if (!payment) {
      await pool.query(
        `UPDATE payment_webhook_events SET status = 'queued_retry', last_error = $2, updated_at = $3::timestamptz WHERE event_key = $1`,
        [event.eventKey, "PAYMENT_NOT_FOUND", nowIso]
      );
      return { processed: false, retriable: true, error: "PAYMENT_NOT_FOUND" };
    }

    if (typeof payload.amount === "number" && payload.amount !== payment.amount) {
      await pool.query(
        `UPDATE payment_webhook_events SET status = 'rejected', last_error = $2, updated_at = $3::timestamptz WHERE event_key = $1`,
        [event.eventKey, "AMOUNT_MISMATCH", nowIso]
      );
      return { processed: false, retriable: false, error: "AMOUNT_MISMATCH" };
    }

    if (payload.currency && payload.currency !== payment.currency) {
      await pool.query(
        `UPDATE payment_webhook_events SET status = 'rejected', last_error = $2, updated_at = $3::timestamptz WHERE event_key = $1`,
        [event.eventKey, "CURRENCY_MISMATCH", nowIso]
      );
      return { processed: false, retriable: false, error: "CURRENCY_MISMATCH" };
    }

    const normalizedStatus = normalizeStatus(payload.status ?? payload.rawStatus);
    if (!normalizedStatus) {
      await pool.query(
        `UPDATE payment_webhook_events SET status = 'rejected', last_error = $2, updated_at = $3::timestamptz WHERE event_key = $1`,
        [event.eventKey, "INVALID_PAYMENT_STATUS", nowIso]
      );
      return { processed: false, retriable: false, error: "INVALID_PAYMENT_STATUS" };
    }

    await pool.query(
      `UPDATE payment_intents
       SET status = $2, updated_at = $3::timestamptz, gateway_transaction_id = COALESCE($4, gateway_transaction_id)
       WHERE id = $1`,
      [payment.id, normalizedStatus, nowIso, payload.gatewayTransactionId?.trim() || null]
    );

    if (normalizedStatus === "confirmed") {
      await pool.query(
        `UPDATE orders SET status = 'paid', updated_at = $2::timestamptz WHERE id = $1`,
        [payment.orderId, nowIso]
      );
    }

    const updatedPayment = (await loadPaymentById(pool, payment.id)) as PaymentIntent;
    let paymentHashRecord: PaymentHashRecord | null = null;
    if (updatedPayment.status === "confirmed") {
      try {
        paymentHashRecord = await issuePaymentHashIfReady(updatedPayment);
      } catch (error) {
        log(config.serviceName, "error", "Failed to issue payment hash", {
          paymentId: updatedPayment.id,
          orderId: updatedPayment.orderId,
          error: error instanceof Error ? error.message : String(error)
        });
      }

      // Confirm purchase in ticketing-service
      if (updatedPayment.reservationId) {
        const confirmUrl = `${config.ticketingServiceBaseUrl}/tickets/purchase/${updatedPayment.reservationId}/confirm`;
        try {
          await fetch(confirmUrl, {
            method: "POST",
            headers: {
              "content-type": "application/json",
              "x-internal-api-key": config.internalApiKey
            },
            body: JSON.stringify({
              gatewayTransactionId: updatedPayment.gatewayTransactionId,
              status: "confirmed"
            })
          });
        } catch (error) {
          log(config.serviceName, "warn", "Failed to confirm purchase in ticketing-service", {
            reservationId: updatedPayment.reservationId,
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }
    }

    await pool.query(
      `UPDATE payment_webhook_events SET status = 'processed', last_error = NULL, updated_at = $2::timestamptz WHERE event_key = $1`,
      [event.eventKey, nowIso]
    );

    return { processed: true, retriable: false, payment: updatedPayment, paymentHashRecord };
  };

  const server = createServer(async (req, res) => {
    try {
      const method = req.method ?? "GET";
      const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);

      if (method === "GET" && url.pathname === "/healthz") {
        const counts = await queryOne<{
          payment_count: string;
          retry_count: string;
          hash_count: string;
          wallet_count: string;
        }>(
          pool,
          `
            SELECT
              (SELECT COUNT(*)::text FROM payment_intents) AS payment_count,
              (SELECT COUNT(*)::text FROM payment_retry_jobs) AS retry_count,
              (SELECT COUNT(*)::text FROM payment_hashes) AS hash_count,
              (SELECT COUNT(*)::text FROM payment_wallet_prefunds) AS wallet_count
          `
        );

        return sendJson(res, 200, {
          success: true,
          data: {
            service: config.serviceName,
            status: "ok",
            storage: "postgres",
            timestamp: new Date().toISOString(),
            paymentCount: Number(counts?.payment_count ?? 0),
            pendingRetryCount: Number(counts?.retry_count ?? 0),
            issuedPaymentHashCount: Number(counts?.hash_count ?? 0),
            prefundedWalletCount: Number(counts?.wallet_count ?? 0)
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
            error: { code: "UNAUTHORIZED", message: "Missing x-user-id header" }
          });
        }

        const rawBody = await readRawBody(req);
        let body: WalletBootstrapInput;
        try {
          body = parseJson<WalletBootstrapInput>(rawBody);
        } catch {
          return sendJson(res, 400, {
            success: false,
            error: { code: "INVALID_JSON", message: "Request body must be valid JSON" }
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

        const existing = await queryOne<WalletBootstrapRow>(
          pool,
          `
            SELECT wallet_address, user_id, prefund_tx_hash, amount_wei, funded_at, updated_at
            FROM payment_wallet_prefunds
            WHERE wallet_address = $1 OR user_id = $2
            LIMIT 1
          `,
          [walletAddress, userId]
        );

        if (existing && existing.user_id !== userId && existing.wallet_address === walletAddress) {
          return sendJson(res, 409, {
            success: false,
            error: {
              code: "WALLET_ALREADY_REGISTERED",
              message: "Wallet address is already registered to another user"
            }
          });
        }

        if (existing && existing.user_id === userId) {
          const prefund = await ensureWalletPrefund(walletAddress);
          if (prefund.txHash) {
            const repairedAt = new Date().toISOString();
            await pool.query(
              `
                UPDATE payment_wallet_prefunds
                SET prefund_tx_hash = $2, amount_wei = $3, funded_at = $4::timestamptz, updated_at = $4::timestamptz
                WHERE wallet_address = $1
              `,
              [walletAddress, prefund.txHash, prefund.amountWei, repairedAt]
            );
            existing.prefund_tx_hash = prefund.txHash;
            existing.amount_wei = prefund.amountWei;
            existing.funded_at = repairedAt;
            existing.updated_at = repairedAt;
          }

          const record = mapWalletBootstrap(existing);
          return sendJson(res, 200, {
            success: true,
            data: {
              walletAddress: record.walletAddress,
              prefunded: true,
              prefundTxHash: record.prefundTxHash,
              amountWei: record.amountWei,
              fundedAt: record.fundedAt
            }
          });
        }

        const fundedAt = new Date().toISOString();
        const prefund = await ensureWalletPrefund(walletAddress);
        const prefundTxHash = prefund.txHash ?? buildPrefundTxHash(walletAddress, fundedAt);
        await pool.query(
          `
            INSERT INTO payment_wallet_prefunds (
              wallet_address, user_id, prefund_tx_hash, amount_wei, funded_at, updated_at
            )
            VALUES ($1, $2, $3, $4, $5::timestamptz, $5::timestamptz)
          `,
          [walletAddress, userId, prefundTxHash, prefund.amountWei, fundedAt]
        );

        return sendJson(res, 200, {
          success: true,
          data: {
            walletAddress,
            prefunded: true,
            prefundTxHash,
            amountWei: prefund.amountWei,
            fundedAt
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

        const record = await queryOne<WalletBootstrapRow>(
          pool,
          `
            SELECT wallet_address, user_id, prefund_tx_hash, amount_wei, funded_at, updated_at
            FROM payment_wallet_prefunds
            WHERE wallet_address = $1
          `,
          [walletAddress]
        );

        return sendJson(res, 200, {
          success: true,
          data: {
            walletAddress,
            funded: Boolean(record),
            txHash: record?.prefund_tx_hash ?? null,
            amountWei: record?.amount_wei ?? null,
            fundedAt: record ? toIso(record.funded_at) : null
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
            error: { code: "UNAUTHORIZED", message: "Missing x-user-id header" }
          });
        }

        const idempotencyScope = createIdempotencyScope(
          method,
          url.pathname,
          extractIdempotencyKey(req)
        );
        const cached = await getCachedIdempotency(pool, idempotencyScope);
        if (cached) {
          return sendJson(res, 200, cached);
        }

        const rawBody = await readRawBody(req);
        let body: PaymentIntentInput;
        try {
          body = parseJson<PaymentIntentInput>(rawBody);
        } catch {
          return sendJson(res, 400, {
            success: false,
            error: { code: "INVALID_JSON", message: "Request body must be valid JSON" }
          });
        }

        const reservationId = body.reservationId?.trim() || `res_${randomUUID().replace(/-/g, "")}`;
        const amount = body.amount;
        const currency = (body.currency ?? "VND").trim().toUpperCase();
        const gateway = body.gateway?.trim().toLowerCase() as PaymentGateway | undefined;
        const buyerWalletAddress = normalizeWalletAddress(
          body.buyerWalletAddress ?? body.buyer ?? body.walletAddress
        );
        const orderId = body.orderId?.trim() || `ord_${randomUUID().replace(/-/g, "")}`;

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
            error: { code: "UNSUPPORTED_CURRENCY", message: "Only VND is supported" }
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

        const existingOrder = await queryOne<{ id: string }>(
          pool,
          `SELECT id FROM orders WHERE id = $1`,
          [orderId]
        );
        if (existingOrder) {
          return sendJson(res, 409, {
            success: false,
            error: { code: "ORDER_ID_ALREADY_EXISTS", message: "orderId already exists" }
          });
        }

        const resolvedWallet = buyerWalletAddress ?? (await getWalletAddressForUser(pool, userId));
        const paymentId = `pay_${randomUUID().replace(/-/g, "")}`;

        await pool.query(
          `INSERT INTO orders (id, reservation_id, user_id, amount, currency, buyer_wallet_address, status)
           VALUES ($1, $2, $3, $4, $5, $6, 'pending')`,
          [orderId, reservationId, userId, amount, "VND", resolvedWallet ?? null]
        );

        await pool.query(
          `INSERT INTO payment_intents (id, order_id, gateway, status)
           VALUES ($1, $2, $3, 'pending')`,
          [paymentId, orderId, gateway]
        );

        const payment = await loadPaymentById(pool, paymentId);
        if (!payment) throw new Error("PAYMENT_CREATE_FAILED");

        const response = {
          success: true,
          data: {
            ...paymentResponse(payment),
            paymentUrl: `https://sandbox-${gateway}.example/pay/${payment.id}`
          }
        };

        await setCachedIdempotency(pool, idempotencyScope, response);
        return sendJson(res, 200, response);
      }

      if (method === "GET" && url.pathname === "/payments/reconciliation/jobs") {
        const jobs = await queryMany<RetryJobRow>(
          pool,
          `SELECT id, event_key, attempt, next_retry_at, last_error, created_at, updated_at
           FROM payment_retry_jobs ORDER BY next_retry_at ASC`
        );

        return sendJson(res, 200, {
          success: true,
          data: jobs.map((row: RetryJobRow) => ({
            retryJobId: row.id,
            eventKey: row.event_key,
            attempt: Number(row.attempt),
            nextRetryAt: toIso(row.next_retry_at),
            lastError: row.last_error
          }))
        });
      }

      if (method === "POST" && url.pathname === "/payments/reconciliation/run") {
        const idempotencyScope = createIdempotencyScope(
          method,
          url.pathname,
          extractIdempotencyKey(req)
        );
        const cached = await getCachedIdempotency(pool, idempotencyScope);
        if (cached) {
          return sendJson(res, 200, cached);
        }

        const nowMs = Date.now();
        let processedCount = 0;
        let requeuedCount = 0;
        let deadLetterCount = 0;

        const dueJobs = await queryMany<RetryJobRow>(
          pool,
          `SELECT id, event_key, attempt, next_retry_at, last_error, created_at, updated_at
           FROM payment_retry_jobs WHERE next_retry_at <= NOW() ORDER BY next_retry_at ASC`
        );

        for (const jobRow of dueJobs) {
          const job = mapRetryJob(jobRow);
          const eventRow = await queryOne<WebhookEventRow>(
            pool,
            `
              SELECT id, gateway, event_key, payment_reference, payload_digest, raw_payload,
                     status, attempt_count, created_at, updated_at, last_error
              FROM payment_webhook_events
              WHERE event_key = $1
            `,
            [job.eventKey]
          );

          if (!eventRow) {
            await pool.query(`DELETE FROM payment_retry_jobs WHERE id = $1`, [job.id]);
            deadLetterCount += 1;
            continue;
          }

          await pool.query(
            `UPDATE payment_webhook_events SET attempt_count = attempt_count + 1, updated_at = NOW() WHERE event_key = $1`,
            [job.eventKey]
          );

          const event = mapWebhookEvent({
            ...eventRow,
            attempt_count: Number(eventRow.attempt_count) + 1
          });
          const payload = parseJson<WebhookPayload>(event.rawPayload);
          const result = await processWebhookPayload(event, payload);

          if (result.processed) {
            await pool.query(`DELETE FROM payment_retry_jobs WHERE id = $1`, [job.id]);
            processedCount += 1;
            continue;
          }

          if (!result.retriable) {
            await pool.query(`DELETE FROM payment_retry_jobs WHERE id = $1`, [job.id]);
            deadLetterCount += 1;
            continue;
          }

          if (job.attempt >= config.maxWebhookRetries) {
            await pool.query(
              `UPDATE payment_webhook_events SET status = 'rejected', last_error = $2, updated_at = NOW() WHERE event_key = $1`,
              [job.eventKey, `MAX_RETRY_EXCEEDED:${result.error ?? "UNKNOWN"}`]
            );
            await pool.query(`DELETE FROM payment_retry_jobs WHERE id = $1`, [job.id]);
            deadLetterCount += 1;
            continue;
          }

          const nextAttempt = job.attempt + 1;
          const nextRetryAtMs = nowMs + computeRetryDelayMs(config, nextAttempt);
          await pool.query(
            `
              UPDATE payment_retry_jobs
              SET attempt = $2, next_retry_at = $3::timestamptz, last_error = $4, updated_at = NOW()
              WHERE id = $1
            `,
            [
              job.id,
              nextAttempt,
              new Date(nextRetryAtMs).toISOString(),
              result.error ?? "UNKNOWN_RETRY_ERROR"
            ]
          );
          requeuedCount += 1;
        }

        const response = {
          success: true,
          data: {
            processed: processedCount,
            requeued: requeuedCount,
            deadLettered: deadLetterCount,
            remaining: Number(
              (
                await queryOne<{ count: string }>(
                  pool,
                  `SELECT COUNT(*)::text AS count FROM payment_retry_jobs`
                )
              )?.count ?? 0
            )
          }
        };

        await setCachedIdempotency(pool, idempotencyScope, response);
        return sendJson(res, 200, response);
      }

      const paymentHashMatch = /^\/(?:payments\/hash|api\/payment\/hash)\/([^/]+)$/.exec(
        url.pathname
      );
      if (method === "GET" && paymentHashMatch) {
        const paymentReference = decodeURIComponent(paymentHashMatch[1]);
        const payment = await findPaymentByReference(pool, paymentReference);

        if (!payment) {
          return sendJson(res, 404, {
            success: false,
            error: { code: "PAYMENT_NOT_FOUND", message: "Payment intent not found" }
          });
        }

        return sendJson(res, 200, {
          success: true,
          data: await buildPaymentHashResponse(payment)
        });
      }

      const paymentIdMatch = /^\/payments\/([^/]+)$/.exec(url.pathname);
      if (method === "GET" && paymentIdMatch) {
        const payment = await loadPaymentById(pool, paymentIdMatch[1]);

        if (!payment) {
          return sendJson(res, 404, {
            success: false,
            error: { code: "PAYMENT_NOT_FOUND", message: "Payment intent not found" }
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
          nonceExpiryByValue: new Map<string, number>(),
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
            error: { code: "INVALID_JSON", message: "Webhook payload must be valid JSON" }
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

        const existingEvent = await queryOne<WebhookEventRow>(
          pool,
          `
            SELECT id, gateway, event_key, payment_reference, payload_digest, raw_payload,
                   status, attempt_count, created_at, updated_at, last_error
            FROM payment_webhook_events
            WHERE event_key = $1
          `,
          [eventKey]
        );

        if (existingEvent) {
          const existingPayment = await findPaymentByReference(pool, paymentReference);
          return sendJson(res, 200, {
            success: true,
            data: {
              eventKey,
              status: "duplicate",
              paymentId: existingPayment?.id ?? null,
              orderId: existingPayment?.orderId ?? null,
              lastProcessedStatus: existingEvent.status
            }
          });
        }

        const nowIso = new Date().toISOString();
        const eventId = `wbh_${randomUUID().replace(/-/g, "")}`;
        await pool.query(
          `
            INSERT INTO payment_webhook_events (
              id, gateway, event_key, payment_reference, payload_digest, raw_payload,
              status, attempt_count, created_at, updated_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, 'processed', 1, $7::timestamptz, $7::timestamptz)
          `,
          [eventId, webhookGateway, eventKey, paymentReference, digest, rawBody, nowIso]
        );

        const event = mapWebhookEvent({
          id: eventId,
          gateway: webhookGateway,
          event_key: eventKey,
          payment_reference: paymentReference,
          payload_digest: digest,
          raw_payload: rawBody,
          status: "processed",
          attempt_count: 1,
          created_at: nowIso,
          updated_at: nowIso,
          last_error: null
        });

        const result = await processWebhookPayload(event, payload);

        if (result.processed) {
          return sendJson(res, 200, {
            success: true,
            data: {
              eventKey,
              status: "processed",
              paymentId: result.payment?.id ?? null,
              orderId: result.payment?.orderId ?? null,
              paymentHashIssued: Boolean(result.paymentHashRecord)
            }
          });
        }

        if (result.retriable) {
          const retryJob = await enqueueRetry(event, 1, result.error ?? "UNKNOWN_ERROR");
          return sendJson(res, 202, {
            success: true,
            data: {
              eventKey,
              status: "queued_retry",
              retryJobId: retryJob.id,
              paymentReference,
              nextRetryAt: toIso(new Date(retryJob.nextRetryAtMs))
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
        error: { code: "NOT_FOUND", message: "Route not found" }
      });
    } catch (error) {
      log(config.serviceName, "error", "Unhandled request error", {
        error: error instanceof Error ? error.message : String(error)
      });

      return sendJson(res, 500, {
        success: false,
        error: { code: "INTERNAL_ERROR", message: "Internal server error" }
      });
    }
  });

  server.on("close", () => {
    clearInterval(cleanupTimer);
    void pool.end();
  });

  return server;
}
