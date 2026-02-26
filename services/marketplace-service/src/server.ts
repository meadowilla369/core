import { createHash, randomUUID } from "node:crypto";
import { createServer, IncomingMessage, ServerResponse } from "node:http";

import type { MarketplaceConfig } from "./config.js";
import { log } from "./logger.js";

type ListingStatus = "active" | "cancelled" | "completed";

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

function toIso(ms: number): string {
  return new Date(ms).toISOString();
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

export function createMarketplaceServer(config: MarketplaceConfig) {
  const listingsById = new Map<string, Listing>();
  const listingIdByTokenId = new Map<string, string>();
  const completedSales: CompletedSale[] = [];
  const settlementLedgerById = new Map<string, SettlementLedgerRecord>();
  const idempotencyResponses = new Map<string, unknown>();

  return createServer(async (req, res) => {
    try {
      const method = req.method ?? "GET";
      const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);

      if (method === "GET" && url.pathname === "/healthz") {
        const active = Array.from(listingsById.values()).filter((listing) => listing.status === "active").length;

        return sendJson(res, 200, {
          success: true,
          data: {
            service: config.serviceName,
            status: "ok",
            timestamp: new Date().toISOString(),
            activeListings: active,
            completedSales: completedSales.length
          }
        });
      }

      if (method === "GET" && url.pathname === "/marketplace/listings") {
        const statusFilter = url.searchParams.get("status")?.trim().toLowerCase();
        const eventFilter = url.searchParams.get("eventId")?.trim();

        const listings = Array.from(listingsById.values())
          .filter((listing) => {
            if (statusFilter && listing.status !== statusFilter) {
              return false;
            }

            if (eventFilter && listing.eventId !== eventFilter) {
              return false;
            }

            return true;
          })
          .sort((left, right) => right.createdAt.localeCompare(left.createdAt));

        return sendJson(res, 200, {
          success: true,
          data: listings
        });
      }

      if (method === "POST" && url.pathname === "/marketplace/listings") {
        const userId = extractUserId(req);
        if (!userId) {
          return sendJson(res, 401, {
            success: false,
            error: {
              code: "UNAUTHORIZED",
              message: "Missing x-user-id header"
            }
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

        const idempotencyScope = createIdempotencyScope(method, url.pathname, extractIdempotencyKey(req));
        if (idempotencyScope && idempotencyResponses.has(idempotencyScope)) {
          return sendJson(res, 200, idempotencyResponses.get(idempotencyScope));
        }

        const body = await readJson<CreateListingBody>(req);
        const tokenId = body.tokenId?.trim() ?? "";
        const eventId = body.eventId?.trim() ?? "";
        const sellerWalletAddress = body.sellerWalletAddress?.trim() ?? "";
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
            error: {
              code: "INVALID_PRICE",
              message: "Prices must be positive"
            }
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

        const existingListingId = listingIdByTokenId.get(tokenId);
        if (existingListingId) {
          const existing = listingsById.get(existingListingId);
          if (existing && existing.status === "active") {
            return sendJson(res, 409, {
              success: false,
              error: {
                code: "LISTING_ALREADY_ACTIVE",
                message: "Token already has active listing"
              }
            });
          }
        }

        const nowIso = new Date().toISOString();
        const listing: Listing = {
          id: `lst_${randomUUID().replace(/-/g, "")}`,
          tokenId,
          eventId,
          sellerUserId: userId,
          sellerWalletAddress,
          originalPrice,
          askPrice,
          currency: "VND",
          status: "active",
          createdAt: nowIso,
          updatedAt: nowIso
        };

        listingsById.set(listing.id, listing);
        listingIdByTokenId.set(tokenId, listing.id);

        const response = {
          success: true,
          data: listing
        };

        if (idempotencyScope) {
          idempotencyResponses.set(idempotencyScope, response);
        }

        return sendJson(res, 200, response);
      }

      const cancelListingMatch = /^\/marketplace\/listings\/([^/]+)$/.exec(url.pathname);
      if (method === "DELETE" && cancelListingMatch) {
        const userId = extractUserId(req);
        if (!userId) {
          return sendJson(res, 401, {
            success: false,
            error: {
              code: "UNAUTHORIZED",
              message: "Missing x-user-id header"
            }
          });
        }

        const listing = listingsById.get(cancelListingMatch[1]);
        if (!listing) {
          return sendJson(res, 404, {
            success: false,
            error: {
              code: "LISTING_NOT_FOUND",
              message: "Listing not found"
            }
          });
        }

        if (listing.status !== "active") {
          return sendJson(res, 400, {
            success: false,
            error: {
              code: "LISTING_NOT_ACTIVE",
              message: "Only active listing can be cancelled"
            }
          });
        }

        if (listing.sellerUserId !== userId) {
          return sendJson(res, 403, {
            success: false,
            error: {
              code: "FORBIDDEN",
              message: "Only seller can cancel listing"
            }
          });
        }

        listing.status = "cancelled";
        listing.updatedAt = new Date().toISOString();

        return sendJson(res, 200, {
          success: true,
          data: listing
        });
      }

      const purchaseMatch = /^\/marketplace\/listings\/([^/]+)\/purchase$/.exec(url.pathname);
      if (method === "POST" && purchaseMatch) {
        const userId = extractUserId(req);
        if (!userId) {
          return sendJson(res, 401, {
            success: false,
            error: {
              code: "UNAUTHORIZED",
              message: "Missing x-user-id header"
            }
          });
        }

        const idempotencyScope = createIdempotencyScope(method, url.pathname, extractIdempotencyKey(req));
        if (idempotencyScope && idempotencyResponses.has(idempotencyScope)) {
          return sendJson(res, 200, idempotencyResponses.get(idempotencyScope));
        }

        const listing = listingsById.get(purchaseMatch[1]);
        if (!listing) {
          return sendJson(res, 404, {
            success: false,
            error: {
              code: "LISTING_NOT_FOUND",
              message: "Listing not found"
            }
          });
        }

        if (listing.status !== "active") {
          return sendJson(res, 400, {
            success: false,
            error: {
              code: "LISTING_NOT_ACTIVE",
              message: "Listing is no longer active"
            }
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
        const buyerWalletAddress = body.buyerWalletAddress?.trim() ?? "";
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
            error: {
              code: "UNSUPPORTED_GATEWAY",
              message: "gateway must be momo or vnpay"
            }
          });
        }

        const grossAmount = listing.askPrice;
        const platformFee = calculateFee(grossAmount, config.platformFeeBps);
        const organizerRoyalty = calculateFee(grossAmount, config.organizerRoyaltyBps);
        const sellerAmount = grossAmount - platformFee - organizerRoyalty;

        if (sellerAmount <= 0) {
          return sendJson(res, 400, {
            success: false,
            error: {
              code: "INVALID_SPLIT",
              message: "Invalid settlement split"
            }
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

        listing.status = "completed";
        listing.updatedAt = completedAt;
        listing.buyerUserId = userId;
        listing.paymentId = paymentId;
        listing.settlementId = settlementId;

        completedSales.push({
          listingId: listing.id,
          paymentId,
          settlementId,
          escrowDataHash,
          completeSaleRequestId,
          completedAt
        });

        log(config.serviceName, "info", "Listing purchase finalized", {
          listingId: listing.id,
          paymentId,
          settlementId,
          escrowDataHash,
          completeSaleRequestId
        });

        const response = {
          success: true,
          data: {
            listing,
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

        if (idempotencyScope) {
          idempotencyResponses.set(idempotencyScope, response);
        }

        return sendJson(res, 200, response);
      }

      if (method === "GET" && url.pathname === "/marketplace/me/sales") {
        const userId = extractUserId(req);
        if (!userId) {
          return sendJson(res, 401, {
            success: false,
            error: {
              code: "UNAUTHORIZED",
              message: "Missing x-user-id header"
            }
          });
        }

        const sales = completedSales
          .map((sale) => {
            const listing = listingsById.get(sale.listingId);
            if (!listing) {
              return null;
            }

            if (listing.sellerUserId !== userId) {
              return null;
            }

            return {
              ...sale,
              tokenId: listing.tokenId,
              eventId: listing.eventId,
              buyerUserId: listing.buyerUserId,
              askPrice: listing.askPrice,
              currency: listing.currency
            };
          })
          .filter((item) => item !== null);

        return sendJson(res, 200, {
          success: true,
          data: sales
        });
      }

      if (method === "POST" && url.pathname === "/internal/marketplace/settlements/finalize") {
        if (!hasInternalAccess(req, config)) {
          return sendJson(res, 401, {
            success: false,
            error: {
              code: "UNAUTHORIZED_INTERNAL",
              message: "Invalid internal API key"
            }
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
            error: {
              code: "INVALID_CURRENCY",
              message: "Only VND settlement is supported"
            }
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

        const listing = listingsById.get(listingId);
        if (!listing || listing.tokenId !== tokenId) {
          return sendJson(res, 400, {
            success: false,
            error: {
              code: "LISTING_MISMATCH",
              message: "Listing and token mismatch"
            }
          });
        }

        const existing = settlementLedgerById.get(settlementId);
        if (existing) {
          return sendJson(res, 200, {
            success: true,
            data: existing
          });
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
        const record: SettlementLedgerRecord = {
          settlementId,
          listingId,
          paymentId,
          escrowDataHash,
          submitTxHash,
          status: "submitted",
          submittedAt: new Date().toISOString()
        };

        settlementLedgerById.set(settlementId, record);

        return sendJson(res, 200, {
          success: true,
          data: record
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
