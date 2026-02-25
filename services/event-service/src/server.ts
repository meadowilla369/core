import { createServer, ServerResponse } from "node:http";

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
  title: string;
  city: string;
  venue: string;
  startAt: string;
  endAt: string;
  status: "active" | "cancelled";
  ticketTypes: TicketType[];
}

const events: EventRecord[] = [
  {
    id: "evt_rockfest_2026",
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

function computeAvailability(event: EventRecord) {
  return event.ticketTypes.map((type) => ({
    ticketTypeId: type.id,
    available: Math.max(type.quantity - type.soldCount, 0),
    sold: type.soldCount,
    quantity: type.quantity
  }));
}

export function createEventServer(config: EventServiceConfig) {
  return createServer((req, res) => {
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

        const filtered = events.filter((event) => {
          const cityMatch = city ? event.city.toLowerCase().includes(city) : true;
          const statusMatch = status ? event.status === status : true;
          return cityMatch && statusMatch;
        });

        return sendJson(res, 200, {
          success: true,
          data: filtered.map((event) => ({
            id: event.id,
            title: event.title,
            city: event.city,
            venue: event.venue,
            startAt: event.startAt,
            endAt: event.endAt,
            status: event.status
          }))
        });
      }

      const detailMatch = url.pathname.match(/^\/events\/([^/]+)$/);
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
