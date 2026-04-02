import { randomUUID } from "node:crypto";
import { createServer, IncomingMessage, ServerResponse } from "node:http";

import {
  createPostgresPool,
  queryMany,
  queryOne,
  withPostgresTransaction
} from "@ticket-platform/local-infra";
import type { Pool } from "pg";

import type { EventServiceConfig } from "./config.js";
import { log } from "./logger.js";

interface TicketType {
  id: string;
  name: string;
  price: number;
  quantity: number;
  soldCount: number;
}

interface EventRecord {
  id: string;
  organizerId: string;
  title: string;
  city: string;
  venue: string;
  startAt: string;
  endAt: string;
  status: "active" | "cancelled";
  ticketTypes: TicketType[];
}

interface EventWriteTicketType {
  id?: string;
  name?: string;
  price?: number;
  quantity?: number;
}

interface CreateEventBody {
  title?: string;
  city?: string;
  venue?: string;
  startAt?: string;
  endAt?: string;
  ticketTypes?: EventWriteTicketType[];
}

interface UpdateEventBody {
  title?: string;
  city?: string;
  venue?: string;
  startAt?: string;
  endAt?: string;
  status?: "active" | "cancelled";
}

interface EventRow {
  id: string;
  organizer_id: string;
  title: string;
  city: string;
  venue: string;
  start_at: string | Date;
  end_at: string | Date;
  status: "active" | "cancelled";
}

interface TicketTypeRow {
  id: string;
  event_id: string;
  name: string;
  price: number | string;
  quantity: number | string;
  sold_count: number | string;
}

class InvalidJsonError extends Error {
  constructor() {
    super("Invalid JSON payload");
    this.name = "InvalidJsonError";
  }
}

const seedEvents: EventRecord[] = [
  {
    id: "evt_rockfest_2026",
    organizerId: "org_rockfest",
    title: "Rock Fest 2026",
    city: "Ho Chi Minh",
    venue: "Riverside Arena",
    startAt: "2026-05-10T19:00:00.000Z",
    endAt: "2026-05-10T23:00:00.000Z",
    status: "active",
    ticketTypes: [
      {
        id: "tt_rockfest_ga",
        name: "General Admission",
        price: 900000,
        quantity: 5000,
        soldCount: 1250
      },
      { id: "tt_rockfest_vip", name: "VIP", price: 2200000, quantity: 300, soldCount: 120 }
    ]
  },
  {
    id: "evt_jazz_night_2026",
    organizerId: "org_jazz",
    title: "Jazz Night 2026",
    city: "Ha Noi",
    venue: "Opera Hall",
    startAt: "2026-06-01T12:30:00.000Z",
    endAt: "2026-06-01T16:00:00.000Z",
    status: "active",
    ticketTypes: [
      { id: "tt_jazz_std", name: "Standard", price: 650000, quantity: 800, soldCount: 180 },
      { id: "tt_jazz_vvip", name: "VVIP", price: 1800000, quantity: 100, soldCount: 40 }
    ]
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

  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new InvalidJsonError();
  }
}

function extractOrganizerId(req: IncomingMessage): string | null {
  const value = req.headers["x-organizer-id"];
  if (!value) {
    return null;
  }

  const organizerId = Array.isArray(value) ? value[0] : value;
  return organizerId?.trim() || null;
}

function toIso(value: string | Date): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function mapEventRow(row: EventRow, ticketTypes: TicketTypeRow[]): EventRecord {
  return {
    id: row.id,
    organizerId: row.organizer_id,
    title: row.title,
    city: row.city,
    venue: row.venue,
    startAt: toIso(row.start_at),
    endAt: toIso(row.end_at),
    status: row.status,
    ticketTypes: ticketTypes
      .filter((item) => item.event_id === row.id)
      .map((item) => ({
        id: item.id,
        name: item.name,
        price: Number(item.price),
        quantity: Number(item.quantity),
        soldCount: Number(item.sold_count)
      }))
  };
}

function computeAvailability(event: EventRecord) {
  return event.ticketTypes.map((type) => ({
    ticketTypeId: type.id,
    available: Math.max(type.quantity - type.soldCount, 0),
    sold: type.soldCount,
    quantity: type.quantity
  }));
}

function sanitizeSummary(event: EventRecord) {
  return {
    id: event.id,
    organizerId: event.organizerId,
    title: event.title,
    city: event.city,
    venue: event.venue,
    startAt: event.startAt,
    endAt: event.endAt,
    status: event.status
  };
}

async function ensureSchema(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY,
      organizer_id TEXT NOT NULL,
      title TEXT NOT NULL,
      city TEXT NOT NULL,
      venue TEXT NOT NULL,
      start_at TIMESTAMPTZ NOT NULL,
      end_at TIMESTAMPTZ NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('active', 'cancelled')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS event_ticket_types (
      id TEXT PRIMARY KEY,
      event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      price INTEGER NOT NULL,
      quantity INTEGER NOT NULL,
      sold_count INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  const existing = await queryOne<{ count: string }>(
    pool,
    "SELECT COUNT(*)::text AS count FROM events"
  );
  if (Number(existing?.count ?? 0) > 0) {
    return;
  }

  for (const event of seedEvents) {
    await withPostgresTransaction(pool, async (client) => {
      await client.query(
        `
          INSERT INTO events (id, organizer_id, title, city, venue, start_at, end_at, status)
          VALUES ($1, $2, $3, $4, $5, $6::timestamptz, $7::timestamptz, $8)
        `,
        [
          event.id,
          event.organizerId,
          event.title,
          event.city,
          event.venue,
          event.startAt,
          event.endAt,
          event.status
        ]
      );

      for (const ticketType of event.ticketTypes) {
        await client.query(
          `
            INSERT INTO event_ticket_types (id, event_id, name, price, quantity, sold_count)
            VALUES ($1, $2, $3, $4, $5, $6)
          `,
          [
            ticketType.id,
            event.id,
            ticketType.name,
            ticketType.price,
            ticketType.quantity,
            ticketType.soldCount
          ]
        );
      }
    });
  }
}

async function listEvents(
  pool: Pool,
  filters: { city?: string | null; status?: string | null; organizerId?: string | null }
) {
  const conditions: string[] = [];
  const values: string[] = [];

  if (filters.city) {
    values.push(`%${filters.city.toLowerCase()}%`);
    conditions.push(`LOWER(city) LIKE $${values.length}`);
  }

  if (filters.status) {
    values.push(filters.status);
    conditions.push(`status = $${values.length}`);
  }

  if (filters.organizerId) {
    values.push(filters.organizerId);
    conditions.push(`organizer_id = $${values.length}`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const eventRows = await queryMany<EventRow>(
    pool,
    `SELECT id, organizer_id, title, city, venue, start_at, end_at, status FROM events ${whereClause} ORDER BY start_at ASC`,
    values
  );

  const ticketTypeRows = await queryMany<TicketTypeRow>(
    pool,
    `SELECT id, event_id, name, price, quantity, sold_count FROM event_ticket_types WHERE event_id = ANY($1::text[]) ORDER BY id ASC`,
    [eventRows.map((item) => item.id)]
  );

  return eventRows.map((row) => mapEventRow(row, ticketTypeRows));
}

async function loadEvent(pool: Pool, eventId: string): Promise<EventRecord | null> {
  const eventRow = await queryOne<EventRow>(
    pool,
    `SELECT id, organizer_id, title, city, venue, start_at, end_at, status FROM events WHERE id = $1`,
    [eventId]
  );

  if (!eventRow) {
    return null;
  }

  const ticketTypeRows = await queryMany<TicketTypeRow>(
    pool,
    `SELECT id, event_id, name, price, quantity, sold_count FROM event_ticket_types WHERE event_id = $1 ORDER BY id ASC`,
    [eventId]
  );

  return mapEventRow(eventRow, ticketTypeRows);
}

export async function createEventServer(config: EventServiceConfig) {
  const pool = createPostgresPool(process.env);
  await ensureSchema(pool);

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
            storage: "postgres",
            timestamp: new Date().toISOString()
          }
        });
      }

      if (method === "GET" && url.pathname === "/events") {
        const filtered = await listEvents(pool, {
          city: url.searchParams.get("city")?.toLowerCase(),
          status: url.searchParams.get("status")?.toLowerCase(),
          organizerId: url.searchParams.get("organizerId")?.trim()
        });

        return sendJson(res, 200, {
          success: true,
          data: filtered.map((event) => sanitizeSummary(event))
        });
      }

      if (method === "POST" && url.pathname === "/events") {
        const organizerId = extractOrganizerId(req);
        if (!organizerId) {
          return sendJson(res, 401, {
            success: false,
            error: {
              code: "UNAUTHORIZED_ORGANIZER",
              message: "Missing x-organizer-id header"
            }
          });
        }

        const body = await readJson<CreateEventBody>(req);
        const title = body.title?.trim() ?? "";
        const city = body.city?.trim() ?? "";
        const venue = body.venue?.trim() ?? "";
        const startAt = body.startAt?.trim() ?? "";
        const endAt = body.endAt?.trim() ?? "";

        if (!title || !city || !venue || !startAt || !endAt) {
          return sendJson(res, 400, {
            success: false,
            error: {
              code: "INVALID_EVENT_PAYLOAD",
              message: "title, city, venue, startAt, endAt are required"
            }
          });
        }

        const ticketTypes =
          body.ticketTypes?.map((item, index) => ({
            id: item.id?.trim() || `tt_${randomUUID().replace(/-/g, "").slice(0, 10)}`,
            name: item.name?.trim() || `Ticket ${index + 1}`,
            price: typeof item.price === "number" ? item.price : 0,
            quantity: typeof item.quantity === "number" ? item.quantity : 0,
            soldCount: 0
          })) ?? [];

        const eventId = `evt_${randomUUID().replace(/-/g, "").slice(0, 12)}`;

        await withPostgresTransaction(pool, async (client) => {
          await client.query(
            `
              INSERT INTO events (id, organizer_id, title, city, venue, start_at, end_at, status)
              VALUES ($1, $2, $3, $4, $5, $6::timestamptz, $7::timestamptz, $8)
            `,
            [eventId, organizerId, title, city, venue, startAt, endAt, "active"]
          );

          for (const ticketType of ticketTypes) {
            await client.query(
              `
                INSERT INTO event_ticket_types (id, event_id, name, price, quantity, sold_count)
                VALUES ($1, $2, $3, $4, $5, $6)
              `,
              [ticketType.id, eventId, ticketType.name, ticketType.price, ticketType.quantity, 0]
            );
          }
        });

        const next = await loadEvent(pool, eventId);
        return sendJson(res, 200, {
          success: true,
          data: next
        });
      }

      const detailMatch = url.pathname.match(/^\/events\/([^/]+)$/);
      if (method === "PUT" && detailMatch) {
        const organizerId = extractOrganizerId(req);
        if (!organizerId) {
          return sendJson(res, 401, {
            success: false,
            error: {
              code: "UNAUTHORIZED_ORGANIZER",
              message: "Missing x-organizer-id header"
            }
          });
        }

        const eventId = detailMatch[1];
        const existing = await loadEvent(pool, eventId);
        if (!existing) {
          return sendJson(res, 404, {
            success: false,
            error: {
              code: "EVENT_NOT_FOUND",
              message: "Event not found"
            }
          });
        }

        if (existing.organizerId !== organizerId) {
          return sendJson(res, 403, {
            success: false,
            error: {
              code: "FORBIDDEN",
              message: "Only organizer can update event"
            }
          });
        }

        const body = await readJson<UpdateEventBody>(req);

        await pool.query(
          `
            UPDATE events
            SET title = COALESCE($2, title),
                city = COALESCE($3, city),
                venue = COALESCE($4, venue),
                start_at = COALESCE($5::timestamptz, start_at),
                end_at = COALESCE($6::timestamptz, end_at),
                status = COALESCE($7, status),
                updated_at = NOW()
            WHERE id = $1
          `,
          [
            eventId,
            typeof body.title === "string" ? body.title.trim() : null,
            typeof body.city === "string" ? body.city.trim() : null,
            typeof body.venue === "string" ? body.venue.trim() : null,
            typeof body.startAt === "string" ? body.startAt.trim() : null,
            typeof body.endAt === "string" ? body.endAt.trim() : null,
            body.status === "active" || body.status === "cancelled" ? body.status : null
          ]
        );

        return sendJson(res, 200, {
          success: true,
          data: await loadEvent(pool, eventId)
        });
      }

      if (method === "GET" && detailMatch) {
        const event = await loadEvent(pool, detailMatch[1]);

        if (!event) {
          return sendJson(res, 404, {
            success: false,
            error: {
              code: "EVENT_NOT_FOUND",
              message: "Event not found"
            }
          });
        }

        return sendJson(res, 200, {
          success: true,
          data: event
        });
      }

      const cancelMatch = url.pathname.match(/^\/events\/([^/]+)\/cancel$/);
      if (method === "POST" && cancelMatch) {
        const organizerId = extractOrganizerId(req);
        if (!organizerId) {
          return sendJson(res, 401, {
            success: false,
            error: {
              code: "UNAUTHORIZED_ORGANIZER",
              message: "Missing x-organizer-id header"
            }
          });
        }

        const eventId = cancelMatch[1];
        const event = await loadEvent(pool, eventId);

        if (!event) {
          return sendJson(res, 404, {
            success: false,
            error: {
              code: "EVENT_NOT_FOUND",
              message: "Event not found"
            }
          });
        }

        if (event.organizerId !== organizerId) {
          return sendJson(res, 403, {
            success: false,
            error: {
              code: "FORBIDDEN",
              message: "Only organizer can cancel event"
            }
          });
        }

        await pool.query(
          `UPDATE events SET status = 'cancelled', updated_at = NOW() WHERE id = $1`,
          [eventId]
        );
        const updated = await loadEvent(pool, eventId);

        return sendJson(res, 200, {
          success: true,
          data: updated ? sanitizeSummary(updated) : null
        });
      }

      const ticketTypeMatch = url.pathname.match(/^\/events\/([^/]+)\/ticket-types$/);
      if (method === "GET" && ticketTypeMatch) {
        const event = await loadEvent(pool, ticketTypeMatch[1]);

        if (!event) {
          return sendJson(res, 404, {
            success: false,
            error: {
              code: "EVENT_NOT_FOUND",
              message: "Event not found"
            }
          });
        }

        return sendJson(res, 200, {
          success: true,
          data: event.ticketTypes
        });
      }

      const availabilityMatch = url.pathname.match(/^\/events\/([^/]+)\/availability$/);
      if (method === "GET" && availabilityMatch) {
        const event = await loadEvent(pool, availabilityMatch[1]);

        if (!event) {
          return sendJson(res, 404, {
            success: false,
            error: {
              code: "EVENT_NOT_FOUND",
              message: "Event not found"
            }
          });
        }

        return sendJson(res, 200, {
          success: true,
          data: computeAvailability(event)
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
      if (error instanceof InvalidJsonError) {
        return sendJson(res, 400, {
          success: false,
          error: {
            code: "INVALID_JSON",
            message: "Request body must be valid JSON"
          }
        });
      }

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
    void pool.end();
  });

  return server;
}
