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

interface PurchaseConfirmBody {
  gatewayTransactionId?: string;
  status?: string;
}

type ReservationStatus = "pending" | "payment_pending" | "paid" | "expired";

interface Reservation {
  id: string;
  userId: string;
  eventId: string;
  ticketTypeId: string;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
  status: ReservationStatus;
  expiresAtMs: number;
  createdAt: string;
  paymentIntentId?: string;
  paymentMethod?: string;
  paymentInitiatedAt?: string;
  paidAt?: string;
  gatewayTransactionId?: string;
  inventoryLocked: boolean;
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

interface TicketTypeInventory {
  eventId: string;
  unitPrice: number;
  quantity: number;
  soldCount: number;
  lockedCount: number;
}

const MAX_TICKETS_PER_RESERVATION = 4;

const inventoryByTicketType = new Map<string, TicketTypeInventory>([
  [
    "tt_rockfest_ga",
    {
      eventId: "evt_rockfest_2026",
      unitPrice: 900000,
      quantity: 5000,
      soldCount: 1250,
      lockedCount: 0
    }
  ],
  [
    "tt_rockfest_vip",
    {
      eventId: "evt_rockfest_2026",
      unitPrice: 2200000,
      quantity: 300,
      soldCount: 120,
      lockedCount: 0
    }
  ],
  [
    "tt_jazz_std",
    {
      eventId: "evt_jazz_night_2026",
      unitPrice: 650000,
      quantity: 800,
      soldCount: 180,
      lockedCount: 0
    }
  ],
  [
    "tt_jazz_vvip",
    {
      eventId: "evt_jazz_night_2026",
      unitPrice: 1800000,
      quantity: 100,
      soldCount: 40,
      lockedCount: 0
    }
  ]
]);

function sendJson(res: ServerResponse, statusCode: number, payload: unknown): void {
  res.statusCode = statusCode;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
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

function extractInternalApiKey(req: IncomingMessage): string | null {
  return extractSingleHeader(req, "x-internal-api-key");
}

function createIdempotencyScope(method: string, path: string, key: string | null): string | null {
  if (!key) {
    return null;
  }

  return `${method}:${path}:${key}`;
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

function inventoryAvailable(inventory: TicketTypeInventory): number {
  return Math.max(inventory.quantity - inventory.soldCount - inventory.lockedCount, 0);
}

function releaseReservationLock(reservation: Reservation): void {
  if (!reservation.inventoryLocked) {
    return;
  }

  const inventory = inventoryByTicketType.get(reservation.ticketTypeId);
  if (!inventory) {
    reservation.inventoryLocked = false;
    return;
  }

  inventory.lockedCount = Math.max(inventory.lockedCount - reservation.quantity, 0);
  reservation.inventoryLocked = false;
}

function expireReservation(reservation: Reservation): void {
  if (reservation.status === "expired" || reservation.status === "paid") {
    return;
  }

  releaseReservationLock(reservation);
  reservation.status = "expired";
}

function normalizePaymentConfirmation(status: string | undefined): boolean {
  if (!status) {
    return true;
  }

  const normalized = status.trim().toLowerCase();
  return normalized === "paid" || normalized === "success" || normalized === "succeeded" || normalized === "confirmed";
}

function reservationResponse(reservation: Reservation): Record<string, unknown> {
  return {
    reservationId: reservation.id,
    eventId: reservation.eventId,
    ticketTypeId: reservation.ticketTypeId,
    quantity: reservation.quantity,
    unitPrice: reservation.unitPrice,
    totalAmount: reservation.totalAmount,
    status: reservation.status,
    paymentIntentId: reservation.paymentIntentId,
    paymentMethod: reservation.paymentMethod,
    gatewayTransactionId: reservation.gatewayTransactionId,
    expiresAt: toIso(reservation.expiresAtMs),
    createdAt: reservation.createdAt,
    paymentInitiatedAt: reservation.paymentInitiatedAt,
    paidAt: reservation.paidAt
  };
}

export function createTicketingServer(config: TicketingConfig) {
  const reservations = new Map<string, Reservation>();
  const ticketsByUser = new Map<string, TicketRecord[]>();
  const ticketsByReservationId = new Map<string, TicketRecord[]>();
  const idempotencyResponses = new Map<string, unknown>();

  const cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const reservation of reservations.values()) {
      if ((reservation.status === "pending" || reservation.status === "payment_pending") && reservation.expiresAtMs <= now) {
        expireReservation(reservation);
      }
    }
  }, 30_000);

  const server = createServer(async (req, res) => {
    try {
      const method = req.method ?? "GET";
      const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
      const userId = extractUserId(req);

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

      if (method === "POST" && url.pathname === "/tickets/reserve") {
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

        const body = await readJson<ReserveBody>(req);
        if (!body.eventId || !body.ticketTypeId || typeof body.quantity !== "number") {
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

        const inventory = inventoryByTicketType.get(body.ticketTypeId);
        if (!inventory) {
          return sendJson(res, 400, {
            success: false,
            error: {
              code: "UNKNOWN_TICKET_TYPE",
              message: "Ticket type not supported"
            }
          });
        }

        if (inventory.eventId !== body.eventId) {
          return sendJson(res, 400, {
            success: false,
            error: {
              code: "EVENT_TICKET_TYPE_MISMATCH",
              message: "ticketTypeId does not belong to eventId"
            }
          });
        }

        if (inventoryAvailable(inventory) < body.quantity) {
          return sendJson(res, 409, {
            success: false,
            error: {
              code: "INSUFFICIENT_INVENTORY",
              message: "Not enough inventory for reservation"
            }
          });
        }

        inventory.lockedCount += body.quantity;
        const now = Date.now();
        const reservation: Reservation = {
          id: `res_${randomUUID().replace(/-/g, "")}`,
          userId,
          eventId: body.eventId,
          ticketTypeId: body.ticketTypeId,
          quantity: body.quantity,
          unitPrice: inventory.unitPrice,
          totalAmount: inventory.unitPrice * body.quantity,
          status: "pending",
          expiresAtMs: now + config.reservationTtlSec * 1000,
          createdAt: toIso(now),
          inventoryLocked: true
        };

        reservations.set(reservation.id, reservation);

        const response = {
          success: true,
          data: reservationResponse(reservation)
        };

        if (idempotencyScope) {
          idempotencyResponses.set(idempotencyScope, response);
        }

        return sendJson(res, 200, response);
      }

      if (method === "POST" && url.pathname === "/tickets/purchase") {
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

        const body = await readJson<PurchaseBody>(req);
        if (!body.reservationId || !body.paymentMethod) {
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

        if (Date.now() > reservation.expiresAtMs && reservation.status !== "paid") {
          expireReservation(reservation);
          return sendJson(res, 400, {
            success: false,
            error: {
              code: "RESERVATION_EXPIRED",
              message: "Reservation expired"
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

        reservation.status = "payment_pending";
        reservation.paymentMethod = body.paymentMethod;
        reservation.paymentInitiatedAt = new Date().toISOString();
        reservation.paymentIntentId = reservation.paymentIntentId ?? `pay_${randomUUID().replace(/-/g, "")}`;

        const response = {
          success: true,
          data: {
            ...reservationResponse(reservation),
            paymentGatewayStatus: "pending"
          }
        };

        if (idempotencyScope) {
          idempotencyResponses.set(idempotencyScope, response);
        }

        return sendJson(res, 200, response);
      }

      const confirmMatch = url.pathname.match(/^\/tickets\/purchase\/([^/]+)\/confirm$/);
      if (method === "POST" && confirmMatch) {
        if (extractInternalApiKey(req) !== config.internalApiKey) {
          return sendJson(res, 401, {
            success: false,
            error: {
              code: "UNAUTHORIZED_INTERNAL",
              message: "Missing or invalid x-internal-api-key"
            }
          });
        }

        const idempotencyScope = createIdempotencyScope(method, url.pathname, extractIdempotencyKey(req));
        if (idempotencyScope && idempotencyResponses.has(idempotencyScope)) {
          return sendJson(res, 200, idempotencyResponses.get(idempotencyScope));
        }

        const reservationId = confirmMatch[1];
        const body = await readJson<PurchaseConfirmBody>(req);
        const reservation = reservations.get(reservationId);

        if (!reservation) {
          return sendJson(res, 404, {
            success: false,
            error: {
              code: "RESERVATION_NOT_FOUND",
              message: "Reservation not found"
            }
          });
        }

        if (!normalizePaymentConfirmation(body.status)) {
          return sendJson(res, 400, {
            success: false,
            error: {
              code: "PAYMENT_NOT_CONFIRMED",
              message: "Webhook status does not indicate successful payment"
            }
          });
        }

        if (Date.now() > reservation.expiresAtMs && reservation.status !== "paid") {
          expireReservation(reservation);
          return sendJson(res, 400, {
            success: false,
            error: {
              code: "RESERVATION_EXPIRED",
              message: "Reservation expired"
            }
          });
        }

        if (reservation.status !== "payment_pending" && reservation.status !== "paid") {
          return sendJson(res, 400, {
            success: false,
            error: {
              code: "RESERVATION_NOT_PENDING_PAYMENT",
              message: "Reservation is not awaiting payment confirmation"
            }
          });
        }

        if (reservation.status === "payment_pending") {
          releaseReservationLock(reservation);
          const inventory = inventoryByTicketType.get(reservation.ticketTypeId);
          if (inventory) {
            inventory.soldCount += reservation.quantity;
          }

          reservation.status = "paid";
          reservation.paidAt = new Date().toISOString();
          reservation.gatewayTransactionId = body.gatewayTransactionId?.trim() || `gw_${randomUUID().replace(/-/g, "")}`;
        }

        const existingTickets = ticketsByReservationId.get(reservation.id);
        if (!existingTickets) {
          const userTickets = ticketsByUser.get(reservation.userId) ?? [];
          const mintedTickets: TicketRecord[] = [];

          for (let i = 0; i < reservation.quantity; i += 1) {
            const ticket: TicketRecord = {
              tokenId: `mock_${randomUUID().replace(/-/g, "")}`,
              eventId: reservation.eventId,
              ticketTypeId: reservation.ticketTypeId,
              ownerUserId: reservation.userId,
              seatInfo: `GA-${String(userTickets.length + i + 1).padStart(4, "0")}`,
              reservationId: reservation.id,
              createdAt: new Date().toISOString()
            };

            mintedTickets.push(ticket);
            userTickets.push(ticket);
          }

          ticketsByUser.set(reservation.userId, userTickets);
          ticketsByReservationId.set(reservation.id, mintedTickets);
        }

        const ticketsIssued = ticketsByReservationId.get(reservation.id)?.length ?? 0;
        const response = {
          success: true,
          data: {
            ...reservationResponse(reservation),
            ticketsIssued,
            paymentGatewayStatus: "confirmed"
          }
        };

        if (idempotencyScope) {
          idempotencyResponses.set(idempotencyScope, response);
        }

        return sendJson(res, 200, response);
      }

      const reservationMatch = url.pathname.match(/^\/tickets\/reservations\/([^/]+)$/);
      if (method === "GET" && reservationMatch) {
        if (!userId) {
          return sendJson(res, 401, {
            success: false,
            error: {
              code: "UNAUTHORIZED",
              message: "Missing x-user-id header"
            }
          });
        }

        const reservation = reservations.get(reservationMatch[1]);
        if (!reservation || reservation.userId !== userId) {
          return sendJson(res, 404, {
            success: false,
            error: {
              code: "RESERVATION_NOT_FOUND",
              message: "Reservation not found"
            }
          });
        }

        if ((reservation.status === "pending" || reservation.status === "payment_pending") && Date.now() > reservation.expiresAtMs) {
          expireReservation(reservation);
        }

        return sendJson(res, 200, {
          success: true,
          data: reservationResponse(reservation)
        });
      }

      if (method === "GET" && url.pathname === "/tickets/me") {
        if (!userId) {
          return sendJson(res, 401, {
            success: false,
            error: {
              code: "UNAUTHORIZED",
              message: "Missing x-user-id header"
            }
          });
        }

        const tickets = ticketsByUser.get(userId) ?? [];
        return sendJson(res, 200, {
          success: true,
          data: tickets
        });
      }

      const ticketDetailMatch = url.pathname.match(/^\/tickets\/([^/]+)$/);
      if (method === "GET" && ticketDetailMatch) {
        if (!userId) {
          return sendJson(res, 401, {
            success: false,
            error: {
              code: "UNAUTHORIZED",
              message: "Missing x-user-id header"
            }
          });
        }

        const tokenId = ticketDetailMatch[1];
        const tickets = ticketsByUser.get(userId) ?? [];
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

        const tokenId = qrMatch[1];
        const tickets = ticketsByUser.get(userId) ?? [];
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

        const response = {
          success: true,
          data: {
            tokenId: ticket.tokenId,
            eventId: ticket.eventId,
            timestamp: Date.now(),
            nonce: randomUUID(),
            walletAddress: `mock-wallet-${ticket.ownerUserId}`,
            signature: `0x${randomUUID().replace(/-/g, "")}${randomUUID().replace(/-/g, "")}`
          }
        };

        if (idempotencyScope) {
          idempotencyResponses.set(idempotencyScope, response);
        }

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

  server.on("close", () => {
    clearInterval(cleanupTimer);
  });

  return server;
}
