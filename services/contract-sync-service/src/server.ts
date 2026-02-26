import { createServer, IncomingMessage, ServerResponse } from "node:http";

import type { ContractSyncConfig } from "./config.js";
import { log } from "./logger.js";

interface ContractEventInput {
  chainId?: number;
  blockNumber?: number;
  transactionHash?: string;
  logIndex?: number;
  eventName?: string;
  contractAddress?: string;
  occurredAt?: string;
  payload?: Record<string, unknown>;
}

interface ContractEventBatchInput {
  events?: ContractEventInput[];
}

interface TokenSyncState {
  tokenId: string;
  ownerWalletAddress: string | null;
  ownerUserId: string | null;
  listingStatus: "none" | "active" | "cancelled" | "completed";
  isUsed: boolean;
  isRefunded: boolean;
  usedAt: string | null;
  refundedAt: string | null;
  lastEventName: string | null;
  lastTransactionHash: string | null;
  lastLogIndex: number | null;
  lastSyncedBlock: number;
  updatedAt: string;
}

interface EventProcessingResult {
  eventKey: string;
  status: "processed" | "duplicate" | "rejected";
  reason?: string;
}

class InvalidJsonError extends Error {
  constructor() {
    super("Invalid JSON payload");
    this.name = "InvalidJsonError";
  }
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

  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new InvalidJsonError();
  }
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

function getPayloadString(payload: Record<string, unknown> | undefined, key: string): string | null {
  if (!payload) {
    return null;
  }

  const value = payload[key];
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed || null;
}

export function createContractSyncServer(config: ContractSyncConfig) {
  const processedEventKeys = new Set<string>();
  const tokenStateById = new Map<string, TokenSyncState>();

  let lastProcessedBlock = 0;
  let totalEventsProcessed = 0;
  let totalEventsRejected = 0;
  let totalEventsDuplicate = 0;

  const ensureTokenState = (tokenId: string): TokenSyncState => {
    const existing = tokenStateById.get(tokenId);
    if (existing) {
      return existing;
    }

    const created: TokenSyncState = {
      tokenId,
      ownerWalletAddress: null,
      ownerUserId: null,
      listingStatus: "none",
      isUsed: false,
      isRefunded: false,
      usedAt: null,
      refundedAt: null,
      lastEventName: null,
      lastTransactionHash: null,
      lastLogIndex: null,
      lastSyncedBlock: 0,
      updatedAt: new Date().toISOString()
    };

    tokenStateById.set(tokenId, created);
    return created;
  };

  const applyEvent = (event: ContractEventInput): EventProcessingResult => {
    const transactionHash = event.transactionHash?.trim() ?? "";
    const logIndex = typeof event.logIndex === "number" ? event.logIndex : -1;
    const eventName = event.eventName?.trim() ?? "";

    if (!transactionHash || logIndex < 0 || !eventName) {
      totalEventsRejected += 1;
      return {
        eventKey: `${transactionHash || "missing-tx"}:${logIndex}`,
        status: "rejected",
        reason: "transactionHash, logIndex, eventName are required"
      };
    }

    const eventKey = `${transactionHash}:${logIndex}`;
    if (processedEventKeys.has(eventKey)) {
      totalEventsDuplicate += 1;
      return {
        eventKey,
        status: "duplicate"
      };
    }

    const payload = event.payload;
    const tokenId = getPayloadString(payload, "tokenId");
    if (!tokenId) {
      totalEventsRejected += 1;
      return {
        eventKey,
        status: "rejected",
        reason: "payload.tokenId is required"
      };
    }

    const normalized = eventName.toLowerCase();
    const current = ensureTokenState(tokenId);

    if (normalized === "transfer") {
      const toWallet = getPayloadString(payload, "to");
      if (!toWallet) {
        totalEventsRejected += 1;
        return {
          eventKey,
          status: "rejected",
          reason: "transfer event requires payload.to"
        };
      }

      current.ownerWalletAddress = toWallet;
      current.ownerUserId = getPayloadString(payload, "toUserId");
    } else if (normalized === "ticketused") {
      current.isUsed = true;
      current.usedAt = getPayloadString(payload, "usedAt") ?? event.occurredAt?.trim() ?? new Date().toISOString();
    } else if (normalized === "ticketrefunded") {
      current.isRefunded = true;
      current.refundedAt =
        getPayloadString(payload, "refundedAt") ?? event.occurredAt?.trim() ?? new Date().toISOString();
    } else if (normalized === "listingstatuschanged") {
      const status = getPayloadString(payload, "status")?.toLowerCase();
      if (status !== "active" && status !== "cancelled" && status !== "completed") {
        totalEventsRejected += 1;
        return {
          eventKey,
          status: "rejected",
          reason: "listingStatusChanged event requires payload.status in active/cancelled/completed"
        };
      }

      current.listingStatus = status;
    } else {
      totalEventsRejected += 1;
      return {
        eventKey,
        status: "rejected",
        reason: `Unsupported eventName: ${eventName}`
      };
    }

    if (typeof event.blockNumber === "number" && event.blockNumber > 0) {
      current.lastSyncedBlock = Math.max(current.lastSyncedBlock, event.blockNumber);
      lastProcessedBlock = Math.max(lastProcessedBlock, event.blockNumber);
    }

    current.lastEventName = eventName;
    current.lastTransactionHash = transactionHash;
    current.lastLogIndex = logIndex;
    current.updatedAt = new Date().toISOString();

    processedEventKeys.add(eventKey);
    totalEventsProcessed += 1;

    return {
      eventKey,
      status: "processed"
    };
  };

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

      if (
        method === "POST" &&
        (url.pathname === "/contract-events" || url.pathname === "/internal/contracts/events")
      ) {
        if (extractSingleHeader(req, "x-internal-api-key") !== config.internalApiKey) {
          return sendJson(res, 401, {
            success: false,
            error: {
              code: "UNAUTHORIZED_INTERNAL",
              message: "Missing or invalid x-internal-api-key"
            }
          });
        }

        const body = await readJson<ContractEventBatchInput | ContractEventInput>(req);
        const events = Array.isArray((body as ContractEventBatchInput).events)
          ? (body as ContractEventBatchInput).events ?? []
          : [body as ContractEventInput];

        if (events.length === 0) {
          return sendJson(res, 400, {
            success: false,
            error: {
              code: "INVALID_EVENT_PAYLOAD",
              message: "events must contain at least one event"
            }
          });
        }

        const results = events.map((event) => applyEvent(event));

        return sendJson(res, 200, {
          success: true,
          data: {
            accepted: results.filter((item) => item.status === "processed").length,
            duplicates: results.filter((item) => item.status === "duplicate").length,
            rejected: results.filter((item) => item.status === "rejected").length,
            results
          }
        });
      }

      const tokenMatch = url.pathname.match(/^\/(?:internal\/contracts\/)?tokens\/([^/]+)$/);
      if (method === "GET" && tokenMatch) {
        const tokenId = tokenMatch[1];
        const token = tokenStateById.get(tokenId);

        if (!token) {
          return sendJson(res, 404, {
            success: false,
            error: {
              code: "TICKET_NOT_FOUND",
              message: "Token state not found"
            }
          });
        }

        return sendJson(res, 200, {
          success: true,
          data: token
        });
      }

      if (
        method === "GET" &&
        (url.pathname === "/sync/status" || url.pathname === "/internal/contracts/sync-status")
      ) {
        return sendJson(res, 200, {
          success: true,
          data: {
            lastProcessedBlock,
            totalEventsProcessed,
            totalEventsDuplicate,
            totalEventsRejected,
            trackedTokens: tokenStateById.size,
            processedEventCount: processedEventKeys.size,
            timestamp: new Date().toISOString()
          }
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
}
