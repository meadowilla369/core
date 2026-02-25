import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { createServer, IncomingMessage, ServerResponse } from "node:http";

import type { PaymentGateway, PaymentOrchestratorConfig } from "./config.js";
import { log } from "./logger.js";

type PaymentStatus = "pending" | "confirmed" | "failed" | "cancelled";
type WebhookEventStatus = "processed" | "queued_retry" | "rejected";

interface PaymentIntent {
  id: string;
  reservationId: string;
  userId: string;
  amount: number;
  currency: "VND";
  gateway: PaymentGateway;
  status: PaymentStatus;
  createdAt: string;
  updatedAt: string;
  gatewayTransactionId?: string;
}

interface PaymentIntentInput {
  reservationId?: string;
  amount?: number;
  currency?: string;
  gateway?: string;
}

interface WebhookPayload {
  eventId?: string;
  paymentId?: string;
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
  paymentId: string;
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
  paymentId: string;
  attempt: number;
  nextRetryAtMs: number;
  lastError: string;
}

interface VerificationResult {
  ok: boolean;
  code?: string;
  message?: string;
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
  if (normalized === "paid" || normalized === "success" || normalized === "succeeded" || normalized === "confirmed") {
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

function parseTimestampMs(rawTimestamp: string): number | null {
  const parsed = Number(rawTimestamp);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }

  if (parsed > 1_000_000_000_000) {
    return Math.floor(parsed);
  }

  return Math.floor(parsed * 1000);
}

function safeHexEqual(left: string, right: string): boolean {
  try {
    const leftBuffer = Buffer.from(left, "hex");
    const rightBuffer = Buffer.from(right, "hex");

    if (leftBuffer.length === 0 || rightBuffer.length === 0 || leftBuffer.length !== rightBuffer.length) {
      return false;
    }

    return timingSafeEqual(leftBuffer, rightBuffer);
  } catch {
    return false;
  }
}

function verifyWebhookSignature(
  req: IncomingMessage,
  rawBody: string,
  secret: string,
  nonceExpiryByValue: Map<string, number>,
  config: PaymentOrchestratorConfig
): VerificationResult {
  const signature = extractSingleHeader(req, "x-webhook-signature");
  const timestampHeader = extractSingleHeader(req, "x-webhook-timestamp");
  const nonce = extractSingleHeader(req, "x-webhook-nonce");

  if (!signature || !timestampHeader || !nonce) {
    return {
      ok: false,
      code: "WEBHOOK_SIGNATURE_HEADERS_MISSING",
      message: "x-webhook-signature, x-webhook-timestamp, x-webhook-nonce are required"
    };
  }

  const timestampMs = parseTimestampMs(timestampHeader);
  if (!timestampMs) {
    return {
      ok: false,
      code: "WEBHOOK_INVALID_TIMESTAMP",
      message: "Invalid webhook timestamp"
    };
  }

  const now = Date.now();
  const allowedSkewMs = config.webhookMaxSkewSec * 1000;
  if (Math.abs(now - timestampMs) > allowedSkewMs) {
    return {
      ok: false,
      code: "WEBHOOK_TIMESTAMP_OUT_OF_RANGE",
      message: "Webhook timestamp outside allowed skew"
    };
  }

  const nonceExpiry = nonceExpiryByValue.get(nonce);
  if (nonceExpiry && nonceExpiry > now) {
    return {
      ok: false,
      code: "WEBHOOK_REPLAY_DETECTED",
      message: "Webhook nonce already used"
    };
  }

  const canonicalPayload = `${timestampHeader}.${nonce}.${rawBody}`;
  const expectedSignature = createHmac("sha256", secret).update(canonicalPayload, "utf8").digest("hex");

  if (!safeHexEqual(expectedSignature, signature)) {
    return {
      ok: false,
      code: "WEBHOOK_SIGNATURE_INVALID",
      message: "Webhook signature verification failed"
    };
  }

  nonceExpiryByValue.set(nonce, now + config.webhookNonceTtlSec * 1000);

  return { ok: true };
}

function gatewaySecret(config: PaymentOrchestratorConfig, gateway: PaymentGateway): string {
  return gateway === "momo" ? config.momoWebhookSecret : config.vnpayWebhookSecret;
}

function computeRetryDelayMs(config: PaymentOrchestratorConfig, attempt: number): number {
  const boundedAttempt = Math.max(1, attempt);
  const multiplier = 2 ** Math.min(5, boundedAttempt - 1);
  return config.retryBaseDelaySec * 1000 * multiplier;
}

function paymentResponse(payment: PaymentIntent): Record<string, unknown> {
  return {
    paymentId: payment.id,
    reservationId: payment.reservationId,
    userId: payment.userId,
    amount: payment.amount,
    currency: payment.currency,
    gateway: payment.gateway,
    status: payment.status,
    gatewayTransactionId: payment.gatewayTransactionId,
    createdAt: payment.createdAt,
    updatedAt: payment.updatedAt
  };
}

export function createPaymentOrchestratorServer(config: PaymentOrchestratorConfig) {
  const paymentsById = new Map<string, PaymentIntent>();
  const webhookEventsByKey = new Map<string, WebhookEvent>();
  const retryJobsById = new Map<string, RetryJob>();
  const idempotencyResponses = new Map<string, unknown>();
  const nonceExpiryByValue = new Map<string, number>();

  const cleanupTimer = setInterval(() => {
    const now = Date.now();

    for (const [nonce, expiresAtMs] of nonceExpiryByValue.entries()) {
      if (expiresAtMs <= now) {
        nonceExpiryByValue.delete(nonce);
      }
    }
  }, 60_000);

  const findRetryJobByEventKey = (eventKey: string): RetryJob | null => {
    for (const retryJob of retryJobsById.values()) {
      if (retryJob.eventKey === eventKey) {
        return retryJob;
      }
    }

    return null;
  };

  const enqueueRetry = (
    event: WebhookEvent,
    gateway: PaymentGateway,
    paymentId: string,
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
      paymentId,
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
  ): { processed: boolean; retriable: boolean; error?: string } => {
    const nowIso = new Date().toISOString();
    const payment = paymentsById.get(event.paymentId);

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

    event.status = "processed";
    event.lastError = undefined;
    event.updatedAt = nowIso;

    return { processed: true, retriable: false };
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
            pendingRetryCount: retryJobsById.size
          }
        });
      }

      if (method === "POST" && url.pathname === "/payments/intents") {
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

        const idempotencyScope = createIdempotencyScope(method, url.pathname, extractIdempotencyKey(req));
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

        const reservationId = body.reservationId?.trim() ?? "";
        const amount = body.amount;
        const currency = (body.currency ?? "VND").trim().toUpperCase();
        const gateway = body.gateway?.trim().toLowerCase() as PaymentGateway | undefined;

        if (!reservationId || typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) {
          return sendJson(res, 400, {
            success: false,
            error: {
              code: "INVALID_PAYMENT_INTENT_PAYLOAD",
              message: "reservationId and amount are required"
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

        const now = new Date().toISOString();
        const payment: PaymentIntent = {
          id: `pay_${randomUUID().replace(/-/g, "")}`,
          reservationId,
          userId,
          amount,
          currency: "VND",
          gateway,
          status: "pending",
          createdAt: now,
          updatedAt: now
        };

        paymentsById.set(payment.id, payment);

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
            paymentId: job.paymentId,
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
        const idempotencyScope = createIdempotencyScope(method, url.pathname, extractIdempotencyKey(req));
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

      const paymentIdMatch = /^\/payments\/([^/]+)$/.exec(url.pathname);
      if (method === "GET" && paymentIdMatch) {
        const paymentId = paymentIdMatch[1];
        const payment = paymentsById.get(paymentId);

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

      const webhookMatch = /^\/webhooks\/(momo|vnpay)$/.exec(url.pathname);
      if (method === "POST" && webhookMatch) {
        const gateway = webhookMatch[1] as PaymentGateway;
        const rawBody = await readRawBody(req);

        const verification = verifyWebhookSignature(
          req,
          rawBody,
          gatewaySecret(config, gateway),
          nonceExpiryByValue,
          config
        );

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
        const paymentId = payload.paymentId?.trim() ?? "";
        if (!paymentId) {
          return sendJson(res, 400, {
            success: false,
            error: {
              code: "INVALID_WEBHOOK_PAYLOAD",
              message: "paymentId is required"
            }
          });
        }

        const digest = sha256Hex(rawBody);
        const eventSuffix = payload.eventId?.trim() || digest;
        const eventKey = `${gateway}:${eventSuffix}`;

        if (webhookEventsByKey.has(eventKey)) {
          return sendJson(res, 200, {
            success: true,
            data: {
              eventKey,
              status: "duplicate"
            }
          });
        }

        const nowIso = new Date().toISOString();
        const event: WebhookEvent = {
          id: `wbh_${randomUUID().replace(/-/g, "")}`,
          gateway,
          eventKey,
          paymentId,
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
              paymentId
            }
          });
        }

        if (result.retriable) {
          const retryJob = enqueueRetry(event, gateway, paymentId, 1, result.error ?? "UNKNOWN_ERROR");
          return sendJson(res, 202, {
            success: true,
            data: {
              eventKey,
              status: event.status,
              retryJobId: retryJob.id,
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
