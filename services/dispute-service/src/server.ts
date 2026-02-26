import { randomUUID } from "node:crypto";
import { createServer, IncomingMessage, ServerResponse } from "node:http";

import type { DisputeConfig } from "./config.js";
import { log } from "./logger.js";

type DisputeStatus = "open" | "in_review" | "auto_resolved" | "escalated" | "resolved" | "closed";

type DisputeTier = 1 | 2 | 3;

interface CreateDisputeBody {
  category?: string;
  title?: string;
  description?: string;
  disputedAmount?: number;
  ticketId?: string;
  paymentId?: string;
  eventId?: string;
  evidence?: Record<string, unknown>;
}

interface AddMessageBody {
  message?: string;
  senderType?: string;
}

interface EscalateBody {
  reason?: string;
}

interface ModerateDisputeBody {
  action?: string;
  resolutionNote?: string;
  resolutionAmount?: number;
}

interface DisputeRecord {
  id: string;
  userId: string;
  category: string;
  title: string;
  description: string;
  disputedAmount: number;
  ticketId?: string;
  paymentId?: string;
  eventId?: string;
  evidence: Record<string, unknown>;
  status: DisputeStatus;
  currentTier: DisputeTier;
  slaDeadlineAt: string;
  autoResolutionAction?: string;
  createdAt: string;
  updatedAt: string;
}

interface DisputeMessage {
  id: string;
  disputeId: string;
  senderType: "user" | "support" | "system";
  message: string;
  createdAt: string;
}

interface DisputeAuditEntry {
  id: string;
  disputeId: string;
  action: string;
  performedBy: string;
  details: Record<string, unknown>;
  createdAt: string;
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

function extractSupportRole(req: IncomingMessage): string | null {
  return extractSingleHeader(req, "x-support-role");
}

function hasInternalAccess(req: IncomingMessage, config: DisputeConfig): boolean {
  const key = extractSingleHeader(req, "x-internal-api-key");
  return key === config.internalApiKey || Boolean(extractSupportRole(req));
}

function toIso(ms: number): string {
  return new Date(ms).toISOString();
}

function computeSlaDeadline(config: DisputeConfig, amount: number, tier: DisputeTier): string {
  const now = Date.now();

  if (tier === 1) {
    if (amount < 500_000) {
      return toIso(now + config.slaTier1Hours * 60 * 60 * 1000);
    }

    if (amount < 2_000_000) {
      return toIso(now + config.slaTier2Hours * 60 * 60 * 1000);
    }

    return toIso(now + config.slaTier3Hours * 60 * 60 * 1000);
  }

  if (tier === 2) {
    return toIso(now + config.slaTier2Hours * 60 * 60 * 1000);
  }

  return toIso(now + config.slaTier3Hours * 60 * 60 * 1000);
}

function resolveAutoRule(
  category: string,
  evidence: Record<string, unknown>
): { matched: boolean; action?: string; message?: string } {
  const paymentCount = Number(evidence.paymentCount ?? 0);
  const uniqueTicketCount = Number(evidence.uniqueTicketCount ?? 0);
  const paymentConfirmed = Boolean(evidence.paymentConfirmed);
  const nftMinted = Boolean(evidence.nftMinted);
  const timeSincePaymentMs = Number(evidence.timeSincePaymentMs ?? 0);
  const eventCancelled = Boolean(evidence.eventCancelled);
  const refundRequested = Boolean(evidence.refundRequested);
  const refundNotSent = Boolean(evidence.refundNotSent);
  const timeSinceRequestMs = Number(evidence.timeSinceRequestMs ?? 0);

  if (category === "double_payment" && paymentCount > 1 && uniqueTicketCount === 1) {
    return {
      matched: true,
      action: "AUTO_REFUND_DUPLICATE_PAYMENT",
      message: "Duplicate payment detected; auto-refund initiated"
    };
  }

  if (category === "payment_no_ticket" && paymentConfirmed && !nftMinted && timeSincePaymentMs > 15 * 60 * 1000) {
    return {
      matched: true,
      action: "AUTO_ISSUE_TICKET_OR_REFUND",
      message: "Payment confirmed without ticket delivery"
    };
  }

  if (
    category === "refund_not_processed" &&
    eventCancelled &&
    refundRequested &&
    refundNotSent &&
    timeSinceRequestMs > 14 * 24 * 60 * 60 * 1000
  ) {
    return {
      matched: true,
      action: "AUTO_ESCALATE_REFUND",
      message: "Refund request exceeded 14-day SLA"
    };
  }

  return { matched: false };
}

function serializeDispute(dispute: DisputeRecord, messageCount: number): Record<string, unknown> {
  return {
    disputeId: dispute.id,
    userId: dispute.userId,
    category: dispute.category,
    title: dispute.title,
    description: dispute.description,
    disputedAmount: dispute.disputedAmount,
    ticketId: dispute.ticketId,
    paymentId: dispute.paymentId,
    eventId: dispute.eventId,
    evidence: dispute.evidence,
    status: dispute.status,
    currentTier: dispute.currentTier,
    slaDeadlineAt: dispute.slaDeadlineAt,
    autoResolutionAction: dispute.autoResolutionAction,
    messageCount,
    createdAt: dispute.createdAt,
    updatedAt: dispute.updatedAt
  };
}

export function createDisputeServer(config: DisputeConfig) {
  const disputesById = new Map<string, DisputeRecord>();
  const messagesByDisputeId = new Map<string, DisputeMessage[]>();
  const auditByDisputeId = new Map<string, DisputeAuditEntry[]>();

  const appendAudit = (
    disputeId: string,
    action: string,
    performedBy: string,
    details: Record<string, unknown>
  ): void => {
    const entries = auditByDisputeId.get(disputeId) ?? [];
    entries.push({
      id: `aud_${randomUUID().replace(/-/g, "")}`,
      disputeId,
      action,
      performedBy,
      details,
      createdAt: new Date().toISOString()
    });

    auditByDisputeId.set(disputeId, entries);
  };

  const appendMessage = (
    disputeId: string,
    senderType: "user" | "support" | "system",
    message: string
  ): DisputeMessage => {
    const entries = messagesByDisputeId.get(disputeId) ?? [];
    const entry: DisputeMessage = {
      id: `msg_${randomUUID().replace(/-/g, "")}`,
      disputeId,
      senderType,
      message,
      createdAt: new Date().toISOString()
    };

    entries.push(entry);
    messagesByDisputeId.set(disputeId, entries);
    return entry;
  };

  return createServer(async (req, res) => {
    try {
      const method = req.method ?? "GET";
      const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);

      if (method === "GET" && url.pathname === "/healthz") {
        const summary = {
          open: 0,
          inReview: 0,
          autoResolved: 0,
          escalated: 0,
          resolved: 0
        };

        for (const dispute of disputesById.values()) {
          if (dispute.status === "open") {
            summary.open += 1;
          }

          if (dispute.status === "in_review") {
            summary.inReview += 1;
          }

          if (dispute.status === "auto_resolved") {
            summary.autoResolved += 1;
          }

          if (dispute.status === "escalated") {
            summary.escalated += 1;
          }

          if (dispute.status === "resolved") {
            summary.resolved += 1;
          }
        }

        return sendJson(res, 200, {
          success: true,
          data: {
            service: config.serviceName,
            status: "ok",
            timestamp: new Date().toISOString(),
            summary
          }
        });
      }

      if (method === "POST" && url.pathname === "/disputes") {
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

        const body = await readJson<CreateDisputeBody>(req);
        const category = body.category?.trim() ?? "";
        const title = body.title?.trim() ?? "";
        const description = body.description?.trim() ?? "";
        const disputedAmount = body.disputedAmount;

        if (!category || !title || !description || typeof disputedAmount !== "number" || disputedAmount <= 0) {
          return sendJson(res, 400, {
            success: false,
            error: {
              code: "INVALID_DISPUTE_PAYLOAD",
              message: "category, title, description, disputedAmount are required"
            }
          });
        }

        const evidence = body.evidence ?? {};
        const autoRule = resolveAutoRule(category, evidence);
        const nowIso = new Date().toISOString();

        const dispute: DisputeRecord = {
          id: `dsp_${randomUUID().replace(/-/g, "")}`,
          userId,
          category,
          title,
          description,
          disputedAmount,
          ticketId: body.ticketId?.trim(),
          paymentId: body.paymentId?.trim(),
          eventId: body.eventId?.trim(),
          evidence,
          status: autoRule.matched ? "auto_resolved" : "open",
          currentTier: 1,
          slaDeadlineAt: computeSlaDeadline(config, disputedAmount, 1),
          autoResolutionAction: autoRule.action,
          createdAt: nowIso,
          updatedAt: nowIso
        };

        disputesById.set(dispute.id, dispute);
        appendMessage(dispute.id, "user", description);
        appendAudit(dispute.id, "CREATE_DISPUTE", userId, {
          category,
          disputedAmount,
          autoRuleMatched: autoRule.matched,
          autoAction: autoRule.action
        });

        if (autoRule.matched && autoRule.message) {
          appendMessage(dispute.id, "system", autoRule.message);
          appendAudit(dispute.id, "AUTO_RESOLVE", "system", {
            action: autoRule.action,
            reason: autoRule.message
          });
        }

        const messages = messagesByDisputeId.get(dispute.id) ?? [];
        return sendJson(res, 200, {
          success: true,
          data: serializeDispute(dispute, messages.length)
        });
      }

      if (method === "GET" && url.pathname === "/disputes/me") {
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

        const disputes = Array.from(disputesById.values())
          .filter((dispute) => dispute.userId === userId)
          .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
          .map((dispute) => serializeDispute(dispute, (messagesByDisputeId.get(dispute.id) ?? []).length));

        return sendJson(res, 200, {
          success: true,
          data: disputes
        });
      }

      const disputeMatch = /^\/disputes\/([^/]+)$/.exec(url.pathname);
      if (method === "GET" && disputeMatch) {
        const userId = extractUserId(req);
        const supportRole = extractSupportRole(req);

        const dispute = disputesById.get(disputeMatch[1]);
        if (!dispute) {
          return sendJson(res, 404, {
            success: false,
            error: {
              code: "DISPUTE_NOT_FOUND",
              message: "Dispute not found"
            }
          });
        }

        if (!supportRole && dispute.userId !== userId) {
          return sendJson(res, 403, {
            success: false,
            error: {
              code: "FORBIDDEN",
              message: "Not allowed to read this dispute"
            }
          });
        }

        return sendJson(res, 200, {
          success: true,
          data: {
            ...serializeDispute(dispute, (messagesByDisputeId.get(dispute.id) ?? []).length),
            messages: messagesByDisputeId.get(dispute.id) ?? [],
            auditLog: auditByDisputeId.get(dispute.id) ?? []
          }
        });
      }

      const messageMatch = /^\/disputes\/([^/]+)\/messages$/.exec(url.pathname);
      if (method === "POST" && messageMatch) {
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

        const dispute = disputesById.get(messageMatch[1]);
        if (!dispute) {
          return sendJson(res, 404, {
            success: false,
            error: {
              code: "DISPUTE_NOT_FOUND",
              message: "Dispute not found"
            }
          });
        }

        if (dispute.userId !== userId && !extractSupportRole(req)) {
          return sendJson(res, 403, {
            success: false,
            error: {
              code: "FORBIDDEN",
              message: "Not allowed to post message"
            }
          });
        }

        const body = await readJson<AddMessageBody>(req);
        const text = body.message?.trim() ?? "";
        const senderType = (body.senderType?.trim().toLowerCase() ?? "user") as
          | "user"
          | "support"
          | "system";

        if (!text) {
          return sendJson(res, 400, {
            success: false,
            error: {
              code: "INVALID_MESSAGE",
              message: "message is required"
            }
          });
        }

        const message = appendMessage(dispute.id, senderType, text);
        dispute.updatedAt = new Date().toISOString();

        if (dispute.status === "open") {
          dispute.status = "in_review";
        }

        appendAudit(dispute.id, "ADD_MESSAGE", userId, {
          senderType,
          messageId: message.id
        });

        return sendJson(res, 200, {
          success: true,
          data: message
        });
      }

      const escalateMatch = /^\/disputes\/([^/]+)\/escalate$/.exec(url.pathname);
      if (method === "POST" && escalateMatch) {
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

        const dispute = disputesById.get(escalateMatch[1]);
        if (!dispute) {
          return sendJson(res, 404, {
            success: false,
            error: {
              code: "DISPUTE_NOT_FOUND",
              message: "Dispute not found"
            }
          });
        }

        if (dispute.userId !== userId && !extractSupportRole(req)) {
          return sendJson(res, 403, {
            success: false,
            error: {
              code: "FORBIDDEN",
              message: "Not allowed to escalate dispute"
            }
          });
        }

        if (dispute.currentTier >= 3) {
          return sendJson(res, 400, {
            success: false,
            error: {
              code: "MAX_TIER_REACHED",
              message: "Dispute is already at highest tier"
            }
          });
        }

        const body = await readJson<EscalateBody>(req);
        const reason = body.reason?.trim() || "manual_escalation";

        const fromTier = dispute.currentTier;
        const toTier = (fromTier + 1) as DisputeTier;

        dispute.currentTier = toTier;
        dispute.status = "escalated";
        dispute.slaDeadlineAt = computeSlaDeadline(config, dispute.disputedAmount, toTier);
        dispute.updatedAt = new Date().toISOString();

        appendAudit(dispute.id, "ESCALATE", userId, {
          reason,
          fromTier,
          toTier
        });

        appendMessage(dispute.id, "system", `Dispute escalated from tier ${fromTier} to tier ${toTier}`);

        return sendJson(res, 200, {
          success: true,
          data: serializeDispute(dispute, (messagesByDisputeId.get(dispute.id) ?? []).length)
        });
      }

      const moderateMatch = /^\/internal\/disputes\/([^/]+)\/moderate$/.exec(url.pathname);
      if (method === "POST" && moderateMatch) {
        if (!hasInternalAccess(req, config)) {
          return sendJson(res, 401, {
            success: false,
            error: {
              code: "UNAUTHORIZED_INTERNAL",
              message: "Invalid internal API key"
            }
          });
        }

        const dispute = disputesById.get(moderateMatch[1]);
        if (!dispute) {
          return sendJson(res, 404, {
            success: false,
            error: {
              code: "DISPUTE_NOT_FOUND",
              message: "Dispute not found"
            }
          });
        }

        const body = await readJson<ModerateDisputeBody>(req);
        const action = body.action?.trim().toLowerCase() ?? "";
        const resolutionNote = body.resolutionNote?.trim() ?? "Moderated by support";

        if (!action) {
          return sendJson(res, 400, {
            success: false,
            error: {
              code: "INVALID_MODERATION_PAYLOAD",
              message: "action is required"
            }
          });
        }

        if (action === "resolve_refund_full" || action === "resolve_refund_partial") {
          dispute.status = "resolved";
        } else if (action === "close" || action === "reject") {
          dispute.status = "closed";
        } else {
          return sendJson(res, 400, {
            success: false,
            error: {
              code: "UNSUPPORTED_MODERATION_ACTION",
              message: "Unsupported moderation action"
            }
          });
        }

        dispute.updatedAt = new Date().toISOString();

        appendAudit(dispute.id, "MODERATE", "internal", {
          action,
          resolutionNote,
          resolutionAmount: body.resolutionAmount
        });

        appendMessage(
          dispute.id,
          "system",
          `Support moderation applied: ${action}. ${resolutionNote}`
        );

        return sendJson(res, 200, {
          success: true,
          data: serializeDispute(dispute, (messagesByDisputeId.get(dispute.id) ?? []).length)
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
}
