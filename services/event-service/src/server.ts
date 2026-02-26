import { randomUUID } from "node:crypto";
import { createServer, IncomingMessage, ServerResponse } from "node:http";

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

const events: EventRecord[] = [
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
      { id: "tt_rockfest_ga", name: "General Admission", price: 900000, quantity: 5000, soldCount: 1250 },
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

  return JSON.parse(raw) as T;
}

function extractOrganizerId(req: IncomingMessage): string | null {
  const value = req.headers["x-organizer-id"];
  if (!value) {
    return null;
  }

  const organizerId = Array.isArray(value) ? value[0] : value;
  return organizerId?.trim() || null;
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

export function createEventServer(config: EventServiceConfig) {
  return createServer(async (req, res) => {
    try {
      const method = req.method ?? "GET";
      const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);

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

      if (method === "GET" && url.pathname === "/events") {
        const city = url.searchParams.get("city")?.toLowerCase();
        const status = url.searchParams.get("status")?.toLowerCase();
        const organizerId = url.searchParams.get("organizerId")?.trim();

        const filtered = events.filter((event) => {
          const cityMatch = city ? event.city.toLowerCase().includes(city) : true;
          const statusMatch = status ? event.status === status : true;
          const organizerMatch = organizerId ? event.organizerId === organizerId : true;
          return cityMatch && statusMatch && organizerMatch;
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

        const next: EventRecord = {
          id: `evt_${randomUUID().replace(/-/g, "").slice(0, 12)}`,
          organizerId,
          title,
          city,
          venue,
          startAt,
          endAt,
          status: "active",
          ticketTypes
        };

        events.push(next);

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
        const event = events.find((item) => item.id === eventId);
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
              message: "Only organizer can update event"
            }
          });
        }

        const body = await readJson<UpdateEventBody>(req);
        if (typeof body.title === "string") {
          event.title = body.title.trim();
        }
        if (typeof body.city === "string") {
          event.city = body.city.trim();
        }
        if (typeof body.venue === "string") {
          event.venue = body.venue.trim();
        }
        if (typeof body.startAt === "string") {
          event.startAt = body.startAt.trim();
        }
        if (typeof body.endAt === "string") {
          event.endAt = body.endAt.trim();
        }
        if (body.status === "active" || body.status === "cancelled") {
          event.status = body.status;
        }

        return sendJson(res, 200, {
          success: true,
          data: event
        });
      }

      if (method === "GET" && detailMatch) {
        const eventId = detailMatch[1];
        const event = events.find((item) => item.id === eventId);

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
        const event = events.find((item) => item.id === eventId);

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

        event.status = "cancelled";

        return sendJson(res, 200, {
          success: true,
          data: sanitizeSummary(event)
        });
      }

      const ticketTypeMatch = url.pathname.match(/^\/events\/([^/]+)\/ticket-types$/);
      if (method === "GET" && ticketTypeMatch) {
        const eventId = ticketTypeMatch[1];
        const event = events.find((item) => item.id === eventId);

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
        const event = events.find((item) => item.id === eventId);

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
