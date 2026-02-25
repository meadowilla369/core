import { randomUUID } from "node:crypto";
import { createServer, IncomingMessage, ServerResponse } from "node:http";

import type { TicketingConfig } from "./config.js";
import { log } from "./logger.js";

interface ReserveBody {
  eventId?: string;
  ticketTypeId?: string;
  quantity?: number;
}

interface PurchaseBody {
  reservationId?: string;
  paymentMethod?: string;
}

interface Reservation {
  id: string;
  userId: string;
  eventId: string;
  ticketTypeId: string;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
  status: "pending" | "paid" | "expired";
  expiresAtMs: number;
  createdAt: string;
  paymentIntentId?: string;
}

interface TicketRecord {
  tokenId: string;
  eventId: string;
  ticketTypeId: string;
  ownerUserId: string;
  seatInfo: string;
  reservationId: string;
  createdAt: string;
}

const MAX_TICKETS_PER_RESERVATION = 4;
const ticketTypePrice = new Map<string, number>([
  ["tt_rockfest_ga", 900000],
  ["tt_rockfest_vip", 2200000],
  ["tt_jazz_std", 650000],
  ["tt_jazz_vvip", 1800000]
]);

function sendJson(res: ServerResponse, statusCode: number, payload: unknown): void {
  res.statusCode = statusCode;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}

function extractUserId(req: IncomingMessage): string | null {
  const value = req.headers["x-user-id"];
  if (!value) {
    return null;
  }

  const userId = Array.isArray(value) ? value[0] : value;
  return userId?.trim() || null;
}

function extractIdempotencyKey(req: IncomingMessage): string | null {
  const value = req.headers["idempotency-key"];
  if (!value) {
    return null;
  }

  const key = Array.isArray(value) ? value[0] : value;
  return key?.trim() || null;
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

function toIso(ms: number): string {
  return new Date(ms).toISOString();
}

export function createTicketingServer(config: TicketingConfig) {
  const reservations = new Map<string, Reservation>();
  const ticketsByUser = new Map<string, TicketRecord[]>();
  const idempotencyResponses = new Map<string, unknown>();

  const cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const reservation of reservations.values()) {
      if (reservation.status === "pending" && reservation.expiresAtMs <= now) {
        reservation.status = "expired";
      }
    }
  }, 30_000);

  const saveIdempotent = (key: string | null, response: unknown): void => {
    if (key) {
      idempotencyResponses.set(key, response);
    }
  };

  return createServer(async (req, res) => {
    try {
      const method = req.method ?? "GET";
      const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
      const idempotencyKey = extractIdempotencyKey(req);

      if (method === "GET" && url.pathname === "/healthz") {
        return sendJson(res, 200, {
          success: true,
          data: {
            service: config.serviceName,
            status: "ok",
            timestamp: new Date().toISOString()
          }
        });
      }

      if (idempotencyKey && idempotencyResponses.has(idempotencyKey)) {
        return sendJson(res, 200, idempotencyResponses.get(idempotencyKey));
      }

      const userId = extractUserId(req);
      if (!userId && url.pathname.startsWith("/tickets")) {
        return sendJson(res, 401, {
          success: false,
          error: {
            code: "UNAUTHORIZED",
            message: "Missing x-user-id header"
          }
        });
      }

      if (method === "POST" && url.pathname === "/tickets/reserve") {
        const body = await readJson<ReserveBody>(req);

        if (!userId || !body.eventId || !body.ticketTypeId || !body.quantity) {
          return sendJson(res, 400, {
            success: false,
            error: {
              code: "INVALID_RESERVATION_PAYLOAD",
              message: "eventId, ticketTypeId and quantity are required"
            }
          });
        }

        if (body.quantity < 1 || body.quantity > MAX_TICKETS_PER_RESERVATION) {
          return sendJson(res, 400, {
            success: false,
            error: {
              code: "INVALID_QUANTITY",
              message: "Quantity must be between 1 and 4"
            }
          });
        }

        const unitPrice = ticketTypePrice.get(body.ticketTypeId);
        if (!unitPrice) {
          return sendJson(res, 400, {
            success: false,
            error: {
              code: "UNKNOWN_TICKET_TYPE",
              message: "Ticket type not supported"
            }
          });
        }

        const now = Date.now();
        const reservation: Reservation = {
          id: `res_${randomUUID().replace(/-/g, "")}`,
          userId,
          eventId: body.eventId,
          ticketTypeId: body.ticketTypeId,
          quantity: body.quantity,
          unitPrice,
          totalAmount: unitPrice * body.quantity,
          status: "pending",
          expiresAtMs: now + config.reservationTtlSec * 1000,
          createdAt: toIso(now)
        };

        reservations.set(reservation.id, reservation);

        const response = {
          success: true,
          data: {
            reservationId: reservation.id,
            eventId: reservation.eventId,
            ticketTypeId: reservation.ticketTypeId,
            quantity: reservation.quantity,
            totalAmount: reservation.totalAmount,
            status: reservation.status,
            expiresAt: toIso(reservation.expiresAtMs)
          }
        };

        saveIdempotent(idempotencyKey, response);
        return sendJson(res, 200, response);
      }

      if (method === "POST" && url.pathname === "/tickets/purchase") {
        const body = await readJson<PurchaseBody>(req);

        if (!userId || !body.reservationId || !body.paymentMethod) {
          return sendJson(res, 400, {
            success: false,
            error: {
              code: "INVALID_PURCHASE_PAYLOAD",
              message: "reservationId and paymentMethod are required"
            }
          });
        }

        const reservation = reservations.get(body.reservationId);
        if (!reservation || reservation.userId !== userId) {
          return sendJson(res, 404, {
            success: false,
            error: {
              code: "RESERVATION_NOT_FOUND",
              message: "Reservation not found"
            }
          });
        }

        if (reservation.status !== "pending") {
          return sendJson(res, 400, {
            success: false,
            error: {
              code: "RESERVATION_NOT_PENDING",
              message: "Reservation is not pending"
            }
          });
        }

        if (Date.now() > reservation.expiresAtMs) {
          reservation.status = "expired";
          return sendJson(res, 400, {
            success: false,
            error: {
              code: "RESERVATION_EXPIRED",
              message: "Reservation expired"
            }
          });
        }

        reservation.status = "paid";
        reservation.paymentIntentId = `pay_${randomUUID().replace(/-/g, "")}`;

        const existing = ticketsByUser.get(userId) ?? [];
        for (let i = 0; i < reservation.quantity; i += 1) {
          const ticket: TicketRecord = {
            tokenId: `mock_${randomUUID().replace(/-/g, "")}`,
            eventId: reservation.eventId,
            ticketTypeId: reservation.ticketTypeId,
            ownerUserId: userId,
            seatInfo: `GA-${String(existing.length + i + 1).padStart(4, "0")}`,
            reservationId: reservation.id,
            createdAt: new Date().toISOString()
          };
          existing.push(ticket);
        }
        ticketsByUser.set(userId, existing);

        const response = {
          success: true,
          data: {
            reservationId: reservation.id,
            paymentIntentId: reservation.paymentIntentId,
            status: reservation.status,
            ticketsIssued: reservation.quantity
          }
        };

        saveIdempotent(idempotencyKey, response);
        return sendJson(res, 200, response);
      }

      if (method === "GET" && url.pathname === "/tickets/me") {
        const tickets = ticketsByUser.get(userId ?? "") ?? [];
        return sendJson(res, 200, {
          success: true,
          data: tickets
        });
      }

      const ticketDetailMatch = url.pathname.match(/^\/tickets\/([^/]+)$/);
      if (method === "GET" && ticketDetailMatch) {
        const tokenId = ticketDetailMatch[1];
        const tickets = ticketsByUser.get(userId ?? "") ?? [];
        const ticket = tickets.find((item) => item.tokenId === tokenId);

        if (!ticket) {
          return sendJson(res, 404, {
            success: false,
            error: {
              code: "TICKET_NOT_FOUND",
              message: "Ticket not found"
            }
          });
        }

        return sendJson(res, 200, {
          success: true,
          data: ticket
        });
      }

      const qrMatch = url.pathname.match(/^\/tickets\/([^/]+)\/qr$/);
      if (method === "POST" && qrMatch) {
        const tokenId = qrMatch[1];
        const tickets = ticketsByUser.get(userId ?? "") ?? [];
        const ticket = tickets.find((item) => item.tokenId === tokenId);

        if (!ticket) {
          return sendJson(res, 404, {
            success: false,
            error: {
              code: "TICKET_NOT_FOUND",
              message: "Ticket not found"
            }
          });
        }

        const now = Date.now();
        const response = {
          success: true,
          data: {
            tokenId: ticket.tokenId,
            eventId: ticket.eventId,
            timestamp: now,
            nonce: randomUUID(),
            walletAddress: `mock-wallet-${ticket.ownerUserId}`,
            signature: `0x${randomUUID().replace(/-/g, "")}${randomUUID().replace(/-/g, "")}`
          }
        };

        saveIdempotent(idempotencyKey, response);
        return sendJson(res, 200, response);
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
