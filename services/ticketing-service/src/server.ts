import { randomUUID } from "node:crypto";
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

interface ReservationRow {
  id: string;
  user_id: string;
  event_id: string;
  ticket_type_id: string;
  quantity: number | string;
  unit_price: number | string;
  total_amount: number | string;
  status: ReservationStatus;
  expires_at: string | Date;
  created_at: string | Date;
  payment_intent_id: string | null;
  payment_method: string | null;
  payment_initiated_at: string | Date | null;
  paid_at: string | Date | null;
  gateway_transaction_id: string | null;
  inventory_locked: boolean;
}

interface TicketRow {
  token_id: string;
  event_id: string;
  ticket_type_id: string;
  owner_user_id: string;
  seat_info: string;
  reservation_id: string;
  created_at: string | Date;
}

interface InventoryRow {
  ticket_type_id: string;
  event_id: string;
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

interface EventServiceTicketType {
  id: string;
  name: string;
  price: number;
  quantity: number;
  soldCount: number;
}

interface EventServiceEvent {
  id: string;
  ticketTypes: EventServiceTicketType[];
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
    expiresAtMs: new Date(row.expires_at).getTime(),
    createdAt: toIso(row.created_at),
    paymentIntentId: row.payment_intent_id ?? undefined,
    paymentMethod: row.payment_method ?? undefined,
    paymentInitiatedAt: row.payment_initiated_at ? toIso(row.payment_initiated_at) : undefined,
    paidAt: row.paid_at ? toIso(row.paid_at) : undefined,
    gatewayTransactionId: row.gateway_transaction_id ?? undefined,
    inventoryLocked: row.inventory_locked
  };
}

function mapTicket(row: TicketRow): TicketRecord {
  return {
    tokenId: row.token_id,
    eventId: row.event_id,
    ticketTypeId: row.ticket_type_id,
    ownerUserId: row.owner_user_id,
    seatInfo: row.seat_info,
    reservationId: row.reservation_id,
    createdAt: toIso(row.created_at)
  };
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
    paymentIntentId: reservation.paymentIntentId,
    paymentMethod: reservation.paymentMethod,
    gatewayTransactionId: reservation.gatewayTransactionId,
    expiresAt: new Date(reservation.expiresAtMs).toISOString(),
    createdAt: reservation.createdAt,
    paymentInitiatedAt: reservation.paymentInitiatedAt,
    paidAt: reservation.paidAt
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
      event_id TEXT NOT NULL,
      unit_price INTEGER NOT NULL,
      quantity INTEGER NOT NULL,
      sold_count INTEGER NOT NULL DEFAULT 0,
      locked_count INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS reservations (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      event_id TEXT NOT NULL,
      ticket_type_id TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      unit_price INTEGER NOT NULL,
      total_amount INTEGER NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('pending', 'payment_pending', 'paid', 'expired')),
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL,
      payment_intent_id TEXT,
      payment_method TEXT,
      payment_initiated_at TIMESTAMPTZ,
      paid_at TIMESTAMPTZ,
      gateway_transaction_id TEXT,
      inventory_locked BOOLEAN NOT NULL DEFAULT TRUE,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS tickets (
      token_id TEXT PRIMARY KEY,
      event_id TEXT NOT NULL,
      ticket_type_id TEXT NOT NULL,
      owner_user_id TEXT NOT NULL,
      seat_info TEXT NOT NULL,
      reservation_id TEXT NOT NULL REFERENCES reservations(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}

/**
 * Sync inventory from event-service.
 * Fetches all events and their ticket types from event-service, then upserts
 * ticket_inventory rows. For new ticket types, inserts fresh rows. For existing
 * ticket types, updates quantity and unit_price from event-service but preserves
 * the local sold_count and locked_count (operational state owned by ticketing).
 */
async function syncInventoryFromEventService(
  pool: Pool,
  eventServiceBaseUrl: string,
  serviceName: string
): Promise<{ synced: number; events: number }> {
  const response = await fetch(`${eventServiceBaseUrl}/events`);
  if (!response.ok) {
    throw new Error(`event-service /events returned ${response.status}`);
  }

  const body = (await response.json()) as { success: boolean; data: Array<{ id: string }> };
  if (!body.success || !Array.isArray(body.data)) {
    throw new Error("event-service /events returned unexpected body");
  }

  let synced = 0;
  for (const eventSummary of body.data) {
    const detailResponse = await fetch(`${eventServiceBaseUrl}/events/${eventSummary.id}`);
    if (!detailResponse.ok) {
      log(serviceName, "warn", "Failed to fetch event detail for sync", {
        eventId: eventSummary.id,
        status: detailResponse.status
      });
      continue;
    }

    const detailBody = (await detailResponse.json()) as {
      success: boolean;
      data: EventServiceEvent;
    };

    if (!detailBody.success || !detailBody.data?.ticketTypes) {
      continue;
    }

    const event = detailBody.data;
    for (const tt of event.ticketTypes) {
      await pool.query(
        `
        INSERT INTO ticket_inventory (ticket_type_id, event_id, unit_price, quantity, sold_count, locked_count)
        VALUES ($1, $2, $3, $4, $5, 0)
        ON CONFLICT (ticket_type_id) DO UPDATE SET
          unit_price = EXCLUDED.unit_price,
          quantity = EXCLUDED.quantity,
          updated_at = NOW()
        `,
        [tt.id, event.id, tt.price, tt.quantity, tt.soldCount]
      );
      synced++;
    }
  }

  return { synced, events: body.data.length };
}

async function loadReservation(
  client: Pool | PoolClient,
  reservationId: string
): Promise<ReservationRecord | null> {
  const row = await queryOne<ReservationRow>(
    client,
    `
      SELECT id, user_id, event_id, ticket_type_id, quantity, unit_price, total_amount, status, expires_at, created_at,
             payment_intent_id, payment_method, payment_initiated_at, paid_at, gateway_transaction_id, inventory_locked
      FROM reservations
      WHERE id = $1
    `,
    [reservationId]
  );

  return row ? mapReservation(row) : null;
}

async function expireReservationById(pool: Pool, reservationId: string): Promise<void> {
  await withPostgresTransaction(pool, async (client) => {
    const reservation = await queryOne<ReservationRow>(
      client,
      `
        SELECT id, user_id, event_id, ticket_type_id, quantity, unit_price, total_amount, status, expires_at, created_at,
               payment_intent_id, payment_method, payment_initiated_at, paid_at, gateway_transaction_id, inventory_locked
        FROM reservations
        WHERE id = $1
        FOR UPDATE
      `,
      [reservationId]
    );

    if (!reservation || reservation.status === "expired" || reservation.status === "paid") {
      return;
    }

    if (reservation.inventory_locked) {
      await client.query(
        `
          UPDATE ticket_inventory
          SET locked_count = GREATEST(locked_count - $2, 0), updated_at = NOW()
          WHERE ticket_type_id = $1
        `,
        [reservation.ticket_type_id, Number(reservation.quantity)]
      );
    }

    await client.query(
      `
        UPDATE reservations
        SET status = 'expired', inventory_locked = FALSE, updated_at = NOW()
        WHERE id = $1
      `,
      [reservationId]
    );
  });
}

async function expireDueReservations(pool: Pool): Promise<void> {
  const rows = await queryMany<{ id: string }>(
    pool,
    `SELECT id FROM reservations WHERE status IN ('pending', 'payment_pending') AND expires_at <= NOW() ORDER BY expires_at ASC LIMIT 50`
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

  const eventServiceBaseUrl = process.env.EVENT_SERVICE_BASE_URL ?? "http://127.0.0.1:3004";

  // Sync inventory from event-service on startup
  try {
    const result = await syncInventoryFromEventService(
      pool,
      eventServiceBaseUrl,
      config.serviceName
    );
    log(config.serviceName, "info", "Inventory synced from event-service", {
      events: result.events,
      ticketTypesSynced: result.synced
    });
  } catch (error) {
    log(
      config.serviceName,
      "warn",
      "Failed to sync inventory from event-service on startup; will use existing inventory if any",
      {
        error: error instanceof Error ? error.message : String(error)
      }
    );
  }

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

      // Manual inventory sync endpoint
      if (method === "POST" && url.pathname === "/tickets/inventory/sync") {
        try {
          const result = await syncInventoryFromEventService(
            pool,
            eventServiceBaseUrl,
            config.serviceName
          );
          return sendJson(res, 200, {
            success: true,
            data: {
              events: result.events,
              ticketTypesSynced: result.synced,
              syncedAt: new Date().toISOString()
            }
          });
        } catch (error) {
          return sendJson(res, 502, {
            success: false,
            error: {
              code: "INVENTORY_SYNC_FAILED",
              message: error instanceof Error ? error.message : "Failed to sync from event-service"
            }
          });
        }
      }

      // Inventory status endpoint
      if (method === "GET" && url.pathname === "/tickets/inventory") {
        const inventory = await queryMany<InventoryRow>(
          pool,
          `SELECT ticket_type_id, event_id, unit_price, quantity, sold_count, locked_count FROM ticket_inventory ORDER BY event_id, ticket_type_id`
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
          const inventory = await queryOne<InventoryRow>(
            client,
            `
              SELECT ticket_type_id, event_id, unit_price, quantity, sold_count, locked_count
              FROM ticket_inventory
              WHERE ticket_type_id = $1
              FOR UPDATE
            `,
            [ticketTypeId]
          );

          if (!inventory) {
            throw new Error("UNKNOWN_TICKET_TYPE");
          }

          if (inventory.event_id !== eventId) {
            throw new Error("EVENT_TICKET_TYPE_MISMATCH");
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
            `
              INSERT INTO reservations (
                id, user_id, event_id, ticket_type_id, quantity, unit_price, total_amount, status,
                expires_at, created_at, inventory_locked
              )
              VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', $8::timestamptz, $9::timestamptz, TRUE)
            `,
            [
              reservationId,
              userId,
              eventId,
              ticketTypeId,
              quantity,
              Number(inventory.unit_price),
              Number(inventory.unit_price) * quantity,
              expiresAt,
              new Date(nowMs).toISOString()
            ]
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

        const idempotencyScope = createIdempotencyScope(
          method,
          url.pathname,
          extractIdempotencyKey(req)
        );
        const cached = await getCachedResponse(redis, idempotencyScope);
        if (cached) {
          return sendJson(res, 200, cached);
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

        const reservationId = body.reservationId;
        const paymentMethod = body.paymentMethod;

        const result = await withPostgresTransaction(pool, async (client) => {
          const reservationRow = await queryOne<ReservationRow>(
            client,
            `
              SELECT id, user_id, event_id, ticket_type_id, quantity, unit_price, total_amount, status, expires_at, created_at,
                     payment_intent_id, payment_method, payment_initiated_at, paid_at, gateway_transaction_id, inventory_locked
              FROM reservations
              WHERE id = $1
              FOR UPDATE
            `,
            [reservationId]
          );

          if (!reservationRow || reservationRow.user_id !== userId) {
            throw Object.assign(new Error("RESERVATION_NOT_FOUND"), { statusCode: 404 });
          }

          if (
            Date.now() > new Date(reservationRow.expires_at).getTime() &&
            reservationRow.status !== "paid"
          ) {
            if (reservationRow.inventory_locked) {
              await client.query(
                `UPDATE ticket_inventory SET locked_count = GREATEST(locked_count - $2, 0), updated_at = NOW() WHERE ticket_type_id = $1`,
                [reservationRow.ticket_type_id, Number(reservationRow.quantity)]
              );
            }
            await client.query(
              `UPDATE reservations SET status = 'expired', inventory_locked = FALSE, updated_at = NOW() WHERE id = $1`,
              [reservationId]
            );
            throw Object.assign(new Error("RESERVATION_EXPIRED"), { statusCode: 400 });
          }

          if (reservationRow.status !== "pending") {
            throw Object.assign(new Error("RESERVATION_NOT_PENDING"), { statusCode: 400 });
          }

          const paymentIntentId =
            reservationRow.payment_intent_id ?? `pay_${randomUUID().replace(/-/g, "")}`;
          const paymentInitiatedAt = new Date().toISOString();

          await client.query(
            `
              UPDATE reservations
              SET status = 'payment_pending', payment_method = $2, payment_initiated_at = $3::timestamptz,
                  payment_intent_id = $4, updated_at = NOW()
              WHERE id = $1
            `,
            [reservationId, paymentMethod, paymentInitiatedAt, paymentIntentId]
          );

          const updated = await loadReservation(client, reservationId);
          if (!updated) {
            throw new Error("RESERVATION_NOT_FOUND");
          }

          return updated;
        });

        const response = {
          success: true,
          data: {
            ...reservationResponse(result),
            paymentGatewayStatus: "pending"
          }
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
            `
              SELECT id, user_id, event_id, ticket_type_id, quantity, unit_price, total_amount, status, expires_at, created_at,
                     payment_intent_id, payment_method, payment_initiated_at, paid_at, gateway_transaction_id, inventory_locked
              FROM reservations
              WHERE id = $1
              FOR UPDATE
            `,
            [reservationId]
          );

          if (!reservationRow) {
            throw Object.assign(new Error("RESERVATION_NOT_FOUND"), { statusCode: 404 });
          }

          if (
            Date.now() > new Date(reservationRow.expires_at).getTime() &&
            reservationRow.status !== "paid"
          ) {
            if (reservationRow.inventory_locked) {
              await client.query(
                `UPDATE ticket_inventory SET locked_count = GREATEST(locked_count - $2, 0), updated_at = NOW() WHERE ticket_type_id = $1`,
                [reservationRow.ticket_type_id, Number(reservationRow.quantity)]
              );
            }
            await client.query(
              `UPDATE reservations SET status = 'expired', inventory_locked = FALSE, updated_at = NOW() WHERE id = $1`,
              [reservationId]
            );
            throw Object.assign(new Error("RESERVATION_EXPIRED"), { statusCode: 400 });
          }

          if (reservationRow.status !== "payment_pending" && reservationRow.status !== "paid") {
            throw Object.assign(new Error("RESERVATION_NOT_PENDING_PAYMENT"), { statusCode: 400 });
          }

          if (reservationRow.status === "payment_pending") {
            await client.query(
              `
                UPDATE ticket_inventory
                SET sold_count = sold_count + $2,
                    locked_count = GREATEST(locked_count - $2, 0),
                    updated_at = NOW()
                WHERE ticket_type_id = $1
              `,
              [reservationRow.ticket_type_id, Number(reservationRow.quantity)]
            );

            await client.query(
              `
                UPDATE reservations
                SET status = 'paid',
                    paid_at = NOW(),
                    gateway_transaction_id = $2,
                    inventory_locked = FALSE,
                    updated_at = NOW()
                WHERE id = $1
              `,
              [
                reservationId,
                body.gatewayTransactionId?.trim() || `gw_${randomUUID().replace(/-/g, "")}`
              ]
            );
          }

          const ticketCount = await queryOne<{ count: string }>(
            client,
            `SELECT COUNT(*)::text AS count FROM tickets WHERE reservation_id = $1`,
            [reservationId]
          );

          if (Number(ticketCount?.count ?? 0) === 0) {
            const existingUserTickets = await queryOne<{ count: string }>(
              client,
              `SELECT COUNT(*)::text AS count FROM tickets WHERE owner_user_id = $1`,
              [reservationRow.user_id]
            );
            const startIndex = Number(existingUserTickets?.count ?? 0);

            for (let i = 0; i < Number(reservationRow.quantity); i += 1) {
              await client.query(
                `
                  INSERT INTO tickets (token_id, event_id, ticket_type_id, owner_user_id, seat_info, reservation_id, created_at)
                  VALUES ($1, $2, $3, $4, $5, $6, NOW())
                `,
                [
                  `mock_${randomUUID().replace(/-/g, "")}`,
                  reservationRow.event_id,
                  reservationRow.ticket_type_id,
                  reservationRow.user_id,
                  `GA-${String(startIndex + i + 1).padStart(4, "0")}`,
                  reservationId
                ]
              );
            }
          }

          const updated = await loadReservation(client, reservationId);
          const issued = await queryOne<{ count: string }>(
            client,
            `SELECT COUNT(*)::text AS count FROM tickets WHERE reservation_id = $1`,
            [reservationId]
          );

          return {
            success: true,
            data: {
              ...reservationResponse(updated as ReservationRecord),
              ticketsIssued: Number(issued?.count ?? 0),
              paymentGatewayStatus: "confirmed"
            }
          };
        });

        await setCachedResponse(redis, idempotencyScope, response);
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

        if (
          (reservation.status === "pending" || reservation.status === "payment_pending") &&
          Date.now() > reservation.expiresAtMs
        ) {
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

        const tickets = await queryMany<TicketRow>(
          pool,
          `
            SELECT token_id, event_id, ticket_type_id, owner_user_id, seat_info, reservation_id, created_at
            FROM tickets
            WHERE owner_user_id = $1
            ORDER BY created_at ASC
          `,
          [userId]
        );
        return sendJson(res, 200, {
          success: true,
          data: tickets.map(mapTicket)
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

        const ticket = await queryOne<TicketRow>(
          pool,
          `
            SELECT token_id, event_id, ticket_type_id, owner_user_id, seat_info, reservation_id, created_at
            FROM tickets
            WHERE token_id = $1 AND owner_user_id = $2
          `,
          [ticketDetailMatch[1], userId]
        );

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
          data: mapTicket(ticket)
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

        const ticket = await queryOne<TicketRow>(
          pool,
          `
            SELECT token_id, event_id, ticket_type_id, owner_user_id, seat_info, reservation_id, created_at
            FROM tickets
            WHERE token_id = $1 AND owner_user_id = $2
          `,
          [qrMatch[1], userId]
        );

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
            tokenId: ticket.token_id,
            eventId: ticket.event_id,
            timestamp: Date.now(),
            nonce: randomUUID(),
            walletAddress: `mock-wallet-${userId}`,
            signature: `0x${randomUUID().replace(/-/g, "")}${randomUUID().replace(/-/g, "")}`
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

      if (code === "RESERVATION_NOT_PENDING_PAYMENT") {
        return sendJson(res, 400, {
          success: false,
          error: {
            code,
            message: "Reservation is not awaiting payment confirmation"
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
