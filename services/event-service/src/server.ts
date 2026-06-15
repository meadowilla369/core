import { createHash, randomUUID } from "node:crypto";
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

type EventStatus = "draft" | "in_review" | "active" | "cancelled";

interface TicketType {
  id: string;
  onchainTicketTypeId?: string | null;
  name: string;
  price: number;
  quantity: number;
  perks: string[];
}

interface EventMetadata {
  category: string;
  address: string;
  description: string;
  lineup: string[];
  heroImageDataUrl: string;
  posterImageDataUrl: string;
}

interface EventRecord {
  id: string;
  onchainEventId?: string | null;
  organizerId: string;
  title: string;
  city: string;
  venue: string;
  startAt: string;
  endAt: string;
  status: EventStatus;
  metadata: EventMetadata | null;
  ticketTypes: TicketType[];
}

interface EventWriteTicketType {
  id?: string;
  name?: string;
  price?: number;
  quantity?: number;
  perks?: string[];
}

interface EventWriteMetadata {
  category?: string;
  address?: string;
  description?: string;
  lineup?: string[];
  heroImageDataUrl?: string;
  posterImageDataUrl?: string;
}

interface CreateEventBody {
  title?: string;
  city?: string;
  venue?: string;
  startAt?: string;
  endAt?: string;
  status?: EventStatus;
  metadata?: EventWriteMetadata;
  ticketTypes?: EventWriteTicketType[];
}

interface UpdateEventBody {
  title?: string;
  city?: string;
  venue?: string;
  startAt?: string;
  endAt?: string;
  status?: EventStatus;
  metadata?: EventWriteMetadata;
  ticketTypes?: EventWriteTicketType[];
}

interface EventRow {
  id: string;
  onchain_event_id: string | null;
  organizer_id: string;
  title: string;
  city: string;
  venue: string;
  starts_at: string | Date;
  ends_at: string | Date;
  status: EventStatus;
  metadata: Record<string, unknown> | null;
}

interface TicketTypeRow {
  id: string;
  event_id: string;
  onchain_ticket_type_id: string | null;
  name: string;
  price: number | string;
  quantity: number | string;
  perks: string[] | string | null;
}

interface GateRecord {
  id: string;
  eventId: string;
  name: string;
  location?: string | null;
  status: "active" | "disabled";
  createdAt: string;
}

interface GateRow {
  id: string;
  event_id: string;
  name: string;
  location: string | null;
  status: "active" | "disabled";
  created_at: string | Date;
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
    metadata: {
      category: "Hoa nhac",
      address: "Riverside Arena, Ho Chi Minh",
      description: "Rock Fest 2026 brings high-energy live music to Riverside Arena.",
      lineup: ["Neural Beats", "Quantum Strings"],
      heroImageDataUrl: "",
      posterImageDataUrl: ""
    },
    ticketTypes: [
      {
        id: "tt_rockfest_ga",
        name: "General Admission",
        price: 900000,
        quantity: 5000,
        perks: ["Vao cong", "Khu vuc dung"]
      },
      {
        id: "tt_rockfest_vip",
        name: "VIP",
        price: 2200000,
        quantity: 300,
        perks: ["Loi vao rieng", "Khu vuc VIP"]
      }
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
    metadata: {
      category: "Hoa nhac",
      address: "Opera Hall, Ha Noi",
      description: "Jazz Night 2026 pairs intimate performances with premium seating.",
      lineup: ["Blue Note Collective", "Midnight Trio"],
      heroImageDataUrl: "",
      posterImageDataUrl: ""
    },
    ticketTypes: [
      {
        id: "tt_jazz_std",
        name: "Standard",
        price: 650000,
        quantity: 800,
        perks: ["Ghe tieu chuan", "Vao cong"]
      },
      {
        id: "tt_jazz_vvip",
        name: "VVIP",
        price: 1800000,
        quantity: 100,
        perks: ["Ghe gan san khau", "Nuoc uong chao mung"]
      }
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

function toStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as unknown;
      return toStringArray(parsed);
    } catch {
      return [];
    }
  }

  return [];
}

function normalizeMetadata(input?: EventWriteMetadata): EventMetadata | null {
  if (!input) {
    return null;
  }

  return {
    category: input.category?.trim() ?? "",
    address: input.address?.trim() ?? "",
    description: input.description?.trim() ?? "",
    lineup: toStringArray(input.lineup),
    heroImageDataUrl: input.heroImageDataUrl?.trim() ?? "",
    posterImageDataUrl: input.posterImageDataUrl?.trim() ?? ""
  };
}

function hashStringId(id: string): string {
  const digest = createHash("sha256").update(id, "utf8").digest();
  const high = digest.readUInt32BE(0);
  const low = digest.readUInt16BE(4);
  return String(high * 0x10000 + low || 1);
}

function mapEventRow(row: EventRow, ticketTypes: TicketTypeRow[]): EventRecord {
  const metadata = row.metadata as EventMetadata | null;
  return {
    id: row.id,
    onchainEventId: row.onchain_event_id,
    organizerId: row.organizer_id,
    title: row.title,
    city: row.city,
    venue: row.venue,
    startAt: toIso(row.starts_at),
    endAt: toIso(row.ends_at),
    status: row.status,
    metadata,
    ticketTypes: ticketTypes
      .filter((item) => item.event_id === row.id)
      .map((item) => ({
        id: item.id,
        onchainTicketTypeId: item.onchain_ticket_type_id,
        name: item.name,
        price: Number(item.price),
        quantity: Number(item.quantity),
        perks: toStringArray(item.perks)
      }))
  };
}

function validatePublishReady(event: EventRecord): string[] {
  const missing: string[] = [];
  const metadata = event.metadata;

  if (!event.title.trim()) missing.push("title");
  if (!event.city.trim()) missing.push("city");
  if (!event.venue.trim()) missing.push("venue");
  if (!event.startAt.trim()) missing.push("startAt");
  if (!event.endAt.trim()) missing.push("endAt");
  if (!metadata?.category.trim()) missing.push("metadata.category");
  if (!metadata?.address.trim()) missing.push("metadata.address");
  if (!metadata?.description.trim()) missing.push("metadata.description");
  if (!metadata?.heroImageDataUrl.trim()) missing.push("metadata.heroImageDataUrl");
  if (!metadata?.posterImageDataUrl.trim()) missing.push("metadata.posterImageDataUrl");
  if (event.ticketTypes.length === 0) missing.push("ticketTypes");

  for (const [index, ticketType] of event.ticketTypes.entries()) {
    if (!ticketType.name.trim()) missing.push(`ticketTypes.${index}.name`);
    if (ticketType.price < 0) missing.push(`ticketTypes.${index}.price`);
    if (ticketType.quantity <= 0) missing.push(`ticketTypes.${index}.quantity`);
  }

  return missing;
}

function sanitizeSummary(event: EventRecord) {
  return {
    id: event.id,
    onchainEventId: event.onchainEventId,
    organizerId: event.organizerId,
    title: event.title,
    city: event.city,
    venue: event.venue,
    startAt: event.startAt,
    endAt: event.endAt,
    status: event.status,
    metadata: event.metadata,
    heroImageUrl: event.metadata?.heroImageDataUrl,
    ticketTypes: event.ticketTypes.map((tt) => ({
      id: tt.id,
      name: tt.name,
      price: tt.price,
      quantity: tt.quantity,
      perks: tt.perks
    }))
  };
}

function mapGateRow(row: GateRow): GateRecord {
  return {
    id: row.id,
    eventId: row.event_id,
    name: row.name,
    location: row.location,
    status: row.status,
    createdAt: toIso(row.created_at)
  };
}

function defaultGatesForEvent(eventId: string): GateRecord[] {
  return [
    {
      id: `${eventId}_gate_main`,
      eventId,
      name: "Main gate",
      location: "Main entrance",
      status: "active",
      createdAt: new Date().toISOString()
    },
    {
      id: `${eventId}_gate_vip`,
      eventId,
      name: "VIP gate",
      location: "VIP entrance",
      status: "active",
      createdAt: new Date().toISOString()
    },
    {
      id: `${eventId}_gate_backstage`,
      eventId,
      name: "Backstage gate",
      location: "Staff entrance",
      status: "active",
      createdAt: new Date().toISOString()
    }
  ];
}

async function ensureDefaultGates(pool: Pool, eventId: string): Promise<void> {
  const existing = await queryOne<{ count: string }>(
    pool,
    `SELECT COUNT(*)::text AS count FROM gates WHERE event_id = $1`,
    [eventId]
  );

  if (Number(existing?.count ?? 0) > 0) {
    await pool.query(
      `UPDATE gates SET status = 'active' WHERE event_id = $1 AND status <> 'active'`,
      [eventId]
    );
    return;
  }

  for (const gate of defaultGatesForEvent(eventId)) {
    await pool.query(
      `
        INSERT INTO gates (id, event_id, name, location, status)
        VALUES ($1, $2, $3, $4, 'active')
        ON CONFLICT (id) DO UPDATE
        SET status = 'active',
            name = EXCLUDED.name,
            location = EXCLUDED.location
      `,
      [gate.id, eventId, gate.name, gate.location]
    );
  }
}

async function listEventGates(pool: Pool, eventId: string): Promise<GateRecord[]> {
  const rows = await queryMany<GateRow>(
    pool,
    `
      SELECT id, event_id, name, location, status, created_at
      FROM gates
      WHERE event_id = $1
      ORDER BY created_at ASC, id ASC
    `,
    [eventId]
  );

  return rows.map(mapGateRow);
}

async function ensureSchema(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY,
      onchain_event_id NUMERIC(78, 0) UNIQUE,
      organizer_id TEXT NOT NULL,
      title TEXT NOT NULL,
      city TEXT NOT NULL,
      venue TEXT NOT NULL,
      starts_at TIMESTAMPTZ NOT NULL,
      ends_at TIMESTAMPTZ NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('draft', 'in_review', 'active', 'cancelled')),
      metadata JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    ALTER TABLE events DROP CONSTRAINT IF EXISTS events_status_check
  `);

  await pool.query(`
    ALTER TABLE events ADD CONSTRAINT events_status_check CHECK (status IN ('draft', 'in_review', 'active', 'cancelled'))
  `);

  await pool.query(`
    ALTER TABLE events ADD COLUMN IF NOT EXISTS metadata JSONB
  `);

  await pool.query(`
    ALTER TABLE events ADD COLUMN IF NOT EXISTS onchain_event_id NUMERIC(78, 0)
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS ticket_types (
      id TEXT PRIMARY KEY,
      event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
      onchain_ticket_type_id NUMERIC(78, 0) UNIQUE,
      name TEXT NOT NULL,
      unit_price INTEGER NOT NULL,
      quantity INTEGER NOT NULL,
      perks JSONB NOT NULL DEFAULT '[]'::jsonb
    );
  `);

  await pool.query(`
    ALTER TABLE ticket_types ADD COLUMN IF NOT EXISTS onchain_ticket_type_id NUMERIC(78, 0);
  `);

  await pool.query(`
    ALTER TABLE ticket_types ADD COLUMN IF NOT EXISTS perks JSONB NOT NULL DEFAULT '[]'::jsonb;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS gates (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      event_id TEXT NOT NULL REFERENCES events(id),
      name TEXT NOT NULL,
      location TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    ALTER TABLE gates ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';
  `);

  await pool.query(`
    ALTER TABLE gates DROP CONSTRAINT IF EXISTS gates_status_check;
  `);

  await pool.query(`
    ALTER TABLE gates ADD CONSTRAINT gates_status_check CHECK (status IN ('active', 'disabled'));
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
          INSERT INTO events (id, onchain_event_id, organizer_id, title, city, venue, starts_at, ends_at, status, metadata)
          VALUES ($1, $2, $3, $4, $5, $6, $7::timestamptz, $8::timestamptz, $9, $10::jsonb)
        `,
        [
          event.id,
          hashStringId(event.id),
          event.organizerId,
          event.title,
          event.city,
          event.venue,
          event.startAt,
          event.endAt,
          event.status,
          event.metadata ? JSON.stringify(event.metadata) : null
        ]
      );

      for (const ticketType of event.ticketTypes) {
        await client.query(
          `
            INSERT INTO ticket_types (
              id, event_id, onchain_ticket_type_id, name, unit_price, quantity, perks
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
          `,
          [
            ticketType.id,
            event.id,
            hashStringId(ticketType.id),
            ticketType.name,
            ticketType.price,
            ticketType.quantity,
            JSON.stringify(ticketType.perks)
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
    `SELECT id, onchain_event_id, organizer_id, title, city, venue, starts_at, ends_at, status, metadata
     FROM events ${whereClause}
     ORDER BY starts_at ASC`,
    values
  );

  const ticketTypeRows = await queryMany<TicketTypeRow>(
    pool,
    `SELECT tt.id, tt.event_id, tt.onchain_ticket_type_id, tt.name, tt.unit_price AS price, tt.quantity, tt.perks
     FROM ticket_types tt
     WHERE tt.event_id = ANY($1::text[])
     ORDER BY tt.id ASC`,
    [eventRows.map((item) => item.id)]
  );

  return eventRows.map((row) => mapEventRow(row, ticketTypeRows));
}

async function loadEvent(pool: Pool, eventId: string): Promise<EventRecord | null> {
  const eventRow = await queryOne<EventRow>(
    pool,
    `SELECT id, onchain_event_id, organizer_id, title, city, venue, starts_at, ends_at, status, metadata
     FROM events
     WHERE id = $1`,
    [eventId]
  );

  if (!eventRow) {
    return null;
  }

  const ticketTypeRows = await queryMany<TicketTypeRow>(
    pool,
    `SELECT tt.id, tt.event_id, tt.onchain_ticket_type_id, tt.name, tt.unit_price AS price, tt.quantity, tt.perks
     FROM ticket_types tt
     WHERE tt.event_id = $1
     ORDER BY tt.id ASC`,
    [eventId]
  );

  return mapEventRow(eventRow, ticketTypeRows);
}

async function transitionOrganizerEvent(
  pool: Pool,
  req: IncomingMessage,
  res: ServerResponse,
  eventId: string,
  nextStatus: "in_review" | "active"
) {
  const organizerId = extractOrganizerId(req);
  if (!organizerId) {
    return sendJson(res, 401, {
      success: false,
      error: { code: "UNAUTHORIZED_ORGANIZER", message: "Missing x-organizer-id header" }
    });
  }

  const event = await loadEvent(pool, eventId);
  if (!event) {
    return sendJson(res, 404, {
      success: false,
      error: { code: "EVENT_NOT_FOUND", message: "Event not found" }
    });
  }

  if (event.organizerId !== organizerId) {
    return sendJson(res, 403, {
      success: false,
      error: { code: "FORBIDDEN", message: "Only organizer can update event" }
    });
  }

  if (nextStatus === "in_review" && event.status !== "draft") {
    return sendJson(res, 409, {
      success: false,
      error: {
        code: "INVALID_STATUS_TRANSITION",
        message: "Only draft events can be submitted for review"
      }
    });
  }

  if (nextStatus === "active" && event.status !== "draft" && event.status !== "in_review") {
    return sendJson(res, 409, {
      success: false,
      error: {
        code: "INVALID_STATUS_TRANSITION",
        message: "Only draft or in-review events can be dev published"
      }
    });
  }

  const missing = validatePublishReady(event);
  if (missing.length > 0) {
    return sendJson(res, 400, {
      success: false,
      error: {
        code: "EVENT_NOT_READY",
        message: "Event is missing publish-readiness fields",
        fields: missing
      }
    });
  }

  await withPostgresTransaction(pool, async (client) => {
    await client.query(`UPDATE events SET status = $2, updated_at = NOW() WHERE id = $1`, [
      eventId,
      nextStatus
    ]);

    if (nextStatus === "active") {
      const existing = await queryOne<{ count: string }>(
        client,
        `SELECT COUNT(*)::text AS count FROM gates WHERE event_id = $1`,
        [eventId]
      );

      if (Number(existing?.count ?? 0) > 0) {
        await client.query(
          `UPDATE gates SET status = 'active' WHERE event_id = $1 AND status <> 'active'`,
          [eventId]
        );
      } else {
        for (const gate of defaultGatesForEvent(eventId)) {
          await client.query(
            `
              INSERT INTO gates (id, event_id, name, location, status)
              VALUES ($1, $2, $3, $4, 'active')
            `,
            [gate.id, eventId, gate.name, gate.location]
          );
        }
      }
    }
  });

  return sendJson(res, 200, {
    success: true,
    data: await loadEvent(pool, eventId)
  });
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
        const status: EventStatus =
          body.status === "active" || body.status === "in_review" || body.status === "cancelled"
            ? body.status
            : "draft";
        const metadata = normalizeMetadata(body.metadata);

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
            perks: toStringArray(item.perks)
          })) ?? [];

        const eventId = `evt_${randomUUID().replace(/-/g, "").slice(0, 12)}`;

        await withPostgresTransaction(pool, async (client) => {
          await client.query(
            `
              INSERT INTO events (id, onchain_event_id, organizer_id, title, city, venue, starts_at, ends_at, status, metadata)
              VALUES ($1, $2, $3, $4, $5, $6, $7::timestamptz, $8::timestamptz, $9, $10::jsonb)
            `,
            [
              eventId,
              hashStringId(eventId),
              organizerId,
              title,
              city,
              venue,
              startAt,
              endAt,
              status,
              metadata ? JSON.stringify(metadata) : null
            ]
          );

          for (const ticketType of ticketTypes) {
            await client.query(
              `
                INSERT INTO ticket_types (
                  id, event_id, onchain_ticket_type_id, name, unit_price, quantity, perks
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
              `,
              [
                ticketType.id,
                eventId,
                hashStringId(ticketType.id),
                ticketType.name,
                ticketType.price,
                ticketType.quantity,
                JSON.stringify(ticketType.perks)
              ]
            );
          }
        });

        const next = await loadEvent(pool, eventId);
        return sendJson(res, 200, {
          success: true,
          data: next
        });
      }

      if (method === "GET" && url.pathname === "/events/snapshot") {
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

        const events = await listEvents(pool, { organizerId });

        const eventIds = events.map((e) => e.id);
        const inventoryRows =
          eventIds.length > 0
            ? await queryMany<{
                event_id: string;
                sold_count: string;
                locked_count: string;
                gross_sales_vnd: string;
              }>(
                pool,
                `SELECT tt.event_id,
                      COALESCE(SUM(ti.sold_count), 0)::text AS sold_count,
                      COALESCE(SUM(ti.locked_count), 0)::text AS locked_count,
                      COALESCE(SUM(ti.sold_count * tt.unit_price), 0)::text AS gross_sales_vnd
               FROM ticket_inventory ti
               INNER JOIN ticket_types tt ON tt.id = ti.ticket_type_id
               WHERE tt.event_id = ANY($1::text[])
               GROUP BY tt.event_id`,
                [eventIds]
              )
            : [];

        const soldByEventId = new Map(inventoryRows.map((r) => [r.event_id, Number(r.sold_count)]));
        const lockedByEventId = new Map(
          inventoryRows.map((r) => [r.event_id, Number(r.locked_count)])
        );
        const grossByEventId = new Map(
          inventoryRows.map((r) => [r.event_id, Number(r.gross_sales_vnd)])
        );

        const checkinRows =
          eventIds.length > 0
            ? await queryMany<{
                event_id: string;
                gate_id: string | null;
                checked_in_count: string;
              }>(
                pool,
                `SELECT event_id, gate_id, COUNT(*)::text AS checked_in_count
               FROM check_ins
               WHERE event_id = ANY($1::text[])
               GROUP BY event_id, gate_id`,
                [eventIds]
              )
            : [];

        const gateRows =
          eventIds.length > 0
            ? await queryMany<GateRow>(
                pool,
                `SELECT id, event_id, name, location, status, created_at
               FROM gates
               WHERE event_id = ANY($1::text[])
               ORDER BY created_at ASC, id ASC`,
                [eventIds]
              )
            : [];

        const rejectionRows =
          eventIds.length > 0
            ? await queryMany<{
                event_id: string;
                gate_id: string | null;
                reason: string;
                rejection_count: string;
              }>(
                pool,
                `SELECT event_id, gate_id, reason, COUNT(*)::text AS rejection_count
               FROM scan_rejections
               WHERE event_id = ANY($1::text[])
               GROUP BY event_id, gate_id, reason`,
                [eventIds]
              )
            : [];

        type RejectionKey = `${string}|${string}`;
        const duplicateByGate = new Map<RejectionKey, number>();
        const invalidByGate = new Map<RejectionKey, number>();
        for (const row of rejectionRows) {
          const key: RejectionKey = `${row.event_id}|${row.gate_id ?? ""}`;
          const count = Number(row.rejection_count);
          if (row.reason === "ALREADY_USED" || row.reason === "NONCE_REPLAYED") {
            duplicateByGate.set(key, (duplicateByGate.get(key) ?? 0) + count);
          } else {
            invalidByGate.set(key, (invalidByGate.get(key) ?? 0) + count);
          }
        }

        const checkinCountByEventId = new Map<string, number>();
        const checkinCountByGateKey = new Map<RejectionKey, number>();
        for (const row of checkinRows) {
          const key: RejectionKey = `${row.event_id}|${row.gate_id ?? ""}`;
          checkinCountByGateKey.set(key, Number(row.checked_in_count));
          checkinCountByEventId.set(
            row.event_id,
            (checkinCountByEventId.get(row.event_id) ?? 0) + Number(row.checked_in_count)
          );
        }

        const snapshot = {
          organizerId,
          generatedAt: new Date().toISOString(),
          events: events.map((event) => {
            const capacity = event.ticketTypes.reduce((sum, t) => sum + t.quantity, 0);
            const checkedIn = checkinCountByEventId.get(event.id) ?? 0;
            return {
              id: event.id,
              title: event.title,
              city: event.city,
              venue: event.venue,
              startAt: event.startAt,
              endAt: event.endAt,
              status: event.status,
              grossSalesVnd: grossByEventId.get(event.id) ?? 0,
              ticketsSold: soldByEventId.get(event.id) ?? 0,
              ticketsLocked: lockedByEventId.get(event.id) ?? 0,
              ticketCapacity: capacity,
              checkinRate: capacity > 0 ? checkedIn / capacity : 0
            };
          }),
          gates: gateRows.map((r) => {
            const key: `${string}|${string}` = `${r.event_id}|${r.id}`;
            return {
              gateId: r.id,
              eventId: r.event_id,
              name: r.name,
              location: r.location,
              status: r.status,
              checkedInCount: checkinCountByGateKey.get(key) ?? 0,
              duplicateCount: duplicateByGate.get(key) ?? 0,
              invalidCount: invalidByGate.get(key) ?? 0
            };
          }),
          queues: [] as {
            id: string;
            label: string;
            count: number;
            description: string;
            status: string;
          }[]
        };

        return sendJson(res, 200, {
          success: true,
          data: snapshot
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

        if (existing.status !== "draft" && existing.status !== "in_review") {
          return sendJson(res, 409, {
            success: false,
            error: {
              code: "EVENT_NOT_EDITABLE",
              message: "Only draft or in-review events can be edited"
            }
          });
        }

        const body = await readJson<UpdateEventBody>(req);
        const metadata = normalizeMetadata(body.metadata);

        await withPostgresTransaction(pool, async (client) => {
          await client.query(
            `
              UPDATE events
              SET title = COALESCE($2, title),
                  city = COALESCE($3, city),
                  venue = COALESCE($4, venue),
                  starts_at = COALESCE($5::timestamptz, starts_at),
                  ends_at = COALESCE($6::timestamptz, ends_at),
                  metadata = COALESCE($7::jsonb, metadata),
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
              metadata ? JSON.stringify(metadata) : null
            ]
          );

          if (body.ticketTypes) {
            await client.query(`DELETE FROM ticket_types WHERE event_id = $1`, [eventId]);

            for (const [index, ticketType] of body.ticketTypes.entries()) {
              const ticketTypeId =
                ticketType.id?.trim() || `tt_${randomUUID().replace(/-/g, "").slice(0, 10)}`;
              await client.query(
                `
                  INSERT INTO ticket_types (
                    id, event_id, onchain_ticket_type_id, name, unit_price, quantity, perks
                  )
                  VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
                `,
                [
                  ticketTypeId,
                  eventId,
                  hashStringId(ticketTypeId),
                  ticketType.name?.trim() || `Ticket ${index + 1}`,
                  typeof ticketType.price === "number" ? ticketType.price : 0,
                  typeof ticketType.quantity === "number" ? ticketType.quantity : 0,
                  JSON.stringify(toStringArray(ticketType.perks))
                ]
              );
            }
          }
        });

        return sendJson(res, 200, {
          success: true,
          data: await loadEvent(pool, eventId)
        });
      }

      const submitReviewMatch = url.pathname.match(/^\/events\/([^/]+)\/submit-review$/);
      if (method === "POST" && submitReviewMatch) {
        return transitionOrganizerEvent(pool, req, res, submitReviewMatch[1], "in_review");
      }

      const devPublishMatch = url.pathname.match(/^\/events\/([^/]+)\/dev-publish$/);
      if (method === "POST" && devPublishMatch) {
        return transitionOrganizerEvent(pool, req, res, devPublishMatch[1], "active");
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
          data: {
            ...event,
            heroImageUrl: event.metadata?.heroImageDataUrl
          }
        });
      }

      if (method === "DELETE" && detailMatch) {
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
              message: "Only organizer can delete event"
            }
          });
        }

        await withPostgresTransaction(pool, async (client) => {
          const scanned = await queryOne<{ count: string }>(
            client,
            `SELECT COUNT(*)::text AS count FROM check_ins WHERE event_id = $1`,
            [eventId]
          );

          if (Number(scanned?.count ?? 0) > 0) {
            await client.query(`UPDATE gates SET status = 'disabled' WHERE event_id = $1`, [
              eventId
            ]);
            await client.query(
              `UPDATE events SET status = 'cancelled', updated_at = NOW() WHERE id = $1`,
              [eventId]
            );
          } else {
            await client.query("DELETE FROM gates WHERE event_id = $1", [eventId]);
            await client.query("DELETE FROM ticket_types WHERE event_id = $1", [eventId]);
            await client.query("DELETE FROM events WHERE id = $1", [eventId]);
          }
        });

        return sendJson(res, 200, {
          success: true,
          data: { id: eventId, deleted: true }
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

        await withPostgresTransaction(pool, async (client) => {
          await client.query(
            `UPDATE events SET status = 'cancelled', updated_at = NOW() WHERE id = $1`,
            [eventId]
          );
          await client.query(`UPDATE gates SET status = 'disabled' WHERE event_id = $1`, [eventId]);
        });
        const updated = await loadEvent(pool, eventId);

        return sendJson(res, 200, {
          success: true,
          data: updated
        });
      }

      const gatesMatch = url.pathname.match(/^\/events\/([^/]+)\/gates$/);
      if (method === "GET" && gatesMatch) {
        const event = await loadEvent(pool, gatesMatch[1]);

        if (!event) {
          return sendJson(res, 404, {
            success: false,
            error: {
              code: "EVENT_NOT_FOUND",
              message: "Event not found"
            }
          });
        }

        if (event.status === "active") {
          await ensureDefaultGates(pool, event.id);
        }

        return sendJson(res, 200, {
          success: true,
          data: await listEventGates(pool, event.id)
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
        const eventId = availabilityMatch[1];
        const exists = await queryOne<{ id: string }>(pool, `SELECT id FROM events WHERE id = $1`, [
          eventId
        ]);

        if (!exists) {
          return sendJson(res, 404, {
            success: false,
            error: {
              code: "EVENT_NOT_FOUND",
              message: "Event not found"
            }
          });
        }

        const rows = await queryMany<{
          ticket_type_id: string;
          quantity: string;
          sold_count: string;
          locked_count: string;
        }>(
          pool,
          `SELECT tt.id AS ticket_type_id, tt.quantity::text,
                  COALESCE(ti.sold_count, 0)::text AS sold_count,
                  COALESCE(ti.locked_count, 0)::text AS locked_count
           FROM ticket_types tt
           LEFT JOIN ticket_inventory ti ON ti.ticket_type_id = tt.id
           WHERE tt.event_id = $1
           ORDER BY tt.id ASC`,
          [eventId]
        );

        return sendJson(res, 200, {
          success: true,
          data: rows.map((r) => ({
            ticketTypeId: r.ticket_type_id,
            quantity: Number(r.quantity),
            sold: Number(r.sold_count),
            locked: Number(r.locked_count),
            available: Math.max(
              Number(r.quantity) - Number(r.sold_count) - Number(r.locked_count),
              0
            )
          }))
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
