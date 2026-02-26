import { randomUUID } from "node:crypto";
import { createServer, IncomingMessage, ServerResponse } from "node:http";

import type { NotificationConfig } from "./config.js";
import { log } from "./logger.js";

type NotificationChannel = "sms" | "email" | "push";
type NotificationStatus = "queued" | "sent" | "failed";

interface TemplateDefinition {
  id: string;
  eventType: string;
  channels: NotificationChannel[];
  title: string;
  body: string;
}

interface SendNotificationBody {
  userId?: string;
  channel?: string;
  title?: string;
  message?: string;
  metadata?: Record<string, unknown>;
}

interface TriggerEventBody {
  userId?: string;
  eventType?: string;
  channels?: string[];
  variables?: Record<string, unknown>;
}

interface NotificationItem {
  id: string;
  userId: string;
  channel: NotificationChannel;
  title: string;
  message: string;
  status: NotificationStatus;
  retryCount: number;
  metadata: Record<string, unknown>;
  eventType?: string;
  createdAt: string;
  updatedAt: string;
  deliveredAt?: string;
  failureReason?: string;
}

const templates: TemplateDefinition[] = [
  {
    id: "tpl_payment_confirmed",
    eventType: "payment_confirmed",
    channels: ["push", "email"],
    title: "Payment Confirmed",
    body: "Your payment for order {{orderId}} is confirmed. Ticket delivery is in progress."
  },
  {
    id: "tpl_refund_completed",
    eventType: "refund_completed",
    channels: ["push", "sms"],
    title: "Refund Completed",
    body: "Refund {{refundAmount}} VND for ticket {{ticketId}} has been completed."
  },
  {
    id: "tpl_recovery_initiated",
    eventType: "recovery_initiated",
    channels: ["push", "email"],
    title: "Account Recovery Initiated",
    body: "Recovery request {{recoveryId}} is active. If this was not you, contact support immediately."
  },
  {
    id: "tpl_dispute_escalated",
    eventType: "dispute_escalated",
    channels: ["push", "email"],
    title: "Dispute Escalated",
    body: "Dispute {{disputeId}} has been escalated to tier {{tier}}."
  },
  {
    id: "tpl_event_cancelled",
    eventType: "event_cancelled",
    channels: ["push", "sms", "email"],
    title: "Event Cancelled",
    body: "Event {{eventId}} was cancelled. Refund instructions are now available in the app."
  }
];

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

function toIso(ms: number): string {
  return new Date(ms).toISOString();
}

function parseChannel(raw: string | undefined): NotificationChannel | null {
  const value = raw?.trim().toLowerCase();
  if (value === "sms") {
    return "sms";
  }

  if (value === "email") {
    return "email";
  }

  if (value === "push") {
    return "push";
  }

  return null;
}

function parseChannels(rawChannels: string[] | undefined, fallback: NotificationChannel[]): NotificationChannel[] {
  if (!rawChannels || rawChannels.length === 0) {
    return fallback;
  }

  const parsed = new Set<NotificationChannel>();
  for (const raw of rawChannels) {
    const channel = parseChannel(raw);
    if (channel) {
      parsed.add(channel);
    }
  }

  return parsed.size === 0 ? fallback : Array.from(parsed);
}

function renderTemplate(template: string, variables: Record<string, unknown>): string {
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_match, key: string) => {
    const value = variables[key];
    return value === undefined || value === null ? "" : String(value);
  });
}

function serializeNotification(item: NotificationItem): Record<string, unknown> {
  return {
    notificationId: item.id,
    userId: item.userId,
    channel: item.channel,
    title: item.title,
    message: item.message,
    status: item.status,
    retryCount: item.retryCount,
    metadata: item.metadata,
    eventType: item.eventType,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    deliveredAt: item.deliveredAt,
    failureReason: item.failureReason
  };
}

export function createNotificationServer(config: NotificationConfig) {
  const notificationsById = new Map<string, NotificationItem>();

  const enqueueNotification = (
    userId: string,
    channel: NotificationChannel,
    title: string,
    message: string,
    metadata: Record<string, unknown> = {},
    eventType?: string
  ): NotificationItem => {
    const nowIso = new Date().toISOString();
    const item: NotificationItem = {
      id: `ntf_${randomUUID().replace(/-/g, "")}`,
      userId,
      channel,
      title,
      message,
      status: "queued",
      retryCount: 0,
      metadata,
      eventType,
      createdAt: nowIso,
      updatedAt: nowIso
    };

    notificationsById.set(item.id, item);
    return item;
  };

  const deliveryTimer = setInterval(() => {
    const nowIso = new Date().toISOString();

    for (const item of notificationsById.values()) {
      if (item.status !== "queued") {
        continue;
      }

      const shouldFail = Math.random() < config.deliveryFailureRate;
      if (!shouldFail) {
        item.status = "sent";
        item.deliveredAt = nowIso;
        item.updatedAt = nowIso;
        item.failureReason = undefined;
        continue;
      }

      item.retryCount += 1;
      item.failureReason = "PROVIDER_DELIVERY_FAILED";
      item.updatedAt = nowIso;

      if (item.retryCount > config.maxRetries) {
        item.status = "failed";
      }
    }
  }, config.deliveryPollMs);

  const server = createServer(async (req, res) => {
    try {
      const method = req.method ?? "GET";
      const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);

      if (method === "GET" && url.pathname === "/healthz") {
        const summary = {
          queued: 0,
          sent: 0,
          failed: 0
        };

        for (const item of notificationsById.values()) {
          if (item.status === "queued") {
            summary.queued += 1;
          }

          if (item.status === "sent") {
            summary.sent += 1;
          }

          if (item.status === "failed") {
            summary.failed += 1;
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

      if (method === "GET" && url.pathname === "/notifications/templates") {
        return sendJson(res, 200, {
          success: true,
          data: templates
        });
      }

      if (method === "POST" && url.pathname === "/notifications/send") {
        const body = await readJson<SendNotificationBody>(req);
        const userId = body.userId?.trim() ?? "";
        const channel = parseChannel(body.channel);
        const title = body.title?.trim() ?? "";
        const message = body.message?.trim() ?? "";

        if (!userId || !channel || !title || !message) {
          return sendJson(res, 400, {
            success: false,
            error: {
              code: "INVALID_NOTIFICATION_PAYLOAD",
              message: "userId, channel, title, message are required"
            }
          });
        }

        const item = enqueueNotification(userId, channel, title, message, body.metadata ?? {});
        return sendJson(res, 200, {
          success: true,
          data: serializeNotification(item)
        });
      }

      if (method === "POST" && url.pathname === "/notifications/events") {
        const body = await readJson<TriggerEventBody>(req);
        const userId = body.userId?.trim() ?? "";
        const eventType = body.eventType?.trim() ?? "";

        if (!userId || !eventType) {
          return sendJson(res, 400, {
            success: false,
            error: {
              code: "INVALID_EVENT_PAYLOAD",
              message: "userId and eventType are required"
            }
          });
        }

        const template = templates.find((item) => item.eventType === eventType);
        if (!template) {
          return sendJson(res, 404, {
            success: false,
            error: {
              code: "TEMPLATE_NOT_FOUND",
              message: `No template for eventType ${eventType}`
            }
          });
        }

        const channels = parseChannels(body.channels, template.channels);
        const variables = body.variables ?? {};
        const title = renderTemplate(template.title, variables);
        const message = renderTemplate(template.body, variables);

        const items = channels.map((channel) =>
          enqueueNotification(userId, channel, title, message, variables, eventType)
        );

        return sendJson(res, 200, {
          success: true,
          data: items.map((item) => serializeNotification(item))
        });
      }

      if (method === "GET" && url.pathname === "/notifications/me") {
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

        const items = Array.from(notificationsById.values())
          .filter((item) => item.userId === userId)
          .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
          .map((item) => serializeNotification(item));

        return sendJson(res, 200, {
          success: true,
          data: items
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
    clearInterval(deliveryTimer);
  });

  return server;
}
