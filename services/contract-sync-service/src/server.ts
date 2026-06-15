import { createServer, IncomingMessage, ServerResponse, type Server } from "node:http";

import {
  createPostgresPool,
  queryMany,
  queryOne,
  withPostgresTransaction
} from "@ticket-platform/local-infra";
import type { Pool, PoolClient } from "pg";

import type { ContractSyncConfig } from "./config.js";
import { log } from "./logger.js";

interface ContractEventInput {
  chainId?: number;
  blockNumber?: number;
  blockHash?: string;
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

type ListingStatus = "none" | "active" | "cancelled" | "completed";

interface TokenSyncRow {
  chain_id: number;
  contract_address: string;
  token_id: string;
  event_id: string | null;
  ticket_type_id: string | null;
  onchain_event_id: string | null;
  onchain_ticket_type_id: string | null;
  owner_wallet_address: string;
  owner_user_id: string | null;
  listing_status: ListingStatus;
  source_listing_id: string | null;
  last_sale_price: string | number | null;
  is_used: boolean;
  used_at: string | Date | null;
  is_refunded: boolean;
  refunded_at: string | Date | null;
  last_event_name: string;
  last_tx_hash: string;
  last_log_index: number;
  last_synced_block: string | number;
  occurred_at: string | Date | null;
  updated_at: string | Date;
}

export interface TokenSyncState {
  tokenId: string;
  eventId: string | null;
  ticketTypeId: string | null;
  onchainEventId: string | null;
  onchainTicketTypeId: string | null;
  sourceListingId: string | null;
  ownerWalletAddress: string | null;
  ownerUserId: string | null;
  listingStatus: ListingStatus;
  isUsed: boolean;
  isRefunded: boolean;
  usedAt: string | null;
  refundedAt: string | null;
  lastEventName: string | null;
  lastSalePrice: number | null;
  lastTransactionHash: string | null;
  lastLogIndex: number | null;
  lastSyncedBlock: number;
  updatedAt: string;
}

export interface EventProcessingResult {
  eventKey: string;
  status: "processed" | "duplicate" | "rejected";
  reason?: string;
}

export interface ContractSyncApp {
  server: Server;
  ingestEvents: (events: ContractEventInput[]) => Promise<EventProcessingResult[]>;
  close: () => Promise<void>;
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

function getPayloadString(
  payload: Record<string, unknown> | undefined,
  key: string
): string | null {
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

function toIso(value: string | Date | null): string | null {
  if (!value) {
    return null;
  }

  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function mapTokenRow(row: TokenSyncRow): TokenSyncState {
  return {
    tokenId: row.token_id,
    eventId: row.event_id,
    ticketTypeId: row.ticket_type_id,
    onchainEventId: row.onchain_event_id,
    onchainTicketTypeId: row.onchain_ticket_type_id,
    sourceListingId: row.source_listing_id,
    ownerWalletAddress: row.owner_wallet_address,
    ownerUserId: row.owner_user_id,
    listingStatus: row.listing_status,
    isUsed: row.is_used,
    isRefunded: row.is_refunded,
    usedAt: toIso(row.used_at),
    refundedAt: toIso(row.refunded_at),
    lastEventName: row.last_event_name,
    lastSalePrice: row.last_sale_price === null ? null : Number(row.last_sale_price),
    lastTransactionHash: row.last_tx_hash,
    lastLogIndex: row.last_log_index,
    lastSyncedBlock: Number(row.last_synced_block),
    updatedAt: toIso(row.updated_at) ?? new Date().toISOString()
  };
}

async function ensureSchema(pool: Pool): Promise<void> {
  await pool.query(`
    DO $$
    BEGIN
      CREATE TYPE token_listing_status AS ENUM ('none', 'active', 'cancelled', 'completed');
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END $$;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS chain_event_logs (
      chain_id INTEGER NOT NULL CHECK (chain_id > 0),
      contract_address TEXT NOT NULL,
      tx_hash TEXT NOT NULL,
      log_index INTEGER NOT NULL CHECK (log_index >= 0),
      block_number BIGINT NOT NULL CHECK (block_number >= 0),
      block_hash TEXT,
      event_name TEXT NOT NULL,
      token_id NUMERIC(78, 0),
      onchain_event_id NUMERIC(78, 0),
      onchain_ticket_type_id NUMERIC(78, 0),
      payload JSONB NOT NULL,
      occurred_at TIMESTAMPTZ,
      indexed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (chain_id, contract_address, tx_hash, log_index)
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS token_ownerships (
      chain_id INTEGER NOT NULL CHECK (chain_id > 0),
      contract_address TEXT NOT NULL,
      token_id NUMERIC(78, 0) NOT NULL,
      event_id TEXT,
      ticket_type_id TEXT,
      onchain_event_id NUMERIC(78, 0),
      onchain_ticket_type_id NUMERIC(78, 0),
      owner_wallet_address TEXT NOT NULL,
      owner_user_id TEXT,
      listing_status token_listing_status NOT NULL DEFAULT 'none',
      source_listing_id TEXT,
      last_sale_price BIGINT CHECK (last_sale_price >= 0),
      is_used BOOLEAN NOT NULL DEFAULT FALSE,
      used_at TIMESTAMPTZ,
      is_refunded BOOLEAN NOT NULL DEFAULT FALSE,
      refunded_at TIMESTAMPTZ,
      last_event_name TEXT NOT NULL,
      last_tx_hash TEXT NOT NULL,
      last_log_index INTEGER NOT NULL CHECK (last_log_index >= 0),
      last_synced_block BIGINT NOT NULL CHECK (last_synced_block >= 0),
      occurred_at TIMESTAMPTZ,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (chain_id, contract_address, token_id)
    );
  `);
}

async function resolveEventId(
  client: Pool | PoolClient,
  onchainEventId: string | null
): Promise<string | null> {
  if (!onchainEventId) {
    return null;
  }

  const row = await queryOne<{ id: string }>(
    client,
    `SELECT id FROM events WHERE onchain_event_id = $1::numeric`,
    [onchainEventId]
  );
  return row?.id ?? null;
}

async function resolveTicketType(
  client: Pool | PoolClient,
  onchainTicketTypeId: string | null
): Promise<{ ticketTypeId: string | null; eventId: string | null }> {
  if (!onchainTicketTypeId) {
    return { ticketTypeId: null, eventId: null };
  }

  const row = await queryOne<{ id: string; event_id: string }>(
    client,
    `SELECT id, event_id FROM ticket_types WHERE onchain_ticket_type_id = $1::numeric`,
    [onchainTicketTypeId]
  );

  return {
    ticketTypeId: row?.id ?? null,
    eventId: row?.event_id ?? null
  };
}

async function upsertProjection(
  client: PoolClient,
  event: ContractEventInput
): Promise<EventProcessingResult> {
  const transactionHash = event.transactionHash?.trim() ?? "";
  const logIndex = typeof event.logIndex === "number" ? event.logIndex : -1;
  const eventName = event.eventName?.trim() ?? "";
  const contractAddress = event.contractAddress?.trim() ?? "";
  const chainId = typeof event.chainId === "number" && event.chainId > 0 ? event.chainId : 31337;
  const blockNumber =
    typeof event.blockNumber === "number" && event.blockNumber >= 0 ? event.blockNumber : -1;

  if (!transactionHash || logIndex < 0 || !eventName || !contractAddress || blockNumber < 0) {
    return {
      eventKey: `${transactionHash || "missing-tx"}:${logIndex}`,
      status: "rejected",
      reason:
        "chainId, blockNumber, transactionHash, logIndex, eventName, contractAddress are required"
    };
  }

  const eventKey = `${chainId}:${contractAddress}:${transactionHash}:${logIndex}`;
  const payload = event.payload;
  const tokenId = getPayloadString(payload, "tokenId");
  if (!tokenId) {
    return {
      eventKey,
      status: "rejected",
      reason: "payload.tokenId is required"
    };
  }

  const normalized = eventName.toLowerCase();
  const onchainEventId = getPayloadString(payload, "eventId");
  const onchainTicketTypeId = getPayloadString(payload, "ticketTypeId");
  const resolvedTicketType = await resolveTicketType(client, onchainTicketTypeId);
  const resolvedEventId =
    resolvedTicketType.eventId ?? (await resolveEventId(client, onchainEventId));

  const insertLogResult = await client.query(
    `
      INSERT INTO chain_event_logs (
        chain_id, contract_address, tx_hash, log_index, block_number, block_hash, event_name,
        token_id, onchain_event_id, onchain_ticket_type_id, payload, occurred_at
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7,
        $8::numeric, $9::numeric, $10::numeric, $11::jsonb, $12::timestamptz
      )
      ON CONFLICT (chain_id, contract_address, tx_hash, log_index) DO NOTHING
    `,
    [
      chainId,
      contractAddress,
      transactionHash,
      logIndex,
      blockNumber,
      event.blockHash?.trim() || null,
      eventName,
      tokenId,
      onchainEventId,
      onchainTicketTypeId,
      JSON.stringify(payload ?? {}),
      event.occurredAt?.trim() || null
    ]
  );

  if (insertLogResult.rowCount === 0) {
    return {
      eventKey,
      status: "duplicate"
    };
  }

  const existing = await queryOne<TokenSyncRow>(
    client,
    `
      SELECT chain_id, contract_address, token_id, event_id, ticket_type_id, onchain_event_id,
             onchain_ticket_type_id, owner_wallet_address, owner_user_id, listing_status,
             source_listing_id, last_sale_price, is_used, used_at, is_refunded, refunded_at,
             last_event_name, last_tx_hash, last_log_index, last_synced_block, occurred_at, updated_at
      FROM token_ownerships
      WHERE chain_id = $1 AND contract_address = $2 AND token_id = $3::numeric
      FOR UPDATE
    `,
    [chainId, contractAddress, tokenId]
  );

  let ownerWalletAddress = existing?.owner_wallet_address ?? null;
  let ownerUserId = existing?.owner_user_id ?? null;
  let listingStatus: ListingStatus = existing?.listing_status ?? "none";
  let sourceListingId = existing?.source_listing_id ?? null;
  let isUsed = existing?.is_used ?? false;
  let usedAt = toIso(existing?.used_at ?? null);
  let isRefunded = existing?.is_refunded ?? false;
  let refundedAt = toIso(existing?.refunded_at ?? null);
  let lastSalePrice =
    existing?.last_sale_price === null || existing?.last_sale_price === undefined
      ? null
      : Number(existing.last_sale_price);

  if (normalized === "transfer") {
    const toWallet = getPayloadString(payload, "to");
    if (!toWallet) {
      return {
        eventKey,
        status: "rejected",
        reason: "transfer event requires payload.to"
      };
    }

    ownerWalletAddress = toWallet;
    ownerUserId = getPayloadString(payload, "toUserId") ?? ownerUserId;
    sourceListingId = getPayloadString(payload, "listingId") ?? sourceListingId;
    const price = getPayloadString(payload, "price");
    if (price) {
      const parsedPrice = Number(price);
      lastSalePrice = Number.isFinite(parsedPrice) ? parsedPrice : lastSalePrice;
    }
  } else if (normalized === "ticketused") {
    isUsed = true;
    usedAt =
      getPayloadString(payload, "usedAt") ?? event.occurredAt?.trim() ?? new Date().toISOString();
  } else if (normalized === "ticketrefunded") {
    isRefunded = true;
    refundedAt =
      getPayloadString(payload, "refundedAt") ??
      event.occurredAt?.trim() ??
      new Date().toISOString();
  } else if (normalized === "listingstatuschanged") {
    const status = getPayloadString(payload, "status")?.toLowerCase();
    if (status !== "active" && status !== "cancelled" && status !== "completed") {
      return {
        eventKey,
        status: "rejected",
        reason: "listingStatusChanged event requires payload.status in active/cancelled/completed"
      };
    }

    listingStatus = status;
    sourceListingId = getPayloadString(payload, "listingId") ?? sourceListingId;
    const price = getPayloadString(payload, "price");
    if (price) {
      const parsedPrice = Number(price);
      lastSalePrice = Number.isFinite(parsedPrice) ? parsedPrice : lastSalePrice;
    }
  } else {
    return {
      eventKey,
      status: "rejected",
      reason: `Unsupported eventName: ${eventName}`
    };
  }

  if (!ownerWalletAddress) {
    return {
      eventKey,
      status: "rejected",
      reason: "owner wallet address is not known for this token"
    };
  }

  await client.query(
    `
      INSERT INTO token_ownerships (
        chain_id, contract_address, token_id, event_id, ticket_type_id, onchain_event_id,
        onchain_ticket_type_id, owner_wallet_address, owner_user_id, listing_status,
        source_listing_id, last_sale_price, is_used, used_at, is_refunded, refunded_at,
        last_event_name, last_tx_hash, last_log_index, last_synced_block, occurred_at, updated_at
      )
      VALUES (
        $1, $2, $3::numeric, $4, $5, $6::numeric,
        $7::numeric, $8, $9, $10,
        $11, $12, $13, $14::timestamptz, $15, $16::timestamptz,
        $17, $18, $19, $20, $21::timestamptz, NOW()
      )
      ON CONFLICT (chain_id, contract_address, token_id) DO UPDATE SET
        event_id = EXCLUDED.event_id,
        ticket_type_id = EXCLUDED.ticket_type_id,
        onchain_event_id = EXCLUDED.onchain_event_id,
        onchain_ticket_type_id = EXCLUDED.onchain_ticket_type_id,
        owner_wallet_address = EXCLUDED.owner_wallet_address,
        owner_user_id = EXCLUDED.owner_user_id,
        listing_status = EXCLUDED.listing_status,
        source_listing_id = EXCLUDED.source_listing_id,
        last_sale_price = EXCLUDED.last_sale_price,
        is_used = EXCLUDED.is_used,
        used_at = EXCLUDED.used_at,
        is_refunded = EXCLUDED.is_refunded,
        refunded_at = EXCLUDED.refunded_at,
        last_event_name = EXCLUDED.last_event_name,
        last_tx_hash = EXCLUDED.last_tx_hash,
        last_log_index = EXCLUDED.last_log_index,
        last_synced_block = EXCLUDED.last_synced_block,
        occurred_at = EXCLUDED.occurred_at,
        updated_at = NOW()
    `,
    [
      chainId,
      contractAddress,
      tokenId,
      resolvedEventId,
      resolvedTicketType.ticketTypeId,
      onchainEventId,
      onchainTicketTypeId,
      ownerWalletAddress,
      ownerUserId,
      listingStatus,
      sourceListingId,
      lastSalePrice,
      isUsed,
      usedAt,
      isRefunded,
      refundedAt,
      eventName,
      transactionHash,
      logIndex,
      blockNumber,
      event.occurredAt?.trim() || null
    ]
  );

  return {
    eventKey,
    status: "processed"
  };
}

export async function createContractSyncApp(config: ContractSyncConfig): Promise<ContractSyncApp> {
  const pool = createPostgresPool(process.env);
  await ensureSchema(pool);

  const ingestEvents = async (events: ContractEventInput[]): Promise<EventProcessingResult[]> => {
    if (events.length === 0) {
      return [];
    }

    return withPostgresTransaction(pool, async (client: PoolClient) => {
      const results: EventProcessingResult[] = [];
      for (const event of events) {
        results.push(await upsertProjection(client, event));
      }
      return results;
    });
  };

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
            storage: {
              primary: "postgres"
            },
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
          ? ((body as ContractEventBatchInput).events ?? [])
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

        const results = await ingestEvents(events);
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
        const token = await queryOne<TokenSyncRow>(
          pool,
          `
            SELECT chain_id, contract_address, token_id, event_id, ticket_type_id, onchain_event_id,
                   onchain_ticket_type_id, owner_wallet_address, owner_user_id, listing_status,
                   source_listing_id, last_sale_price, is_used, used_at, is_refunded, refunded_at,
                   last_event_name, last_tx_hash, last_log_index, last_synced_block, occurred_at, updated_at
            FROM token_ownerships
            WHERE token_id = $1::numeric
            ORDER BY updated_at DESC
            LIMIT 1
          `,
          [tokenMatch[1]]
        );

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
          data: mapTokenRow(token)
        });
      }

      if (
        method === "GET" &&
        (url.pathname === "/tokens" || url.pathname === "/internal/contracts/tokens")
      ) {
        const conditions: string[] = [];
        const values: unknown[] = [];
        const ownerWalletAddress =
          url.searchParams.get("ownerWalletAddress")?.trim().toLowerCase() ?? "";
        const ownerUserId = url.searchParams.get("ownerUserId")?.trim() ?? "";
        const listingStatus = url.searchParams.get("listingStatus")?.trim().toLowerCase() ?? "";
        const eventId = url.searchParams.get("eventId")?.trim() ?? "";

        if (ownerWalletAddress) {
          values.push(ownerWalletAddress);
          conditions.push(`LOWER(owner_wallet_address) = $${values.length}`);
        }
        if (ownerUserId) {
          values.push(ownerUserId);
          conditions.push(`owner_user_id = $${values.length}`);
        }
        if (listingStatus) {
          values.push(listingStatus);
          conditions.push(`listing_status = $${values.length}`);
        }
        if (eventId) {
          values.push(eventId);
          conditions.push(`event_id = $${values.length}`);
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
        const tokens = await queryMany<TokenSyncRow>(
          pool,
          `
            SELECT chain_id, contract_address, token_id, event_id, ticket_type_id, onchain_event_id,
                   onchain_ticket_type_id, owner_wallet_address, owner_user_id, listing_status,
                   source_listing_id, last_sale_price, is_used, used_at, is_refunded, refunded_at,
                   last_event_name, last_tx_hash, last_log_index, last_synced_block, occurred_at, updated_at
            FROM token_ownerships
            ${whereClause}
            ORDER BY updated_at DESC
          `,
          values
        );

        return sendJson(res, 200, {
          success: true,
          data: tokens.map(mapTokenRow)
        });
      }

      if (
        method === "GET" &&
        (url.pathname === "/sync/status" || url.pathname === "/internal/contracts/sync-status")
      ) {
        const stats = await queryOne<{
          last_processed_block: string | null;
          total_events_processed: string;
          total_events_duplicate: string;
          tracked_tokens: string;
        }>(
          pool,
          `
            SELECT
              COALESCE(MAX(block_number), 0)::text AS last_processed_block,
              COUNT(*)::text AS total_events_processed,
              (
                SELECT COUNT(*)::text
                FROM token_ownerships
              ) AS tracked_tokens,
              '0'::text AS total_events_duplicate
            FROM chain_event_logs
          `
        );

        const rejectedCount = await queryOne<{ count: string }>(
          pool,
          `SELECT COUNT(*)::text AS count FROM chain_event_logs WHERE FALSE`
        );

        return sendJson(res, 200, {
          success: true,
          data: {
            lastProcessedBlock: Number(stats?.last_processed_block ?? 0),
            totalEventsProcessed: Number(stats?.total_events_processed ?? 0),
            totalEventsDuplicate: Number(stats?.total_events_duplicate ?? 0),
            totalEventsRejected: Number(rejectedCount?.count ?? 0),
            trackedTokens: Number(stats?.tracked_tokens ?? 0),
            processedEventCount: Number(stats?.total_events_processed ?? 0),
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

  server.on("close", () => {
    void pool.end();
  });

  return {
    server,
    ingestEvents,
    close: async () => {
      await new Promise<void>((resolve) => server.close(() => resolve()));
      await pool.end();
    }
  };
}

export async function createContractSyncServer(config: ContractSyncConfig): Promise<Server> {
  const app = await createContractSyncApp(config);
  return app.server;
}
