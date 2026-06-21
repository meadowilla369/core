import { createHmac, randomUUID } from "node:crypto";
import { createServer, IncomingMessage, ServerResponse } from "node:http";

import {
  createPostgresPool,
  createRedisClientFromEnv,
  queryMany,
  queryOne,
  withPostgresTransaction
} from "@ticket-platform/local-infra";
import type { Pool, PoolClient } from "pg";
import type { RedisClientType } from "redis";

import type { TicketingConfig } from "./config.js";
import { log } from "./logger.js";
import { resolveQrTicket } from "./qr-ownership.js";

interface ReserveBody {
  eventId?: string;
  ticketTypeId?: string;
  quantity?: number;
}

interface PurchaseConfirmBody {
  gatewayTransactionId?: string;
  status?: string;
}

type ReservationStatus = "pending" | "paid" | "expired";

interface ReservationRow {
  id: string;
  user_id: string;
  event_id: string; // from JOIN ticket_types
  ticket_type_id: string;
  quantity: number | string;
  unit_price: number | string; // from JOIN ticket_types
  total_amount: number | string; // computed: unit_price * quantity
  status: ReservationStatus;
  expires_at: string | Date;
}

interface InventoryRow {
  ticket_type_id: string;
  event_id: string;
  event_status: string;
  unit_price: number | string;
  quantity: number | string;
  sold_count: number | string;
  locked_count: number | string;
}

interface ReservationRecord {
  id: string;
  userId: string;
  eventId: string;
  ticketTypeId: string;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
  status: ReservationStatus;
  expiresAtMs: number;
}

interface SyncedTokenRecord {
  tokenId: string;
  eventId?: string | null;
  ownerWalletAddress: string | null;
  ownerUserId: string | null;
  isRefunded: boolean;
}

interface ApiSuccessResponse<T> {
  success: true;
  data: T;
}

class InvalidJsonError extends Error {
  constructor() {
    super("Invalid JSON payload");
    this.name = "InvalidJsonError";
  }
}

const MAX_TICKETS_PER_RESERVATION = 4;
const IDEMPOTENCY_TTL_SEC = 24 * 60 * 60;

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

function extractOwnerWalletAddress(req: IncomingMessage): string | null {
  return extractSingleHeader(req, "x-owner-wallet-address");
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

  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new InvalidJsonError();
  }
}

function toIso(value: string | Date): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function inventoryAvailable(inventory: InventoryRow): number {
  return Math.max(
    Number(inventory.quantity) - Number(inventory.sold_count) - Number(inventory.locked_count),
    0
  );
}

function normalizePaymentConfirmation(status: string | undefined): boolean {
  if (!status) {
    return true;
  }

  const normalized = status.trim().toLowerCase();
  return (
    normalized === "paid" ||
    normalized === "success" ||
    normalized === "succeeded" ||
    normalized === "confirmed"
  );
}

function mapReservation(row: ReservationRow): ReservationRecord {
  return {
    id: row.id,
    userId: row.user_id,
    eventId: row.event_id,
    ticketTypeId: row.ticket_type_id,
    quantity: Number(row.quantity),
    unitPrice: Number(row.unit_price),
    totalAmount: Number(row.total_amount),
    status: row.status,
    expiresAtMs: new Date(row.expires_at).getTime()
  };
}

async function getSyncedToken(
  config: TicketingConfig,
  tokenId: string
): Promise<SyncedTokenRecord | null> {
  const response = await fetch(
    `${config.contractSyncServiceBaseUrl}/internal/contracts/tokens/${encodeURIComponent(tokenId)}`,
    { method: "GET" }
  );

  if (!response.ok) {
    return null;
  }

  const payload = (await response.json()) as ApiSuccessResponse<SyncedTokenRecord>;
  return payload.success ? payload.data : null;
}

function reservationResponse(reservation: ReservationRecord): Record<string, unknown> {
  return {
    reservationId: reservation.id,
    eventId: reservation.eventId,
    ticketTypeId: reservation.ticketTypeId,
    quantity: reservation.quantity,
    unitPrice: reservation.unitPrice,
    totalAmount: reservation.totalAmount,
    status: reservation.status,
    expiresAt: new Date(reservation.expiresAtMs).toISOString()
  };
}

async function getCachedResponse(
  redis: RedisClientType,
  scope: string | null
): Promise<unknown | null> {
  if (!scope) {
    return null;
  }

  const raw = await redis.get(`ticketing:idempotency:${scope}`);
  return raw ? JSON.parse(raw) : null;
}

async function setCachedResponse(
  redis: RedisClientType,
  scope: string | null,
  payload: unknown
): Promise<void> {
  if (!scope) {
    return;
  }

  await redis.set(`ticketing:idempotency:${scope}`, JSON.stringify(payload), {
    EX: IDEMPOTENCY_TTL_SEC
  });
}

async function ensureSchema(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ticket_inventory (
      ticket_type_id TEXT PRIMARY KEY,
      sold_count INTEGER NOT NULL DEFAULT 0,
      locked_count INTEGER NOT NULL DEFAULT 0,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS reservations (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      ticket_type_id TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('pending', 'paid', 'expired')),
      expires_at TIMESTAMPTZ NOT NULL
    );
  `);

  await pool.query(`
    SELECT 1;
  `);
}

const INVENTORY_SELECT = `
  SELECT
    ti.ticket_type_id,
    tt.event_id,
    e.status AS event_status,
    tt.unit_price,
    tt.quantity,
    ti.sold_count,
    ti.locked_count
  FROM ticket_inventory ti
  INNER JOIN ticket_types tt ON tt.id = ti.ticket_type_id
  INNER JOIN events e ON e.id = tt.event_id
`;

const RESERVATION_SELECT = `
  SELECT r.id, r.user_id, r.ticket_type_id, r.quantity, r.status, r.expires_at,
         tt.event_id, tt.unit_price, tt.unit_price * r.quantity AS total_amount
  FROM reservations r
  JOIN ticket_types tt ON tt.id = r.ticket_type_id
`;

async function loadReservation(
  client: Pool | PoolClient,
  reservationId: string
): Promise<ReservationRecord | null> {
  const row = await queryOne<ReservationRow>(client, `${RESERVATION_SELECT} WHERE r.id = $1`, [
    reservationId
  ]);

  return row ? mapReservation(row) : null;
}

async function expireReservationById(pool: Pool, reservationId: string): Promise<void> {
  await withPostgresTransaction(pool, async (client) => {
    const row = await queryOne<{
      id: string;
      ticket_type_id: string;
      quantity: number | string;
      status: string;
    }>(
      client,
      `SELECT id, ticket_type_id, quantity, status FROM reservations WHERE id = $1 FOR UPDATE`,
      [reservationId]
    );

    if (!row || row.status === "expired" || row.status === "paid") {
      return;
    }

    await client.query(
      `UPDATE ticket_inventory SET locked_count = GREATEST(locked_count - $2, 0), updated_at = NOW() WHERE ticket_type_id = $1`,
      [row.ticket_type_id, Number(row.quantity)]
    );

    await client.query(`UPDATE reservations SET status = 'expired' WHERE id = $1`, [reservationId]);
  });
}

async function expireDueReservations(pool: Pool): Promise<void> {
  const rows = await queryMany<{ id: string }>(
    pool,
    `SELECT id FROM reservations WHERE status = 'pending' AND expires_at <= NOW() ORDER BY expires_at ASC LIMIT 50`
  );

  for (const row of rows) {
    await expireReservationById(pool, row.id);
  }
}

export async function createTicketingServer(config: TicketingConfig) {
  const pool = createPostgresPool(process.env);
  const redis = createRedisClientFromEnv(process.env);
  await redis.connect();
  await ensureSchema(pool);

  const cleanupTimer = setInterval(() => {
    void expireDueReservations(pool).catch((error) => {
      log(config.serviceName, "error", "Failed to expire reservations", {
        error: error instanceof Error ? error.message : String(error)
      });
    });
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
            storage: {
              primary: "postgres",
              cache: "redis"
            },
            inventorySource: "event-service",
            timestamp: new Date().toISOString()
          }
        });
      }

      // Inventory status endpoint
      if (method === "GET" && url.pathname === "/tickets/inventory") {
        const inventory = await queryMany<InventoryRow>(
          pool,
          `${INVENTORY_SELECT} ORDER BY tt.event_id, ti.ticket_type_id`
        );

        return sendJson(res, 200, {
          success: true,
          data: inventory.map((row) => ({
            ticketTypeId: row.ticket_type_id,
            eventId: row.event_id,
            unitPrice: Number(row.unit_price),
            quantity: Number(row.quantity),
            soldCount: Number(row.sold_count),
            lockedCount: Number(row.locked_count),
            available: inventoryAvailable(row)
          }))
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

        const idempotencyScope = createIdempotencyScope(
          method,
          url.pathname,
          extractIdempotencyKey(req)
        );
        const cached = await getCachedResponse(redis, idempotencyScope);
        if (cached) {
          return sendJson(res, 200, cached);
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

        const reservationId = `res_${randomUUID().replace(/-/g, "")}`;
        const nowMs = Date.now();
        const quantity = body.quantity;
        const eventId = body.eventId;
        const ticketTypeId = body.ticketTypeId;

        const reservation = await withPostgresTransaction(pool, async (client) => {
          let inventory = await queryOne<InventoryRow>(
            client,
            `
              ${INVENTORY_SELECT}
              WHERE ti.ticket_type_id = $1
              FOR UPDATE
            `,
            [ticketTypeId]
          );

          if (!inventory) {
            const inserted = await client.query(
              `INSERT INTO ticket_inventory (ticket_type_id, sold_count, locked_count, updated_at)
               SELECT id, 0, 0, NOW() FROM ticket_types WHERE id = $1
               ON CONFLICT (ticket_type_id) DO NOTHING`,
              [ticketTypeId]
            );
            if ((inserted.rowCount ?? 0) === 0) {
              throw new Error("UNKNOWN_TICKET_TYPE");
            }
            inventory = await queryOne<InventoryRow>(
              client,
              `${INVENTORY_SELECT} WHERE ti.ticket_type_id = $1 FOR UPDATE`,
              [ticketTypeId]
            );
            if (!inventory) {
              throw new Error("UNKNOWN_TICKET_TYPE");
            }
          }

          if (inventory.event_id !== eventId) {
            throw new Error("EVENT_TICKET_TYPE_MISMATCH");
          }

          if (inventory.event_status !== "active") {
            throw new Error("TICKET_TYPE_NOT_AVAILABLE");
          }

          if (inventoryAvailable(inventory) < quantity) {
            throw new Error("INSUFFICIENT_INVENTORY");
          }

          await client.query(
            `
              UPDATE ticket_inventory
              SET locked_count = locked_count + $2, updated_at = NOW()
              WHERE ticket_type_id = $1
            `,
            [ticketTypeId, quantity]
          );

          const expiresAt = new Date(nowMs + config.reservationTtlSec * 1000).toISOString();
          await client.query(
            `INSERT INTO reservations (id, user_id, ticket_type_id, quantity, status, expires_at)
             VALUES ($1, $2, $3, $4, 'pending', $5::timestamptz)`,
            [reservationId, userId, ticketTypeId, quantity, expiresAt]
          );

          const created = await loadReservation(client, reservationId);
          if (!created) {
            throw new Error("RESERVATION_CREATE_FAILED");
          }

          return created;
        }).catch((error: Error) => {
          if (error.message === "UNKNOWN_TICKET_TYPE") {
            return null;
          }
          if (error.message === "EVENT_TICKET_TYPE_MISMATCH") {
            throw Object.assign(new Error(error.message), { statusCode: 400 });
          }
          if (error.message === "TICKET_TYPE_NOT_AVAILABLE") {
            throw Object.assign(new Error(error.message), { statusCode: 409 });
          }
          if (error.message === "INSUFFICIENT_INVENTORY") {
            throw Object.assign(new Error(error.message), { statusCode: 409 });
          }
          throw error;
        });

        if (!reservation) {
          return sendJson(res, 400, {
            success: false,
            error: {
              code: "UNKNOWN_TICKET_TYPE",
              message: "Ticket type not supported"
            }
          });
        }

        const response = {
          success: true,
          data: reservationResponse(reservation)
        };

        await setCachedResponse(redis, idempotencyScope, response);
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

        const idempotencyScope = createIdempotencyScope(
          method,
          url.pathname,
          extractIdempotencyKey(req)
        );
        const cached = await getCachedResponse(redis, idempotencyScope);
        if (cached) {
          return sendJson(res, 200, cached);
        }

        const reservationId = confirmMatch[1];
        const body = await readJson<PurchaseConfirmBody>(req);

        if (!normalizePaymentConfirmation(body.status)) {
          return sendJson(res, 400, {
            success: false,
            error: {
              code: "PAYMENT_NOT_CONFIRMED",
              message: "Webhook status does not indicate successful payment"
            }
          });
        }

        const response = await withPostgresTransaction(pool, async (client) => {
          const reservationRow = await queryOne<ReservationRow>(
            client,
            `${RESERVATION_SELECT} WHERE r.id = $1 FOR UPDATE`,
            [reservationId]
          );

          if (!reservationRow) {
            throw Object.assign(new Error("RESERVATION_NOT_FOUND"), { statusCode: 404 });
          }

          if (reservationRow.status === "expired") {
            throw Object.assign(new Error("RESERVATION_EXPIRED"), { statusCode: 400 });
          }

          if (reservationRow.status === "paid") {
            const updated = await loadReservation(client, reservationId);
            return {
              success: true,
              confirmedTicketTypeId: reservationRow.ticket_type_id as string,
              confirmedQuantity: Number(reservationRow.quantity),
              data: {
                ...reservationResponse(updated as ReservationRecord),
                paymentGatewayStatus: "confirmed"
              }
            };
          }

          if (Date.now() > new Date(reservationRow.expires_at).getTime()) {
            await client.query(
              `UPDATE ticket_inventory SET locked_count = GREATEST(locked_count - $2, 0), updated_at = NOW() WHERE ticket_type_id = $1`,
              [reservationRow.ticket_type_id, Number(reservationRow.quantity)]
            );
            await client.query(`UPDATE reservations SET status = 'expired' WHERE id = $1`, [
              reservationId
            ]);
            throw Object.assign(new Error("RESERVATION_EXPIRED"), { statusCode: 400 });
          }

          if (reservationRow.status !== "pending") {
            throw Object.assign(new Error("RESERVATION_NOT_PENDING"), { statusCode: 400 });
          }

          await client.query(
            `UPDATE ticket_inventory
             SET sold_count = sold_count + $2, locked_count = GREATEST(locked_count - $2, 0), updated_at = NOW()
             WHERE ticket_type_id = $1`,
            [reservationRow.ticket_type_id, Number(reservationRow.quantity)]
          );

          await client.query(`UPDATE reservations SET status = 'paid' WHERE id = $1`, [
            reservationId
          ]);

          const updated = await loadReservation(client, reservationId);

          return {
            success: true,
            confirmedTicketTypeId: reservationRow.ticket_type_id as string,
            confirmedQuantity: Number(reservationRow.quantity),
            data: {
              ...reservationResponse(updated as ReservationRecord),
              ticketsIssued: Number(reservationRow.quantity),
              paymentGatewayStatus: "confirmed"
            }
          };
        });

        const clientResponse = { success: response.success, data: response.data };
        await setCachedResponse(redis, idempotencyScope, clientResponse);
        return sendJson(res, 200, clientResponse);
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

        const reservation = await loadReservation(pool, reservationMatch[1]);
        if (!reservation || reservation.userId !== userId) {
          return sendJson(res, 404, {
            success: false,
            error: {
              code: "RESERVATION_NOT_FOUND",
              message: "Reservation not found"
            }
          });
        }

        if (reservation.status === "pending" && Date.now() > reservation.expiresAtMs) {
          await expireReservationById(pool, reservation.id);
          const refreshed = await loadReservation(pool, reservation.id);
          return sendJson(res, 200, {
            success: true,
            data: reservationResponse(refreshed as ReservationRecord)
          });
        }

        return sendJson(res, 200, {
          success: true,
          data: reservationResponse(reservation)
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

        const idempotencyScope = createIdempotencyScope(
          method,
          url.pathname,
          extractIdempotencyKey(req)
        );
        const cached = await getCachedResponse(redis, idempotencyScope);
        if (cached) {
          return sendJson(res, 200, cached);
        }

        const ownerWalletAddress = extractOwnerWalletAddress(req);
        const syncedToken = await getSyncedToken(config, qrMatch[1]);
        const qrTicket = resolveQrTicket({
          tokenId: qrMatch[1],
          ownerWalletAddress,
          syncedToken,
          ticketingTicket: null
        });

        if (!qrTicket) {
          return sendJson(res, 404, {
            success: false,
            error: {
              code: "TICKET_NOT_FOUND",
              message: "Ticket not found"
            }
          });
        }

        const qrTimestamp = Date.now();
        const qrNonce = randomUUID();
        const qrPayload = `${qrTicket.tokenId}.${qrTicket.eventId}.${qrTimestamp}.${qrNonce}.${qrTicket.walletAddress}`;
        const qrSignature = createHmac("sha256", config.qrSignatureSecret)
          .update(qrPayload, "utf8")
          .digest("hex");

        const response = {
          success: true,
          data: {
            tokenId: qrTicket.tokenId,
            eventId: qrTicket.eventId,
            timestamp: qrTimestamp,
            nonce: qrNonce,
            walletAddress: qrTicket.walletAddress,
            signature: qrSignature
          }
        };

        await setCachedResponse(redis, idempotencyScope, response);
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
      if (error instanceof InvalidJsonError) {
        return sendJson(res, 400, {
          success: false,
          error: {
            code: "INVALID_JSON",
            message: "Request body must be valid JSON"
          }
        });
      }

      const statusCode =
        typeof error === "object" && error && "statusCode" in error
          ? Number((error as { statusCode: number }).statusCode)
          : 500;
      const code = error instanceof Error ? error.message : "INTERNAL_ERROR";

      if (code === "EVENT_TICKET_TYPE_MISMATCH") {
        return sendJson(res, 400, {
          success: false,
          error: {
            code,
            message: "ticketTypeId does not belong to eventId"
          }
        });
      }

      if (code === "INSUFFICIENT_INVENTORY") {
        return sendJson(res, 409, {
          success: false,
          error: {
            code,
            message: "Not enough inventory for reservation"
          }
        });
      }

      if (code === "RESERVATION_NOT_FOUND") {
        return sendJson(res, 404, {
          success: false,
          error: {
            code,
            message: "Reservation not found"
          }
        });
      }

      if (code === "RESERVATION_EXPIRED") {
        return sendJson(res, 400, {
          success: false,
          error: {
            code,
            message: "Reservation expired"
          }
        });
      }

      if (code === "RESERVATION_NOT_PENDING") {
        return sendJson(res, 400, {
          success: false,
          error: {
            code,
            message: "Reservation is not pending"
          }
        });
      }

      log(config.serviceName, "error", "Unhandled request error", {
        error: error instanceof Error ? error.message : String(error),
        statusCode
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
    void redis.quit();
    void pool.end();
  });

  return server;
}
