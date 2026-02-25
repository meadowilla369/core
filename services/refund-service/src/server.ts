import { randomUUID } from "node:crypto";
import { createServer, IncomingMessage, ServerResponse } from "node:http";

import type { RefundConfig } from "./config.js";
import { log } from "./logger.js";

type RefundMethod = "momo" | "bank_transfer";
type RefundStatus = "pending" | "processing" | "completed" | "failed";

interface CreateRefundBody {
  ticketId?: string;
  eventId?: string;
  paymentId?: string;
  refundMethod?: string;
  eventStatus?: string;
  refundWindowOpen?: boolean;
  originalPurchasePrice?: number;
  resalePurchasePrice?: number;
}

interface RefundRecord {
  id: string;
  userId: string;
  ticketId: string;
  eventId: string;
  paymentId: string;
  refundMethod: RefundMethod;
  refundAmount: number;
  status: RefundStatus;
  retryCount: number;
  nextAttemptAtMs: number;
  payoutReference?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  failureReason?: string;
}

function sendJson(res: ServerResponse, statusCode: number, payload: unknown): void {
  res.statusCode = statusCode;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}

async function readJson<T>(req: IncomingMessage): Promise<T> {
  const chunks: Buffer[] = [];

  for await (const chunk of req) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }

  const raw = Buffer.concat(chunks).toString("utf-8").trim();
  if (!raw) {
    return {} as T;
  }

  return JSON.parse(raw) as T;
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

function toIso(ms: number): string {
  return new Date(ms).toISOString();
}

function normalizeMethod(rawMethod: string | undefined): RefundMethod | null {
  const value = rawMethod?.trim().toLowerCase();
  if (value === "momo") {
    return "momo";
  }

  if (value === "bank_transfer") {
    return "bank_transfer";
  }

  return null;
}

function computeRetryDelayMs(baseDelaySec: number, retryCount: number): number {
  const multiplier = 2 ** Math.min(5, Math.max(0, retryCount));
  return baseDelaySec * 1000 * multiplier;
}

function resolveRefundEligibility(body: CreateRefundBody): { allowed: boolean; reason?: string } {
  const eventStatus = body.eventStatus?.trim().toLowerCase() ?? "active";

  if (eventStatus === "cancelled") {
    return { allowed: true };
  }

  if (eventStatus === "postponed" && body.refundWindowOpen === true) {
    return { allowed: true };
  }

  if (eventStatus === "postponed" && body.refundWindowOpen !== true) {
    return {
      allowed: false,
      reason: "REFUND_WINDOW_CLOSED"
    };
  }

  return {
    allowed: false,
    reason: "EVENT_NOT_REFUNDABLE"
  };
}

function serializeRefund(refund: RefundRecord): Record<string, unknown> {
  return {
    refundId: refund.id,
    userId: refund.userId,
    ticketId: refund.ticketId,
    eventId: refund.eventId,
    paymentId: refund.paymentId,
    refundMethod: refund.refundMethod,
    refundAmount: refund.refundAmount,
    status: refund.status,
    retryCount: refund.retryCount,
    nextAttemptAt: toIso(refund.nextAttemptAtMs),
    payoutReference: refund.payoutReference,
    createdAt: refund.createdAt,
    updatedAt: refund.updatedAt,
    completedAt: refund.completedAt,
    failureReason: refund.failureReason
  };
}

export function createRefundServer(config: RefundConfig) {
  const refundsById = new Map<string, RefundRecord>();
  const refundIdByTicket = new Map<string, string>();
  const idempotencyResponses = new Map<string, unknown>();

  const processDueRefunds = (): { processed: number; completed: number; failed: number; requeued: number } => {
    const now = Date.now();
    let processed = 0;
    let completed = 0;
    let failed = 0;
    let requeued = 0;

    for (const refund of refundsById.values()) {
      if (refund.status !== "pending" || refund.nextAttemptAtMs > now) {
        continue;
      }

      processed += 1;
      refund.status = "processing";
      refund.updatedAt = toIso(now);

      const shouldFail = Math.random() < config.payoutFailureRate;
      if (!shouldFail) {
        refund.status = "completed";
        refund.payoutReference = `rf_${randomUUID().replace(/-/g, "")}`;
        refund.completedAt = toIso(now);
        refund.updatedAt = toIso(now);
        refund.failureReason = undefined;
        completed += 1;
        continue;
      }

      refund.retryCount += 1;
      refund.failureReason = "PAYOUT_PROVIDER_ERROR";

      if (refund.retryCount > config.maxRetryCount) {
        refund.status = "failed";
        refund.updatedAt = toIso(now);
        failed += 1;
        continue;
      }

      refund.status = "pending";
      refund.nextAttemptAtMs = now + computeRetryDelayMs(config.retryBaseDelaySec, refund.retryCount);
      refund.updatedAt = toIso(now);
      requeued += 1;
    }

    return { processed, completed, failed, requeued };
  };

  const payoutTimer = setInterval(() => {
    const summary = processDueRefunds();
    if (summary.processed > 0) {
      log(config.serviceName, "info", "Refund payout sync processed", summary);
    }
  }, config.payoutSyncPollMs);

  const server = createServer(async (req, res) => {
    try {
      const method = req.method ?? "GET";
      const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);

      if (method === "GET" && url.pathname === "/healthz") {
        let pendingCount = 0;
        let completedCount = 0;
        let failedCount = 0;

        for (const refund of refundsById.values()) {
          if (refund.status === "pending" || refund.status === "processing") {
            pendingCount += 1;
          }

          if (refund.status === "completed") {
            completedCount += 1;
          }

          if (refund.status === "failed") {
            failedCount += 1;
          }
        }

        return sendJson(res, 200, {
          success: true,
          data: {
            service: config.serviceName,
            status: "ok",
            timestamp: new Date().toISOString(),
            pendingCount,
            completedCount,
            failedCount
          }
        });
      }

      if (method === "POST" && url.pathname === "/refunds/requests") {
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

        const body = await readJson<CreateRefundBody>(req);
        const ticketId = body.ticketId?.trim() ?? "";
        const eventId = body.eventId?.trim() ?? "";
        const paymentId = body.paymentId?.trim() ?? "";

        if (!ticketId || !eventId || !paymentId) {
          return sendJson(res, 400, {
            success: false,
            error: {
              code: "INVALID_REFUND_PAYLOAD",
              message: "ticketId, eventId, paymentId are required"
            }
          });
        }

        const eligibility = resolveRefundEligibility(body);
        if (!eligibility.allowed) {
          return sendJson(res, 400, {
            success: false,
            error: {
              code: eligibility.reason,
              message: "Ticket is not eligible for refund"
            }
          });
        }

        const refundMethod = normalizeMethod(body.refundMethod) ?? "momo";

        const originalPurchasePrice = body.originalPurchasePrice;
        const resalePurchasePrice = body.resalePurchasePrice;

        if (
          typeof originalPurchasePrice !== "number" ||
          !Number.isFinite(originalPurchasePrice) ||
          originalPurchasePrice <= 0
        ) {
          return sendJson(res, 400, {
            success: false,
            error: {
              code: "INVALID_ORIGINAL_PRICE",
              message: "originalPurchasePrice must be a positive number"
            }
          });
        }

        const refundAmount = originalPurchasePrice;
        if (
          typeof resalePurchasePrice === "number" &&
          Number.isFinite(resalePurchasePrice) &&
          resalePurchasePrice > refundAmount
        ) {
          log(config.serviceName, "info", "Resale premium excluded from refund amount", {
            ticketId,
            originalPurchasePrice,
            resalePurchasePrice
          });
        }

        const ticketKey = `${userId}:${ticketId}`;
        const existingRefundId = refundIdByTicket.get(ticketKey);
        if (existingRefundId) {
          const existing = refundsById.get(existingRefundId);
          if (existing && existing.status !== "failed") {
            return sendJson(res, 409, {
              success: false,
              error: {
                code: "REFUND_ALREADY_REQUESTED",
                message: "Refund already requested for this ticket"
              }
            });
          }
        }

        const now = Date.now();
        const refund: RefundRecord = {
          id: `ref_${randomUUID().replace(/-/g, "")}`,
          userId,
          ticketId,
          eventId,
          paymentId,
          refundMethod,
          refundAmount,
          status: "pending",
          retryCount: 0,
          nextAttemptAtMs: now,
          createdAt: toIso(now),
          updatedAt: toIso(now)
        };

        refundsById.set(refund.id, refund);
        refundIdByTicket.set(ticketKey, refund.id);

        const response = {
          success: true,
          data: serializeRefund(refund)
        };

        if (idempotencyScope) {
          idempotencyResponses.set(idempotencyScope, response);
        }

        return sendJson(res, 200, response);
      }

      if (method === "GET" && url.pathname === "/refunds/me") {
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

        const refunds = Array.from(refundsById.values())
          .filter((refund) => refund.userId === userId)
          .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
          .map((refund) => serializeRefund(refund));

        return sendJson(res, 200, {
          success: true,
          data: refunds
        });
      }

      const refundMatch = /^\/refunds\/([^/]+)$/.exec(url.pathname);
      if (method === "GET" && refundMatch) {
        const refund = refundsById.get(refundMatch[1]);
        if (!refund) {
          return sendJson(res, 404, {
            success: false,
            error: {
              code: "REFUND_NOT_FOUND",
              message: "Refund request not found"
            }
          });
        }

        return sendJson(res, 200, {
          success: true,
          data: serializeRefund(refund)
        });
      }

      if (method === "POST" && url.pathname === "/refunds/sync") {
        const summary = processDueRefunds();

        return sendJson(res, 200, {
          success: true,
          data: {
            ...summary,
            remainingPending: Array.from(refundsById.values()).filter((refund) => refund.status === "pending")
              .length
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
    clearInterval(payoutTimer);
  });

  return server;
}
