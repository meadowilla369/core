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

type ListingStatus = "active" | "cancelled" | "completed";
type BuyHashStatus = "issued" | "expired";

interface CreateListingBody {
  tokenId?: string;
  eventId?: string;
  originalPrice?: number;
  askPrice?: number;
  sellerWalletAddress?: string;
}

interface PurchaseListingBody {
  paymentId?: string;
  gateway?: string;
  gatewayReference?: string;
  buyerWalletAddress?: string;
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
  status: ListingStatus;
  createdAt: string;
  updatedAt: string;
  buyerUserId?: string;
  paymentId?: string;
  settlementId?: string;
}

interface CompletedSale {
  listingId: string;
  paymentId: string;
  settlementId: string;
  escrowDataHash: string;
  completeSaleRequestId: string;
  completedAt: string;
}

interface FinalizeSettlementBody {
  version?: number;
  settlementId?: string;
  listingId?: string;
  paymentId?: string;
  tokenId?: string;
  seller?: string;
  buyer?: string;
  grossAmount?: number;
  sellerAmount?: number;
  platformFee?: number;
  organizerRoyalty?: number;
  currency?: string;
  gateway?: number;
  gatewayReference?: string;
  settledAt?: number;
  nonce?: string;
}

interface SettlementLedgerRecord {
  settlementId: string;
  listingId: string;
  paymentId: string;
  escrowDataHash: string;
  submitTxHash: string;
  status: "submitted";
  submittedAt: string;
}

interface InitiateBuyBody {
  orderId?: string;
  amount?: number;
  gateway?: string;
  buyerWalletAddress?: string;
  onChainListingId?: number | string;
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

interface ListingRow {
  id: string;
  token_id: string;
  event_id: string;
  seller_user_id: string;
  seller_wallet_address: string;
  original_price: number | string;
  ask_price: number | string;
  currency: "VND";
  status: ListingStatus;
  created_at: string | Date;
  updated_at: string | Date;
  buyer_user_id: string | null;
  payment_id: string | null;
  settlement_id: string | null;
}

interface CompletedSaleRow {
  listing_id: string;
  payment_id: string;
  settlement_id: string;
  escrow_data_hash: string;
  complete_sale_request_id: string;
  completed_at: string | Date;
}

interface SettlementLedgerRow {
  settlement_id: string;
  listing_id: string;
  payment_id: string;
  escrow_data_hash: string;
  submit_tx_hash: string;
  status: "submitted";
  submitted_at: string | Date;
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

interface IdempotencyRow {
  scope: string;
  response: unknown;
  expires_at: string | Date;
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

  const rawBody = Buffer.concat(chunks).toString("utf-8").trim();
  if (!rawBody) {
    return {} as T;
  }

  return JSON.parse(rawBody) as T;
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

function hasInternalAccess(req: IncomingMessage, config: MarketplaceConfig): boolean {
  const key = extractSingleHeader(req, "x-internal-api-key");
  return key === config.internalApiKey;
}

function extractIdempotencyKey(req: IncomingMessage): string | null {
  return extractSingleHeader(req, "idempotency-key");
}

function createIdempotencyScope(method: string, path: string, key: string | null): string | null {
  if (!key) {
    return null;
  }

  return `${method}:${path}:${key}`;
}

function sha256Hex(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}

function toIso(value: string | Date): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function toGatewayCode(rawGateway: string): number | null {
  const gateway = rawGateway.trim().toLowerCase();
  if (gateway === "momo") {
    return 1;
  }

  if (gateway === "vnpay") {
    return 2;
  }

  return null;
}

function calculateFee(amount: number, bps: number): number {
  return Math.floor((amount * bps) / 10000);
}

function normalizeWalletAddress(value: string | null | undefined): string {
  return value?.trim().toLowerCase() ?? "";
}

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
    status: row.status,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
    buyerUserId: row.buyer_user_id ?? undefined,
    paymentId: row.payment_id ?? undefined,
    settlementId: row.settlement_id ?? undefined
  };
}

function mapCompletedSale(row: CompletedSaleRow): CompletedSale {
  return {
    listingId: row.listing_id,
    paymentId: row.payment_id,
    settlementId: row.settlement_id,
    escrowDataHash: row.escrow_data_hash,
    completeSaleRequestId: row.complete_sale_request_id,
    completedAt: toIso(row.completed_at)
  };
}

function mapSettlementLedger(row: SettlementLedgerRow): SettlementLedgerRecord {
  return {
    settlementId: row.settlement_id,
    listingId: row.listing_id,
    paymentId: row.payment_id,
    escrowDataHash: row.escrow_data_hash,
    submitTxHash: row.submit_tx_hash,
    status: row.status,
    submittedAt: toIso(row.submitted_at)
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

async function ensureSchema(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS marketplace_listings (
      id TEXT PRIMARY KEY,
      token_id TEXT NOT NULL,
      event_id TEXT NOT NULL,
      seller_user_id TEXT NOT NULL,
      seller_wallet_address TEXT NOT NULL,
      original_price INTEGER NOT NULL,
      ask_price INTEGER NOT NULL,
      currency TEXT NOT NULL DEFAULT 'VND',
      status TEXT NOT NULL CHECK (status IN ('active', 'cancelled', 'completed')),
      buyer_user_id TEXT,
      payment_id TEXT,
      settlement_id TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_marketplace_active_listing_per_token
    ON marketplace_listings (token_id)
    WHERE status = 'active';
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS marketplace_completed_sales (
      listing_id TEXT PRIMARY KEY REFERENCES marketplace_listings(id) ON DELETE CASCADE,
      payment_id TEXT NOT NULL,
      settlement_id TEXT NOT NULL,
      escrow_data_hash TEXT NOT NULL,
      complete_sale_request_id TEXT NOT NULL,
      completed_at TIMESTAMPTZ NOT NULL
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS marketplace_settlement_ledger (
      settlement_id TEXT PRIMARY KEY,
      listing_id TEXT NOT NULL REFERENCES marketplace_listings(id) ON DELETE CASCADE,
      payment_id TEXT NOT NULL,
      escrow_data_hash TEXT NOT NULL,
      submit_tx_hash TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('submitted')),
      submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS marketplace_idempotency (
      scope TEXT PRIMARY KEY,
      response JSONB NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS marketplace_buy_hashes (
      order_id TEXT PRIMARY KEY,
      listing_id TEXT NOT NULL REFERENCES marketplace_listings(id) ON DELETE CASCADE,
      buyer_user_id TEXT NOT NULL,
      buyer_wallet_address TEXT NOT NULL,
      amount INTEGER NOT NULL,
      nonce TEXT NOT NULL,
      payment_hash TEXT NOT NULL,
      signature TEXT NOT NULL,
      signer_address TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('issued', 'expired')),
      issued_at TIMESTAMPTZ NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      chain_id INTEGER NOT NULL,
      verifying_contract TEXT NOT NULL,
      typed_data JSONB NOT NULL
    );
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_marketplace_buy_hashes_listing_user
    ON marketplace_buy_hashes (listing_id, buyer_user_id, issued_at DESC);
  `);
}

async function cleanupExpiredState(pool: Pool): Promise<void> {
  await pool.query(
    `UPDATE marketplace_buy_hashes SET status = 'expired' WHERE status = 'issued' AND expires_at <= NOW()`
  );
  await pool.query(`DELETE FROM marketplace_idempotency WHERE expires_at <= NOW()`);
}

async function getCachedIdempotency(pool: Pool, scope: string | null): Promise<unknown | null> {
  if (!scope) {
    return null;
  }

  const row = await queryOne<IdempotencyRow>(
    pool,
    `SELECT scope, response, expires_at FROM marketplace_idempotency WHERE scope = $1 AND expires_at > NOW()`,
    [scope]
  );
  return row?.response ?? null;
}

async function setCachedIdempotency(
  pool: Pool,
  scope: string | null,
  response: unknown
): Promise<void> {
  if (!scope) {
    return;
  }

  await pool.query(
    `
      INSERT INTO marketplace_idempotency (scope, response, expires_at)
      VALUES ($1, $2::jsonb, NOW() + INTERVAL '24 hours')
      ON CONFLICT (scope) DO UPDATE SET response = EXCLUDED.response, expires_at = EXCLUDED.expires_at
    `,
    [scope, JSON.stringify(response)]
  );
}

async function loadListing(pool: Pool, listingId: string): Promise<Listing | null> {
  const row = await queryOne<ListingRow>(
    pool,
    `
      SELECT id, token_id, event_id, seller_user_id, seller_wallet_address, original_price, ask_price,
             currency, status, created_at, updated_at, buyer_user_id, payment_id, settlement_id
      FROM marketplace_listings
      WHERE id = $1
    `,
    [listingId]
  );
  return row ? mapListing(row) : null;
}

async function findActiveListingByToken(pool: Pool, tokenId: string): Promise<Listing | null> {
  const row = await queryOne<ListingRow>(
    pool,
    `
      SELECT id, token_id, event_id, seller_user_id, seller_wallet_address, original_price, ask_price,
             currency, status, created_at, updated_at, buyer_user_id, payment_id, settlement_id
      FROM marketplace_listings
      WHERE token_id = $1 AND status = 'active'
    `,
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
    `
      SELECT order_id, listing_id, buyer_user_id, buyer_wallet_address, amount, nonce, payment_hash,
             signature, signer_address, status, issued_at, expires_at, chain_id, verifying_contract,
             typed_data
      FROM marketplace_buy_hashes
      WHERE listing_id = $1 AND buyer_user_id = $2
      ORDER BY issued_at DESC
      LIMIT 1
    `,
    [listingId, buyerUserId]
  );

  if (!row) {
    return null;
  }

  if (row.status === "issued" && new Date(row.expires_at).getTime() <= Date.now()) {
    await pool.query(`UPDATE marketplace_buy_hashes SET status = 'expired' WHERE order_id = $1`, [
      row.order_id
    ]);
    row.status = "expired";
  }

  return mapBuyHash(row);
}

export async function createMarketplaceServer(config: MarketplaceConfig) {
  const pool = createPostgresPool(process.env);
  await ensureSchema(pool);
  await cleanupExpiredState(pool);

  const cleanupTimer = setInterval(() => {
    void cleanupExpiredState(pool).catch((error) => {
      log(config.serviceName, "error", "Failed to cleanup marketplace persistence state", {
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

      if (method === "GET" && url.pathname === "/healthz") {
        const counts = await queryOne<{ active: string; completed: string }>(
          pool,
          `
            SELECT
              COUNT(*) FILTER (WHERE status = 'active')::text AS active,
              COUNT(*) FILTER (WHERE status = 'completed')::text AS completed
            FROM marketplace_listings
          `
        );

        return sendJson(res, 200, {
          success: true,
          data: {
            service: config.serviceName,
            status: "ok",
            storage: "postgres",
            timestamp: new Date().toISOString(),
            activeListings: Number(counts?.active ?? 0),
            completedSales: Number(counts?.completed ?? 0)
          }
        });
      }

      if (method === "GET" && url.pathname === "/marketplace/listings") {
        const statusFilter = url.searchParams.get("status")?.trim().toLowerCase();
        const eventFilter = url.searchParams.get("eventId")?.trim();
        const conditions: string[] = [];
        const values: string[] = [];

        if (statusFilter) {
          values.push(statusFilter);
          conditions.push(`status = $${values.length}`);
        }

        if (eventFilter) {
          values.push(eventFilter);
          conditions.push(`event_id = $${values.length}`);
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
        const rows = await queryMany<ListingRow>(
          pool,
          `
            SELECT id, token_id, event_id, seller_user_id, seller_wallet_address, original_price,
                   ask_price, currency, status, created_at, updated_at, buyer_user_id, payment_id,
                   settlement_id
            FROM marketplace_listings
            ${whereClause}
            ORDER BY created_at DESC
          `,
          values
        );

        return sendJson(res, 200, {
          success: true,
          data: rows.map(mapListing)
        });
      }

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
            error: {
              code: "KYC_REQUIRED",
              message: "KYC approval is required before creating listing"
            }
          });
        }

        const idempotencyScope = createIdempotencyScope(
          method,
          url.pathname,
          extractIdempotencyKey(req)
        );
        const cached = await getCachedIdempotency(pool, idempotencyScope);
        if (cached) {
          return sendJson(res, 200, cached);
        }

        const body = await readJson<CreateListingBody>(req);
        const tokenId = body.tokenId?.trim() ?? "";
        const eventId = body.eventId?.trim() ?? "";
        const sellerWalletAddress = normalizeWalletAddress(body.sellerWalletAddress);
        const originalPrice = body.originalPrice;
        const askPrice = body.askPrice;

        if (!tokenId || !eventId || !sellerWalletAddress || !originalPrice || !askPrice) {
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

        const existingActive = await findActiveListingByToken(pool, tokenId);
        if (existingActive) {
          return sendJson(res, 409, {
            success: false,
            error: { code: "LISTING_ALREADY_ACTIVE", message: "Token already has active listing" }
          });
        }

        const listingId = `lst_${randomUUID().replace(/-/g, "")}`;
        const nowIso = new Date().toISOString();
        await pool.query(
          `
            INSERT INTO marketplace_listings (
              id, token_id, event_id, seller_user_id, seller_wallet_address, original_price,
              ask_price, currency, status, created_at, updated_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, 'VND', 'active', $8::timestamptz, $8::timestamptz)
          `,
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

        const response = {
          success: true,
          data: await loadListing(pool, listingId)
        };
        await setCachedIdempotency(pool, idempotencyScope, response);
        return sendJson(res, 200, response);
      }

      const cancelListingMatch = /^\/marketplace\/listings\/([^/]+)$/.exec(url.pathname);
      if (method === "DELETE" && cancelListingMatch) {
        const userId = extractUserId(req);
        if (!userId) {
          return sendJson(res, 401, {
            success: false,
            error: { code: "UNAUTHORIZED", message: "Missing x-user-id header" }
          });
        }

        const listing = await loadListing(pool, cancelListingMatch[1]);
        if (!listing) {
          return sendJson(res, 404, {
            success: false,
            error: { code: "LISTING_NOT_FOUND", message: "Listing not found" }
          });
        }

        if (listing.status !== "active") {
          return sendJson(res, 400, {
            success: false,
            error: { code: "LISTING_NOT_ACTIVE", message: "Only active listing can be cancelled" }
          });
        }

        if (listing.sellerUserId !== userId) {
          return sendJson(res, 403, {
            success: false,
            error: { code: "FORBIDDEN", message: "Only seller can cancel listing" }
          });
        }

        await pool.query(
          `UPDATE marketplace_listings SET status = 'cancelled', updated_at = NOW() WHERE id = $1`,
          [listing.id]
        );

        return sendJson(res, 200, {
          success: true,
          data: await loadListing(pool, listing.id)
        });
      }

      const purchaseMatch = /^\/marketplace\/listings\/([^/]+)\/purchase$/.exec(url.pathname);
      if (method === "POST" && purchaseMatch) {
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
        if (cached) {
          return sendJson(res, 200, cached);
        }

        const listing = await loadListing(pool, purchaseMatch[1]);
        if (!listing) {
          return sendJson(res, 404, {
            success: false,
            error: { code: "LISTING_NOT_FOUND", message: "Listing not found" }
          });
        }

        if (listing.status !== "active") {
          return sendJson(res, 400, {
            success: false,
            error: { code: "LISTING_NOT_ACTIVE", message: "Listing is no longer active" }
          });
        }

        if (listing.sellerUserId === userId) {
          return sendJson(res, 400, {
            success: false,
            error: {
              code: "SELF_PURCHASE_FORBIDDEN",
              message: "Seller cannot purchase own listing"
            }
          });
        }

        const body = await readJson<PurchaseListingBody>(req);
        const paymentId = body.paymentId?.trim() ?? "";
        const buyerWalletAddress = normalizeWalletAddress(body.buyerWalletAddress);
        const gateway = body.gateway?.trim().toLowerCase() ?? "";
        const gatewayReference = body.gatewayReference?.trim() ?? "";

        if (!paymentId || !buyerWalletAddress || !gateway || !gatewayReference) {
          return sendJson(res, 400, {
            success: false,
            error: {
              code: "INVALID_PURCHASE_PAYLOAD",
              message: "paymentId, buyerWalletAddress, gateway, gatewayReference are required"
            }
          });
        }

        const gatewayCode = toGatewayCode(gateway);
        if (!gatewayCode) {
          return sendJson(res, 400, {
            success: false,
            error: { code: "UNSUPPORTED_GATEWAY", message: "gateway must be momo or vnpay" }
          });
        }

        const grossAmount = listing.askPrice;
        const platformFee = calculateFee(grossAmount, config.platformFeeBps);
        const organizerRoyalty = calculateFee(grossAmount, config.organizerRoyaltyBps);
        const sellerAmount = grossAmount - platformFee - organizerRoyalty;

        if (sellerAmount <= 0) {
          return sendJson(res, 400, {
            success: false,
            error: { code: "INVALID_SPLIT", message: "Invalid settlement split" }
          });
        }

        const settledAt = Math.floor(Date.now() / 1000);
        const settlementId = randomUUID();
        const nonce = randomUUID().replace(/-/g, "");
        const gatewayReferenceHash = sha256Hex(gatewayReference);

        const escrowPayload = {
          version: 1,
          settlementId,
          listingId: listing.id,
          paymentId,
          tokenId: listing.tokenId,
          seller: listing.sellerWalletAddress,
          buyer: buyerWalletAddress,
          grossAmount,
          sellerAmount,
          platformFee,
          organizerRoyalty,
          currency: "VND",
          gateway: gatewayCode,
          gatewayReferenceHash,
          settledAt,
          nonce
        };

        const escrowDataHash = sha256Hex(JSON.stringify(escrowPayload));
        const completeSaleRequestId = `cs_${randomUUID().replace(/-/g, "")}`;
        const completedAt = new Date().toISOString();

        await pool.query(
          `
            UPDATE marketplace_listings
            SET status = 'completed', updated_at = $2::timestamptz, buyer_user_id = $3,
                payment_id = $4, settlement_id = $5
            WHERE id = $1 AND status = 'active'
          `,
          [listing.id, completedAt, userId, paymentId, settlementId]
        );

        await pool.query(
          `
            INSERT INTO marketplace_completed_sales (
              listing_id, payment_id, settlement_id, escrow_data_hash, complete_sale_request_id,
              completed_at
            )
            VALUES ($1, $2, $3, $4, $5, $6::timestamptz)
            ON CONFLICT (listing_id) DO NOTHING
          `,
          [listing.id, paymentId, settlementId, escrowDataHash, completeSaleRequestId, completedAt]
        );

        const response = {
          success: true,
          data: {
            listing: await loadListing(pool, listing.id),
            settlement: {
              escrowPayload,
              escrowDataHash
            },
            completeSaleTrigger: {
              requestId: completeSaleRequestId,
              status: "queued"
            }
          }
        };

        log(config.serviceName, "info", "Listing purchase finalized", {
          listingId: listing.id,
          paymentId,
          settlementId,
          escrowDataHash,
          completeSaleRequestId
        });

        await setCachedIdempotency(pool, idempotencyScope, response);
        return sendJson(res, 200, response);
      }

      if (method === "GET" && url.pathname === "/marketplace/me/sales") {
        const userId = extractUserId(req);
        if (!userId) {
          return sendJson(res, 401, {
            success: false,
            error: { code: "UNAUTHORIZED", message: "Missing x-user-id header" }
          });
        }

        const rows = await queryMany<
          CompletedSaleRow & {
            token_id: string;
            event_id: string;
            buyer_user_id: string | null;
            ask_price: number | string;
            currency: string;
            seller_user_id: string;
          }
        >(
          pool,
          `
            SELECT cs.listing_id, cs.payment_id, cs.settlement_id, cs.escrow_data_hash,
                   cs.complete_sale_request_id, cs.completed_at, l.token_id, l.event_id,
                   l.buyer_user_id, l.ask_price, l.currency, l.seller_user_id
            FROM marketplace_completed_sales cs
            JOIN marketplace_listings l ON l.id = cs.listing_id
            WHERE l.seller_user_id = $1
            ORDER BY cs.completed_at DESC
          `,
          [userId]
        );

        return sendJson(res, 200, {
          success: true,
          data: rows.map((row) => ({
            ...mapCompletedSale(row),
            tokenId: row.token_id,
            eventId: row.event_id,
            buyerUserId: row.buyer_user_id ?? undefined,
            askPrice: Number(row.ask_price),
            currency: row.currency
          }))
        });
      }

      if (method === "POST" && url.pathname === "/internal/marketplace/settlements/finalize") {
        if (!hasInternalAccess(req, config)) {
          return sendJson(res, 401, {
            success: false,
            error: { code: "UNAUTHORIZED_INTERNAL", message: "Invalid internal API key" }
          });
        }

        const body = await readJson<FinalizeSettlementBody>(req);
        const settlementId = body.settlementId?.trim() ?? "";
        const listingId = body.listingId?.trim() ?? "";
        const paymentId = body.paymentId?.trim() ?? "";
        const tokenId = body.tokenId?.trim() ?? "";
        const seller = body.seller?.trim() ?? "";
        const buyer = body.buyer?.trim() ?? "";
        const currency = body.currency?.trim().toUpperCase() ?? "";
        const gatewayReference = body.gatewayReference?.trim() ?? "";

        if (
          body.version !== 1 ||
          !settlementId ||
          !listingId ||
          !paymentId ||
          !tokenId ||
          !seller ||
          !buyer ||
          !currency ||
          !gatewayReference ||
          typeof body.grossAmount !== "number" ||
          typeof body.sellerAmount !== "number" ||
          typeof body.platformFee !== "number" ||
          typeof body.organizerRoyalty !== "number" ||
          typeof body.gateway !== "number" ||
          typeof body.settledAt !== "number" ||
          !body.nonce
        ) {
          return sendJson(res, 400, {
            success: false,
            error: {
              code: "INVALID_SETTLEMENT_PAYLOAD",
              message: "Settlement payload missing required fields"
            }
          });
        }

        if (currency !== "VND") {
          return sendJson(res, 400, {
            success: false,
            error: { code: "INVALID_CURRENCY", message: "Only VND settlement is supported" }
          });
        }

        if (body.grossAmount !== body.sellerAmount + body.platformFee + body.organizerRoyalty) {
          return sendJson(res, 400, {
            success: false,
            error: {
              code: "INVALID_SETTLEMENT_SPLIT",
              message: "grossAmount must equal sellerAmount + platformFee + organizerRoyalty"
            }
          });
        }

        const listing = await loadListing(pool, listingId);
        if (!listing || listing.tokenId !== tokenId) {
          return sendJson(res, 400, {
            success: false,
            error: { code: "LISTING_MISMATCH", message: "Listing and token mismatch" }
          });
        }

        const existing = await queryOne<SettlementLedgerRow>(
          pool,
          `
            SELECT settlement_id, listing_id, payment_id, escrow_data_hash, submit_tx_hash, status, submitted_at
            FROM marketplace_settlement_ledger
            WHERE settlement_id = $1
          `,
          [settlementId]
        );
        if (existing) {
          return sendJson(res, 200, { success: true, data: mapSettlementLedger(existing) });
        }

        const gatewayReferenceHash = sha256Hex(gatewayReference);
        const escrowPayload = {
          version: body.version,
          settlementId,
          listingId,
          paymentId,
          tokenId,
          seller,
          buyer,
          grossAmount: body.grossAmount,
          sellerAmount: body.sellerAmount,
          platformFee: body.platformFee,
          organizerRoyalty: body.organizerRoyalty,
          currency,
          gateway: body.gateway,
          gatewayReferenceHash,
          settledAt: body.settledAt,
          nonce: body.nonce
        };

        const escrowDataHash = sha256Hex(JSON.stringify(escrowPayload));
        const submitTxHash = `0x${sha256Hex(`${escrowDataHash}:${Date.now()}`)}`;

        await pool.query(
          `
            INSERT INTO marketplace_settlement_ledger (
              settlement_id, listing_id, payment_id, escrow_data_hash, submit_tx_hash, status,
              submitted_at
            )
            VALUES ($1, $2, $3, $4, $5, 'submitted', NOW())
          `,
          [settlementId, listingId, paymentId, escrowDataHash, submitTxHash]
        );

        const created = await queryOne<SettlementLedgerRow>(
          pool,
          `
            SELECT settlement_id, listing_id, payment_id, escrow_data_hash, submit_tx_hash, status, submitted_at
            FROM marketplace_settlement_ledger
            WHERE settlement_id = $1
          `,
          [settlementId]
        );

        return sendJson(res, 200, {
          success: true,
          data: mapSettlementLedger(created as SettlementLedgerRow)
        });
      }

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

        if (listing.status !== "active") {
          return sendJson(res, 400, {
            success: false,
            error: { code: "LISTING_NOT_ACTIVE", message: "Listing is no longer active" }
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
            error: {
              code: "SIGNING_UNAVAILABLE",
              message: "Marketplace buy-hash signing is not configured"
            }
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
                "onChainListingId must be a positive integer matching the MarketplaceV2 listingId"
            }
          });
        }

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
          `
            INSERT INTO marketplace_buy_hashes (
              order_id, listing_id, buyer_user_id, buyer_wallet_address, amount, nonce,
              payment_hash, signature, signer_address, status, issued_at, expires_at, chain_id,
              verifying_contract, typed_data
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'issued', $10::timestamptz,
                    $11::timestamptz, $12, $13, $14::jsonb)
          `,
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
          `
            SELECT order_id, listing_id, buyer_user_id, buyer_wallet_address, amount, nonce,
                   payment_hash, signature, signer_address, status, issued_at, expires_at,
                   chain_id, verifying_contract, typed_data
            FROM marketplace_buy_hashes
            WHERE order_id = $1
          `,
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
              message: "No buy hash initiated for this listing. Call initiate-buy first."
            }
          });
        }

        return sendJson(res, 200, { success: true, data: buildBuyHashResponse(record) });
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
