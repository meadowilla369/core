import { createHash, randomBytes, randomUUID } from "node:crypto";
import { createServer, IncomingMessage, ServerResponse } from "node:http";

import { createPostgresPool, queryMany, queryOne } from "@ticket-platform/local-infra";
import type { Pool } from "pg";

import type { MarketplaceConfig } from "./config.js";
import {
  buildBuyTypedData,
  computeBuyPaymentHash,
  deriveAddressFromPrivateKey,
  signBuyTypedData,
  type BuyTypedData
} from "./ethereum.js";
import { log } from "./logger.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type BuyHashStatus = "issued" | "expired" | "used";

interface CreateListingBody {
  tokenId?: string;
  eventId?: string;
  originalPrice?: number;
  askPrice?: number;
  sellerWalletAddress?: string;
}

interface InitiateBuyBody {
  orderId?: string;
  amount?: number;
  buyerWalletAddress?: string;
  onChainListingId?: number | string;
}

interface BroadcastBuyBody {
  authorizationHash?: string;
  signedAuthorization?: Record<string, unknown>;
  tx?: { to?: string; data?: string; chainId?: number };
  paymentId?: string;
}

interface Listing {
  id: string;
  tokenId: string;
  eventId: string;
  sellerUserId: string;
  sellerWalletAddress: string;
  originalPrice: number;
  askPrice: number;
  currency: "VND";
  createdAt: string;
}

interface ListingWithState extends Listing {
  listingStatus: "none" | "active" | "cancelled" | "completed";
  onChainListingId: number | null;
}

interface ListingRow {
  id: string;
  token_id: string;
  event_id: string;
  seller_user_id: string;
  seller_wallet_address: string;
  original_price: number | string;
  ask_price: number | string;
  currency: "VND";
  created_at: string | Date;
}

interface BuyHashRecord {
  orderId: string;
  listingId: string;
  buyerUserId: string;
  buyerWalletAddress: string;
  amount: number;
  nonce: string;
  paymentHash: string;
  signature: string;
  signerAddress: string;
  status: BuyHashStatus;
  issuedAt: string;
  expiresAt: string;
  chainId: number;
  verifyingContract: string;
  typedData: BuyTypedData;
}

interface BuyHashRow {
  order_id: string;
  listing_id: string;
  buyer_user_id: string;
  buyer_wallet_address: string;
  amount: number | string;
  nonce: string;
  payment_hash: string;
  signature: string;
  signer_address: string;
  status: BuyHashStatus;
  issued_at: string | Date;
  expires_at: string | Date;
  chain_id: number | string;
  verifying_contract: string;
  typed_data: BuyTypedData;
}

interface ContractSyncTokenState {
  tokenId: string;
  sourceListingId?: string | null;
  ownerWalletAddress: string | null;
  ownerUserId: string | null;
  listingStatus: "none" | "active" | "cancelled" | "completed";
  isUsed: boolean;
  isRefunded: boolean;
  lastTransactionHash: string | null;
  lastSyncedBlock: number;
  updatedAt: string;
}

interface IdempotencyRow {
  scope: string;
  response: unknown;
  expires_at: string | Date;
}

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------

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
  const rawBody = Buffer.concat(chunks).toString("utf-8").trim();
  if (!rawBody) return {} as T;
  return JSON.parse(rawBody) as T;
}

function extractSingleHeader(req: IncomingMessage, headerName: string): string | null {
  const value = req.headers[headerName.toLowerCase()];
  if (!value) return null;
  const normalized = Array.isArray(value) ? value[0] : value;
  const trimmed = normalized?.trim();
  return trimmed ? trimmed : null;
}

function extractUserId(req: IncomingMessage): string | null {
  return extractSingleHeader(req, "x-user-id");
}

function hasInternalAccess(req: IncomingMessage, config: MarketplaceConfig): boolean {
  return extractSingleHeader(req, "x-internal-api-key") === config.internalApiKey;
}

function extractIdempotencyKey(req: IncomingMessage): string | null {
  return extractSingleHeader(req, "idempotency-key");
}

function createIdempotencyScope(method: string, path: string, key: string | null): string | null {
  if (!key) return null;
  return `${method}:${path}:${key}`;
}

function sha256Hex(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}

function toIso(value: string | Date): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function normalizeWalletAddress(value: string | null | undefined): string {
  return value?.trim().toLowerCase() ?? "";
}

// ---------------------------------------------------------------------------
// Mappers
// ---------------------------------------------------------------------------

function mapListing(row: ListingRow): Listing {
  return {
    id: row.id,
    tokenId: row.token_id,
    eventId: row.event_id,
    sellerUserId: row.seller_user_id,
    sellerWalletAddress: row.seller_wallet_address,
    originalPrice: Number(row.original_price),
    askPrice: Number(row.ask_price),
    currency: row.currency,
    createdAt: toIso(row.created_at)
  };
}

function mapBuyHash(row: BuyHashRow): BuyHashRecord {
  return {
    orderId: row.order_id,
    listingId: row.listing_id,
    buyerUserId: row.buyer_user_id,
    buyerWalletAddress: row.buyer_wallet_address,
    amount: Number(row.amount),
    nonce: row.nonce,
    paymentHash: row.payment_hash,
    signature: row.signature,
    signerAddress: row.signer_address,
    status: row.status,
    issuedAt: toIso(row.issued_at),
    expiresAt: toIso(row.expires_at),
    chainId: Number(row.chain_id),
    verifyingContract: row.verifying_contract,
    typedData: row.typed_data
  };
}

function buildBuyHashResponse(record: BuyHashRecord): Record<string, unknown> {
  return {
    orderId: record.orderId,
    listingId: record.listingId,
    buyerUserId: record.buyerUserId,
    buyerWalletAddress: record.buyerWalletAddress,
    amount: record.amount,
    nonce: record.nonce,
    paymentHash: record.paymentHash,
    signature: record.signature,
    signerAddress: record.signerAddress,
    status: record.status,
    issuedAt: record.issuedAt,
    expiresAt: record.expiresAt,
    domain: {
      name: record.typedData.domain.name,
      version: record.typedData.domain.version,
      chainId: record.chainId,
      verifyingContract: record.verifyingContract
    }
  };
}

// ---------------------------------------------------------------------------
// DB schema
// ---------------------------------------------------------------------------

async function ensureSchema(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS marketplace_listings (
      id                    TEXT PRIMARY KEY,
      token_id              TEXT NOT NULL,
      event_id              TEXT NOT NULL,
      seller_user_id        TEXT NOT NULL,
      seller_wallet_address TEXT NOT NULL,
      original_price        INTEGER NOT NULL,
      ask_price             INTEGER NOT NULL,
      currency              TEXT NOT NULL DEFAULT 'VND',
      created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_marketplace_listings_token_id
    ON marketplace_listings (token_id);
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS marketplace_buy_hashes (
      order_id              TEXT PRIMARY KEY,
      listing_id            TEXT NOT NULL REFERENCES marketplace_listings(id) ON DELETE CASCADE,
      buyer_user_id         TEXT NOT NULL,
      buyer_wallet_address  TEXT NOT NULL,
      amount                INTEGER NOT NULL,
      nonce                 TEXT NOT NULL,
      payment_hash          TEXT NOT NULL,
      signature             TEXT NOT NULL,
      signer_address        TEXT NOT NULL,
      status                TEXT NOT NULL CHECK (status IN ('issued', 'expired', 'used')),
      issued_at             TIMESTAMPTZ NOT NULL,
      expires_at            TIMESTAMPTZ NOT NULL,
      chain_id              INTEGER NOT NULL,
      verifying_contract    TEXT NOT NULL,
      typed_data            JSONB NOT NULL
    );
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_marketplace_buy_hashes_listing_user
    ON marketplace_buy_hashes (listing_id, buyer_user_id, issued_at DESC);
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS marketplace_idempotency (
      scope      TEXT PRIMARY KEY,
      response   JSONB NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}

async function cleanupExpiredState(pool: Pool): Promise<void> {
  await pool.query(
    `UPDATE marketplace_buy_hashes SET status = 'expired'
     WHERE status = 'issued' AND expires_at <= NOW()`
  );
  await pool.query(`DELETE FROM marketplace_idempotency WHERE expires_at <= NOW()`);
}

// ---------------------------------------------------------------------------
// DB queries
// ---------------------------------------------------------------------------

async function loadListing(pool: Pool, listingId: string): Promise<Listing | null> {
  const row = await queryOne<ListingRow>(
    pool,
    `SELECT id, token_id, event_id, seller_user_id, seller_wallet_address,
            original_price, ask_price, currency, created_at
     FROM marketplace_listings WHERE id = $1`,
    [listingId]
  );
  return row ? mapListing(row) : null;
}

async function loadListingByToken(pool: Pool, tokenId: string): Promise<Listing | null> {
  const row = await queryOne<ListingRow>(
    pool,
    `SELECT id, token_id, event_id, seller_user_id, seller_wallet_address,
            original_price, ask_price, currency, created_at
     FROM marketplace_listings WHERE token_id = $1`,
    [tokenId]
  );
  return row ? mapListing(row) : null;
}

async function loadLatestBuyHash(
  pool: Pool,
  listingId: string,
  buyerUserId: string
): Promise<BuyHashRecord | null> {
  const row = await queryOne<BuyHashRow>(
    pool,
    `SELECT order_id, listing_id, buyer_user_id, buyer_wallet_address, amount, nonce,
            payment_hash, signature, signer_address, status, issued_at, expires_at,
            chain_id, verifying_contract, typed_data
     FROM marketplace_buy_hashes
     WHERE listing_id = $1 AND buyer_user_id = $2
     ORDER BY issued_at DESC LIMIT 1`,
    [listingId, buyerUserId]
  );

  if (!row) return null;

  if (row.status === "issued" && new Date(row.expires_at).getTime() <= Date.now()) {
    await pool.query(`UPDATE marketplace_buy_hashes SET status = 'expired' WHERE order_id = $1`, [
      row.order_id
    ]);
    row.status = "expired";
  }

  return mapBuyHash(row);
}

// ---------------------------------------------------------------------------
// Idempotency
// ---------------------------------------------------------------------------

async function getCachedIdempotency(pool: Pool, scope: string | null): Promise<unknown | null> {
  if (!scope) return null;
  const row = await queryOne<IdempotencyRow>(
    pool,
    `SELECT scope, response, expires_at FROM marketplace_idempotency
     WHERE scope = $1 AND expires_at > NOW()`,
    [scope]
  );
  return row?.response ?? null;
}

async function setCachedIdempotency(
  pool: Pool,
  scope: string | null,
  response: unknown
): Promise<void> {
  if (!scope) return;
  await pool.query(
    `INSERT INTO marketplace_idempotency (scope, response, expires_at)
     VALUES ($1, $2::jsonb, NOW() + INTERVAL '24 hours')
     ON CONFLICT (scope) DO UPDATE
       SET response = EXCLUDED.response, expires_at = EXCLUDED.expires_at`,
    [scope, JSON.stringify(response)]
  );
}

// ---------------------------------------------------------------------------
// Contract-sync integration
// ---------------------------------------------------------------------------

async function loadContractSyncToken(
  config: MarketplaceConfig,
  tokenId: string
): Promise<ContractSyncTokenState | null> {
  try {
    const response = await fetch(
      `${config.contractSyncServiceBaseUrl}/tokens/${encodeURIComponent(tokenId)}`,
      { headers: { accept: "application/json" } }
    );
    if (response.status === 404) return null;
    const payload = (await response.json()) as { success: boolean; data: ContractSyncTokenState };
    if (!response.ok || !payload?.success) return null;
    return payload.data;
  } catch {
    return null;
  }
}

async function enrichListingWithState(
  config: MarketplaceConfig,
  listing: Listing
): Promise<ListingWithState> {
  const tokenState = await loadContractSyncToken(config, listing.tokenId);
  return {
    ...listing,
    listingStatus: tokenState?.listingStatus ?? "none",
    onChainListingId: tokenState?.sourceListingId ? Number(tokenState.sourceListingId) : null
  };
}

// ---------------------------------------------------------------------------
// Server
// ---------------------------------------------------------------------------

export async function createMarketplaceServer(config: MarketplaceConfig) {
  const pool = createPostgresPool(process.env);
  await ensureSchema(pool);
  await cleanupExpiredState(pool);

  const cleanupTimer = setInterval(() => {
    void cleanupExpiredState(pool).catch((error) => {
      log(config.serviceName, "error", "Failed to cleanup marketplace state", {
        error: error instanceof Error ? error.message : String(error)
      });
    });
  }, 60_000);

  let cachedSignerAddress: string | null = null;
  const getSignerAddress = (): string => {
    if (!cachedSignerAddress && config.backendSignerPrivateKey) {
      cachedSignerAddress = deriveAddressFromPrivateKey(config.backendSignerPrivateKey);
    }
    return cachedSignerAddress ?? "";
  };

  const server = createServer(async (req, res) => {
    try {
      const method = req.method ?? "GET";
      const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);

      // ── Health ────────────────────────────────────────────────────────────
      if (method === "GET" && url.pathname === "/healthz") {
        const counts = await queryOne<{ total: string }>(
          pool,
          `SELECT COUNT(*)::text AS total FROM marketplace_listings`
        );
        return sendJson(res, 200, {
          success: true,
          data: {
            service: config.serviceName,
            status: "ok",
            storage: "postgres",
            timestamp: new Date().toISOString(),
            totalListings: Number(counts?.total ?? 0)
          }
        });
      }

      // ── GET /marketplace/listings ─────────────────────────────────────────
      if (method === "GET" && url.pathname === "/marketplace/listings") {
        const eventFilter = url.searchParams.get("eventId")?.trim();
        const sellerFilter = url.searchParams.get("sellerUserId")?.trim();
        const params: string[] = [];
        const conditions: string[] = [];
        if (eventFilter) {
          params.push(eventFilter);
          conditions.push(`event_id = $${params.length}`);
        }
        if (sellerFilter) {
          params.push(sellerFilter);
          conditions.push(`seller_user_id = $${params.length}`);
        }
        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
        const rows = await queryMany<ListingRow>(
          pool,
          `SELECT id, token_id, event_id, seller_user_id, seller_wallet_address,
                  original_price, ask_price, currency, created_at
           FROM marketplace_listings ${whereClause} ORDER BY created_at DESC`,
          params
        );

        const listings = rows.map(mapListing);
        const enriched = await Promise.all(listings.map((l) => enrichListingWithState(config, l)));

        return sendJson(res, 200, { success: true, data: enriched });
      }

      // ── POST /marketplace/listings ────────────────────────────────────────
      if (method === "POST" && url.pathname === "/marketplace/listings") {
        const userId = extractUserId(req);
        if (!userId) {
          return sendJson(res, 401, {
            success: false,
            error: { code: "UNAUTHORIZED", message: "Missing x-user-id header" }
          });
        }

        const kycStatus = extractSingleHeader(req, "x-kyc-status")?.toLowerCase() ?? "pending";
        if (kycStatus !== "approved") {
          return sendJson(res, 403, {
            success: false,
            error: { code: "KYC_REQUIRED", message: "KYC approval required before listing" }
          });
        }

        const idempotencyScope = createIdempotencyScope(
          method,
          url.pathname,
          extractIdempotencyKey(req)
        );
        const cached = await getCachedIdempotency(pool, idempotencyScope);
        if (cached) return sendJson(res, 200, cached);

        const body = await readJson<CreateListingBody>(req);
        const tokenId = body.tokenId?.trim() ?? "";
        const eventId = body.eventId?.trim() ?? "";
        const sellerWalletAddress = normalizeWalletAddress(body.sellerWalletAddress);
        const originalPrice = body.originalPrice;
        const askPrice = body.askPrice;

        if (
          !tokenId ||
          !eventId ||
          !sellerWalletAddress ||
          originalPrice == null ||
          askPrice == null
        ) {
          return sendJson(res, 400, {
            success: false,
            error: {
              code: "INVALID_LISTING_PAYLOAD",
              message: "tokenId, eventId, sellerWalletAddress, originalPrice, askPrice are required"
            }
          });
        }

        if (originalPrice <= 0 || askPrice <= 0) {
          return sendJson(res, 400, {
            success: false,
            error: { code: "INVALID_PRICE", message: "Prices must be positive" }
          });
        }

        const priceCap = Math.floor((originalPrice * config.maxMarkupBps) / 10000);
        if (askPrice > priceCap) {
          return sendJson(res, 400, {
            success: false,
            error: {
              code: "MARKUP_EXCEEDED",
              message: `askPrice exceeds max allowed cap ${priceCap}`
            }
          });
        }

        // Check if token already has a listing record; if active on-chain, reject
        const existingListing = await loadListingByToken(pool, tokenId);
        if (existingListing) {
          const tokenState = await loadContractSyncToken(config, tokenId);
          if (tokenState?.listingStatus === "active") {
            return sendJson(res, 409, {
              success: false,
              error: { code: "LISTING_ALREADY_ACTIVE", message: "Token already has active listing" }
            });
          }
          // Completed or cancelled — remove old record to allow re-listing
          await pool.query(`DELETE FROM marketplace_listings WHERE token_id = $1`, [tokenId]);
        }

        const listingId = `lst_${randomUUID().replace(/-/g, "")}`;
        const nowIso = new Date().toISOString();
        await pool.query(
          `INSERT INTO marketplace_listings
             (id, token_id, event_id, seller_user_id, seller_wallet_address,
              original_price, ask_price, currency, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, 'VND', $8::timestamptz)`,
          [
            listingId,
            tokenId,
            eventId,
            userId,
            sellerWalletAddress,
            originalPrice,
            askPrice,
            nowIso
          ]
        );

        const listing = await loadListing(pool, listingId);
        const response = { success: true, data: listing };
        await setCachedIdempotency(pool, idempotencyScope, response);
        return sendJson(res, 200, response);
      }

      // ── GET /marketplace/listings/:id ─────────────────────────────────────
      const singleListingMatch = /^\/marketplace\/listings\/([^/]+)$/.exec(url.pathname);
      if (method === "GET" && singleListingMatch) {
        const listing = await loadListing(pool, singleListingMatch[1]);
        if (!listing) {
          return sendJson(res, 404, {
            success: false,
            error: { code: "LISTING_NOT_FOUND", message: "Listing not found" }
          });
        }
        const enriched = await enrichListingWithState(config, listing);
        return sendJson(res, 200, { success: true, data: enriched });
      }

      // ── DELETE /marketplace/listings/:id ──────────────────────────────────
      const cancelMatch = /^\/marketplace\/listings\/([^/]+)$/.exec(url.pathname);
      if (method === "DELETE" && cancelMatch) {
        const userId = extractUserId(req);
        if (!userId) {
          return sendJson(res, 401, {
            success: false,
            error: { code: "UNAUTHORIZED", message: "Missing x-user-id header" }
          });
        }

        const listing = await loadListing(pool, cancelMatch[1]);
        if (!listing) {
          return sendJson(res, 404, {
            success: false,
            error: { code: "LISTING_NOT_FOUND", message: "Listing not found" }
          });
        }

        if (listing.sellerUserId !== userId) {
          return sendJson(res, 403, {
            success: false,
            error: { code: "FORBIDDEN", message: "Only seller can cancel listing" }
          });
        }

        await pool.query(`DELETE FROM marketplace_listings WHERE id = $1`, [listing.id]);
        return sendJson(res, 200, { success: true, data: { listingId: listing.id } });
      }

      // ── POST /marketplace/listings/:id/initiate-buy ───────────────────────
      const initiateBuyMatch = /^\/marketplace\/listings\/([^/]+)\/initiate-buy$/.exec(
        url.pathname
      );
      if (method === "POST" && initiateBuyMatch) {
        const userId = extractUserId(req);
        if (!userId) {
          return sendJson(res, 401, {
            success: false,
            error: { code: "UNAUTHORIZED", message: "Missing x-user-id header" }
          });
        }

        const listing = await loadListing(pool, initiateBuyMatch[1]);
        if (!listing) {
          return sendJson(res, 404, {
            success: false,
            error: { code: "LISTING_NOT_FOUND", message: "Listing not found" }
          });
        }

        // Check listing status from contract-sync (source of truth)
        const tokenState = await loadContractSyncToken(config, listing.tokenId);
        const listingStatus = tokenState?.listingStatus ?? "none";
        if (listingStatus !== "active") {
          return sendJson(res, 400, {
            success: false,
            error: { code: "LISTING_NOT_ACTIVE", message: "Listing is not active on-chain" }
          });
        }

        if (listing.sellerUserId === userId) {
          return sendJson(res, 400, {
            success: false,
            error: { code: "SELF_PURCHASE_FORBIDDEN", message: "Seller cannot buy own listing" }
          });
        }

        if (!config.backendSignerPrivateKey || !config.marketplaceAddress) {
          return sendJson(res, 503, {
            success: false,
            error: { code: "SIGNING_UNAVAILABLE", message: "Marketplace signing is not configured" }
          });
        }

        const body = await readJson<InitiateBuyBody>(req);
        const orderId = body.orderId?.trim() || `ord_buy_${randomUUID().replace(/-/g, "")}`;
        const amount = body.amount ?? listing.askPrice;
        const buyerWalletAddress = normalizeWalletAddress(body.buyerWalletAddress);
        const rawOnChainId = body.onChainListingId;
        const onChainListingId =
          rawOnChainId !== undefined && rawOnChainId !== null
            ? typeof rawOnChainId === "number"
              ? rawOnChainId
              : parseInt(String(rawOnChainId), 10)
            : NaN;

        if (!buyerWalletAddress || !/^0x[0-9a-f]{40}$/.test(buyerWalletAddress)) {
          return sendJson(res, 400, {
            success: false,
            error: {
              code: "INVALID_BUYER_WALLET",
              message: "buyerWalletAddress must be a valid EVM address"
            }
          });
        }

        if (isNaN(onChainListingId) || onChainListingId <= 0) {
          return sendJson(res, 400, {
            success: false,
            error: {
              code: "INVALID_ON_CHAIN_LISTING_ID",
              message:
                "onChainListingId must be a positive integer matching MarketplaceV2 listingId"
            }
          });
        }

        // Return existing valid buy hash if present
        const existing = await loadLatestBuyHash(pool, listing.id, userId);
        if (existing && existing.status === "issued") {
          return sendJson(res, 200, { success: true, data: buildBuyHashResponse(existing) });
        }

        const nowMs = Date.now();
        const nonce = `0x${randomBytes(32).toString("hex")}`;
        const paymentHash = computeBuyPaymentHash({
          orderId,
          userId,
          listingId: onChainListingId,
          amount: BigInt(Math.trunc(amount)),
          nonce
        });

        const typedData = buildBuyTypedData({
          chainId: config.marketplaceChainId ?? 31337,
          verifyingContract: config.marketplaceAddress,
          listingId: onChainListingId,
          paymentHash,
          buyer: buyerWalletAddress
        });

        const signature = signBuyTypedData({
          privateKey: config.backendSignerPrivateKey,
          typedData
        });

        const issuedAt = new Date(nowMs).toISOString();
        const expiresAt = new Date(nowMs + (config.buyHashTtlSec ?? 900) * 1000).toISOString();

        await pool.query(
          `INSERT INTO marketplace_buy_hashes
             (order_id, listing_id, buyer_user_id, buyer_wallet_address, amount, nonce,
              payment_hash, signature, signer_address, status, issued_at, expires_at,
              chain_id, verifying_contract, typed_data)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'issued',
                   $10::timestamptz, $11::timestamptz, $12, $13, $14::jsonb)`,
          [
            orderId,
            listing.id,
            userId,
            buyerWalletAddress,
            Math.trunc(amount),
            nonce,
            paymentHash,
            signature,
            getSignerAddress(),
            issuedAt,
            expiresAt,
            config.marketplaceChainId ?? 31337,
            config.marketplaceAddress,
            JSON.stringify(typedData)
          ]
        );

        const created = await queryOne<BuyHashRow>(
          pool,
          `SELECT order_id, listing_id, buyer_user_id, buyer_wallet_address, amount, nonce,
                  payment_hash, signature, signer_address, status, issued_at, expires_at,
                  chain_id, verifying_contract, typed_data
           FROM marketplace_buy_hashes WHERE order_id = $1`,
          [orderId]
        );

        log(config.serviceName, "info", "Buy hash issued", {
          orderId,
          listingId: listing.id,
          buyerUserId: userId
        });

        return sendJson(res, 200, {
          success: true,
          data: buildBuyHashResponse(mapBuyHash(created as BuyHashRow))
        });
      }

      // ── GET /marketplace/listings/:id/buy-hash ────────────────────────────
      const buyHashMatch = /^\/marketplace\/listings\/([^/]+)\/buy-hash$/.exec(url.pathname);
      if (method === "GET" && buyHashMatch) {
        const userId = extractUserId(req);
        if (!userId) {
          return sendJson(res, 401, {
            success: false,
            error: { code: "UNAUTHORIZED", message: "Missing x-user-id header" }
          });
        }

        const record = await loadLatestBuyHash(pool, buyHashMatch[1], userId);
        if (!record) {
          return sendJson(res, 404, {
            success: false,
            error: {
              code: "BUY_HASH_NOT_FOUND",
              message: "No buy hash found. Call initiate-buy first."
            }
          });
        }

        return sendJson(res, 200, { success: true, data: buildBuyHashResponse(record) });
      }

      // ── POST /marketplace/listings/:id/broadcast-buy ──────────────────────
      const broadcastBuyMatch = /^\/marketplace\/listings\/([^/]+)\/broadcast-buy$/.exec(
        url.pathname
      );
      if (method === "POST" && broadcastBuyMatch) {
        const userId = extractUserId(req);
        if (!userId) {
          return sendJson(res, 401, {
            success: false,
            error: { code: "UNAUTHORIZED", message: "Missing x-user-id header" }
          });
        }

        const idempotencyScope = createIdempotencyScope(
          method,
          url.pathname,
          extractIdempotencyKey(req)
        );
        const cached = await getCachedIdempotency(pool, idempotencyScope);
        if (cached) return sendJson(res, 200, cached);

        const listing = await loadListing(pool, broadcastBuyMatch[1]);
        if (!listing) {
          return sendJson(res, 404, {
            success: false,
            error: { code: "LISTING_NOT_FOUND", message: "Listing not found" }
          });
        }

        const buyHash = await loadLatestBuyHash(pool, listing.id, userId);
        if (!buyHash || buyHash.status !== "issued") {
          return sendJson(res, 400, {
            success: false,
            error: {
              code: "BUY_HASH_NOT_FOUND_OR_EXPIRED",
              message: "No valid buy hash. Call initiate-buy first."
            }
          });
        }

        const body = await readJson<BroadcastBuyBody>(req);

        await pool.query(`UPDATE marketplace_buy_hashes SET status = 'used' WHERE order_id = $1`, [
          buyHash.orderId
        ]);

        const response = {
          success: true,
          data: {
            listingId: listing.id,
            buyHashOrderId: buyHash.orderId,
            txHash: body.tx ? sha256Hex(JSON.stringify(body.tx)) : null
          }
        };

        await setCachedIdempotency(pool, idempotencyScope, response);

        log(config.serviceName, "info", "Broadcast buy recorded", {
          listingId: listing.id,
          orderId: buyHash.orderId,
          buyerUserId: userId
        });

        return sendJson(res, 200, response);
      }

      return sendJson(res, 404, {
        success: false,
        error: { code: "NOT_FOUND", message: "Route not found" }
      });
    } catch (error) {
      log(config.serviceName, "error", "Unhandled request error", {
        error: error instanceof Error ? error.message : String(error)
      });
      return sendJson(res, 500, {
        success: false,
        error: { code: "INTERNAL_ERROR", message: "Internal server error" }
      });
    }
  });

  server.on("close", () => {
    clearInterval(cleanupTimer);
    void pool.end();
  });

  return server;
}
