export * from "./tx-builder/index.js";

export interface ApiClientConfig {
  baseUrl: string;
  accessToken?: string;
  defaultHeaders?: Record<string, string>;
}

export interface ApiErrorPayload {
  code: string;
  message: string;
}

export interface ApiErrorResponse {
  success: false;
  error: ApiErrorPayload;
}

export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

export class ApiClientError extends Error {
  readonly statusCode: number;
  readonly payload: unknown;

  constructor(statusCode: number, payload: unknown) {
    super(`API request failed with status ${statusCode}`);
    this.name = "ApiClientError";
    this.statusCode = statusCode;
    this.payload = payload;
  }
}

export interface OtpRequestInput {
  phone: string;
}

export interface OtpVerifyInput {
  phone: string;
  requestId: string;
  otp: string;
  deviceId?: string;
  deviceName?: string;
  platform?: string;
}

export interface RefreshInput {
  refreshToken: string;
}

export interface AuthTokenData {
  accessToken: string;
  refreshToken: string;
  userId: string;
  sessionId: string;
  accessTokenExpiresAt: string;
  refreshTokenExpiresAt: string;
}

export interface WalletPrefundStatusData {
  walletAddress: string;
  funded: boolean;
  txHash: string | null;
  amountWei: string | null;
  fundedAt: string | null;
}

export interface UserProfileData {
  id: string;
  phoneNumber: string;
  fullName: string;
  email?: string;
  emailVerified: boolean;
  isFrozen: boolean;
  freezeReason?: string;
  updatedAt: string;
}

export interface EventSummary {
  id: string;
  organizerId?: string;
  title: string;
  city: string;
  venue: string;
  startAt: string;
  endAt: string;
  status: "active" | "cancelled";
}

export interface TicketType {
  id: string;
  name: string;
  price: number;
  quantity: number;
  soldCount: number;
}

export interface EventDetail extends EventSummary {
  ticketTypes: TicketType[];
}

export interface TicketReservationData {
  reservationId: string;
  eventId: string;
  ticketTypeId: string;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
  status: "pending" | "payment_pending" | "paid" | "expired";
  paymentIntentId?: string;
  paymentMethod?: string;
  gatewayTransactionId?: string;
  expiresAt: string;
  createdAt: string;
  paymentInitiatedAt?: string;
  paidAt?: string;
}

export interface TicketPurchaseData extends TicketReservationData {
  paymentGatewayStatus: "pending" | "confirmed";
  ticketsIssued?: number;
}

export interface WalletRegistrationData {
  walletAddress: string;
  prefunded: boolean;
  prefundTxHash: string;
  amountWei: string;
  fundedAt: string;
}

export interface PaymentIntentData {
  paymentId: string;
  orderId: string;
  reservationId: string;
  userId: string;
  amount: number;
  currency: "VND";
  gateway: "momo" | "vnpay";
  status: "pending" | "confirmed" | "failed" | "cancelled";
  gatewayTransactionId?: string;
  eventId?: number;
  ticketTypeId?: number;
  quantity?: number;
  ticketIds: string[];
  buyerWalletAddress?: string;
  createdAt: string;
  updatedAt: string;
  paymentUrl?: string;
}

export interface PaymentHashData {
  orderId: string;
  paymentId: string;
  paymentStatus: "pending" | "confirmed" | "failed" | "cancelled";
  status: "pending" | "ready" | "expired" | "failed" | "cancelled" | "unavailable";
  paymentHash: `0x${string}` | null;
  signature: `0x${string}` | null;
  nonce: `0x${string}` | null;
  signerAddress: string | null;
  buyer: string | null;
  eventId: number | null;
  ticketTypeId: number | null;
  quantity: number | null;
  amount: number;
  ticketIds: string[];
  issuedAt?: string | null;
  expiresAt?: string | null;
  domain: {
    name: string;
    version: string;
    chainId: number;
    verifyingContract: `0x${string}`;
  } | null;
}

export interface TicketRecord {
  tokenId: string;
  eventId: string;
  ticketTypeId: string;
  ownerUserId: string;
  seatInfo: string;
  reservationId: string;
  createdAt: string;
}

export interface MarketplaceListing {
  id: string;
  tokenId: string;
  eventId: string;
  sellerUserId: string;
  sellerWalletAddress: string;
  originalPrice: number;
  askPrice: number;
  currency: "VND";
  status: "active" | "cancelled" | "completed";
  createdAt: string;
  updatedAt: string;
  buyerUserId?: string;
  paymentId?: string;
  settlementId?: string;
}

export interface MarketplaceBuyHashData {
  orderId: string;
  listingId: string;
  buyerUserId: string;
  buyerWalletAddress: string;
  amount: number;
  nonce: `0x${string}`;
  paymentHash: `0x${string}`;
  signature: `0x${string}`;
  signerAddress: string;
  status: "issued" | "expired";
  issuedAt: string;
  expiresAt: string;
  domain: {
    name: string;
    version: string;
    chainId: number;
    verifyingContract: `0x${string}`;
  };
}

export interface SignedAuthorizationData {
  chainId: number;
  address: `0x${string}`;
  nonce: number;
  yParity?: number;
  v?: bigint;
  r: `0x${string}`;
  s: `0x${string}`;
}

export interface MarketplaceBroadcastTxData {
  hash: `0x${string}`;
  authorizationHash?: `0x${string}` | null;
  signedAuthorization?: SignedAuthorizationData | null;
  request?: {
    to?: `0x${string}`;
    data?: `0x${string}`;
    chainId?: number;
  } | null;
  broadcastAt: string;
  mode: "simulated";
}

export interface ContractSyncedTokenData {
  tokenId: string;
  eventId?: string | null;
  sourceListingId?: string | null;
  ownerWalletAddress: string | null;
  ownerUserId: string | null;
  listingStatus: "none" | "active" | "cancelled" | "completed";
  isUsed: boolean;
  isRefunded: boolean;
  usedAt: string | null;
  refundedAt: string | null;
  lastEventName: string | null;
  lastSalePrice?: number | null;
  lastTransactionHash: string | null;
  lastLogIndex: number | null;
  lastSyncedBlock: number;
  updatedAt: string;
}

export interface ContractSyncServiceStatusData {
  lastProcessedBlock: number;
  totalEventsProcessed: number;
  totalEventsDuplicate: number;
  totalEventsRejected: number;
  trackedTokens: number;
  processedEventCount: number;
  timestamp: string;
}

export interface MarketplaceBroadcastData {
  listing: MarketplaceListing;
  buyHash: MarketplaceBuyHashData;
  tx: MarketplaceBroadcastTxData;
  sync: {
    status: "confirmed" | "degraded";
    error?: string;
    ingestion?: {
      accepted: number;
      duplicates: number;
      rejected: number;
    };
    token?: ContractSyncedTokenData;
    service?: ContractSyncServiceStatusData;
  };
}

interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: unknown;
  headers?: Record<string, string>;
}

export class ApiClient {
  private readonly config: ApiClientConfig;

  constructor(config: ApiClientConfig) {
    this.config = config;
  }

  getBaseUrl(): string {
    return this.config.baseUrl;
  }

  async requestOtp(input: OtpRequestInput): Promise<
    ApiSuccessResponse<{
      requestId: string;
      expiresIn: number;
      retryAfter: number;
      otpCode?: string;
    }>
  > {
    return this.request("/v1/auth/otp/request", { method: "POST", body: input });
  }

  async verifyOtp(input: OtpVerifyInput): Promise<ApiSuccessResponse<AuthTokenData>> {
    return this.request("/v1/auth/otp/verify", { method: "POST", body: input });
  }

  async getWalletPrefundStatus(
    walletAddress: string
  ): Promise<ApiSuccessResponse<WalletPrefundStatusData>> {
    return this.request(`/v1/wallet/prefund/${walletAddress}`, { method: "GET" });
  }

  async refreshToken(input: RefreshInput): Promise<ApiSuccessResponse<AuthTokenData>> {
    return this.request("/v1/auth/refresh", { method: "POST", body: input });
  }

  async getMyProfile(userId: string): Promise<ApiSuccessResponse<UserProfileData>> {
    return this.request("/v1/users/me", {
      method: "GET",
      headers: {
        "x-user-id": userId
      }
    });
  }

  async listEvents(
    query: { city?: string; status?: string; organizerId?: string } = {}
  ): Promise<ApiSuccessResponse<EventSummary[]>> {
    const search = new URLSearchParams();
    if (query.city) {
      search.set("city", query.city);
    }
    if (query.status) {
      search.set("status", query.status);
    }
    if (query.organizerId) {
      search.set("organizerId", query.organizerId);
    }

    const suffix = search.toString();
    return this.request(`/v1/events${suffix ? `?${suffix}` : ""}`, { method: "GET" });
  }

  async getEvent(eventId: string): Promise<ApiSuccessResponse<EventDetail>> {
    return this.request(`/v1/events/${eventId}`, { method: "GET" });
  }

  async registerPaymentWallet(
    input: { walletAddress: string },
    ctx: { userId: string }
  ): Promise<ApiSuccessResponse<WalletRegistrationData>> {
    return this.request("/v1/wallet/register", {
      method: "POST",
      body: input,
      headers: {
        "x-user-id": ctx.userId
      }
    });
  }

  async createPaymentIntent(
    input: {
      orderId?: string;
      reservationId?: string;
      amount: number;
      currency: "VND";
      gateway: "momo" | "vnpay";
      eventId: number;
      ticketTypeId: number;
      quantity: number;
      ticketIds?: string[];
      buyerWalletAddress: string;
    },
    ctx: { userId: string; idempotencyKey?: string }
  ): Promise<ApiSuccessResponse<PaymentIntentData>> {
    return this.request("/v1/payments/intents", {
      method: "POST",
      body: input,
      headers: {
        "x-user-id": ctx.userId,
        ...(ctx.idempotencyKey ? { "idempotency-key": ctx.idempotencyKey } : {})
      }
    });
  }

  async getPaymentHash(orderId: string): Promise<ApiSuccessResponse<PaymentHashData>> {
    return this.request(`/v1/payments/hash/${orderId}`, { method: "GET" });
  }

  async submitPaymentWebhook(
    gateway: "momo" | "vnpay",
    input: Record<string, unknown>,
    headers: {
      signature: string;
      timestamp: string;
      nonce: string;
    }
  ): Promise<ApiSuccessResponse<Record<string, unknown>>> {
    return this.request(`/v1/webhooks/${gateway}`, {
      method: "POST",
      body: input,
      headers: {
        "x-webhook-signature": headers.signature,
        "x-webhook-timestamp": headers.timestamp,
        "x-webhook-nonce": headers.nonce
      }
    });
  }

  async reserveTickets(
    input: { eventId: string; ticketTypeId: string; quantity: number },
    ctx: { userId: string; idempotencyKey?: string }
  ): Promise<ApiSuccessResponse<TicketReservationData>> {
    return this.request("/v1/tickets/reserve", {
      method: "POST",
      body: input,
      headers: {
        "x-user-id": ctx.userId,
        ...(ctx.idempotencyKey ? { "idempotency-key": ctx.idempotencyKey } : {})
      }
    });
  }

  async initiateTicketPurchase(
    input: { reservationId: string; paymentMethod: string },
    ctx: { userId: string; idempotencyKey?: string }
  ): Promise<ApiSuccessResponse<TicketPurchaseData>> {
    return this.request("/v1/tickets/purchase", {
      method: "POST",
      body: input,
      headers: {
        "x-user-id": ctx.userId,
        ...(ctx.idempotencyKey ? { "idempotency-key": ctx.idempotencyKey } : {})
      }
    });
  }

  async confirmTicketPurchase(
    reservationId: string,
    input: { gatewayTransactionId?: string; status?: string } = {},
    ctx: { internalApiKey: string; idempotencyKey?: string }
  ): Promise<ApiSuccessResponse<TicketPurchaseData>> {
    return this.request(`/v1/tickets/purchase/${reservationId}/confirm`, {
      method: "POST",
      body: input,
      headers: {
        "x-internal-api-key": ctx.internalApiKey,
        ...(ctx.idempotencyKey ? { "idempotency-key": ctx.idempotencyKey } : {})
      }
    });
  }

  async getMyTickets(userId: string): Promise<ApiSuccessResponse<TicketRecord[]>> {
    return this.request("/v1/tickets/me", {
      method: "GET",
      headers: {
        "x-user-id": userId
      }
    });
  }

  async listMarketplaceListings(
    query: { eventId?: string; status?: string } = {}
  ): Promise<ApiSuccessResponse<MarketplaceListing[]>> {
    const search = new URLSearchParams();
    if (query.eventId) {
      search.set("eventId", query.eventId);
    }
    if (query.status) {
      search.set("status", query.status);
    }

    const suffix = search.toString();
    return this.request(`/v1/marketplace/listings${suffix ? `?${suffix}` : ""}`, { method: "GET" });
  }

  async createMarketplaceListing(
    input: {
      tokenId: string;
      eventId: string;
      originalPrice: number;
      askPrice: number;
      sellerWalletAddress: string;
    },
    ctx: { userId: string; kycStatus: string; idempotencyKey?: string }
  ): Promise<ApiSuccessResponse<MarketplaceListing>> {
    return this.request("/v1/marketplace/listings", {
      method: "POST",
      body: input,
      headers: {
        "x-user-id": ctx.userId,
        "x-kyc-status": ctx.kycStatus,
        ...(ctx.idempotencyKey ? { "idempotency-key": ctx.idempotencyKey } : {})
      }
    });
  }

  async purchaseMarketplaceListing(
    listingId: string,
    input: { buyerWalletAddress: string },
    ctx: { userId: string; idempotencyKey?: string }
  ): Promise<ApiSuccessResponse<Record<string, unknown>>> {
    return this.request(`/v1/marketplace/listings/${listingId}/purchase`, {
      method: "POST",
      body: input,
      headers: {
        "x-user-id": ctx.userId,
        ...(ctx.idempotencyKey ? { "idempotency-key": ctx.idempotencyKey } : {})
      }
    });
  }

  async initiateMarketplaceBuy(
    listingId: string,
    input: {
      orderId?: string;
      amount: number;
      buyerWalletAddress: string;
      onChainListingId: number;
    },
    ctx: { userId: string }
  ): Promise<ApiSuccessResponse<MarketplaceBuyHashData>> {
    return this.request(`/v1/marketplace/listings/${listingId}/initiate-buy`, {
      method: "POST",
      body: input,
      headers: {
        "x-user-id": ctx.userId
      }
    });
  }

  async getMarketplaceBuyHash(
    listingId: string,
    ctx: { userId: string }
  ): Promise<ApiSuccessResponse<MarketplaceBuyHashData>> {
    return this.request(`/v1/marketplace/listings/${listingId}/buy-hash`, {
      method: "GET",
      headers: {
        "x-user-id": ctx.userId
      }
    });
  }

  async broadcastMarketplaceBuy(
    listingId: string,
    input: {
      authorizationHash: `0x${string}`;
      signedAuthorization: SignedAuthorizationData;
      tx: {
        to: `0x${string}`;
        data: `0x${string}`;
        chainId: number;
      };
      paymentId?: string;
      gateway?: string;
      gatewayReference?: string;
    },
    ctx: { userId: string; idempotencyKey?: string }
  ): Promise<ApiSuccessResponse<MarketplaceBroadcastData>> {
    return this.request(`/v1/marketplace/listings/${listingId}/broadcast-buy`, {
      method: "POST",
      body: input,
      headers: {
        "x-user-id": ctx.userId,
        ...(ctx.idempotencyKey ? { "idempotency-key": ctx.idempotencyKey } : {})
      }
    });
  }

  async listSyncedTokens(
    query: {
      ownerWalletAddress?: string;
      ownerUserId?: string;
      listingStatus?: string;
      eventId?: string;
    } = {}
  ): Promise<ApiSuccessResponse<ContractSyncedTokenData[]>> {
    const search = new URLSearchParams();
    if (query.ownerWalletAddress) {
      search.set("ownerWalletAddress", query.ownerWalletAddress);
    }
    if (query.ownerUserId) {
      search.set("ownerUserId", query.ownerUserId);
    }
    if (query.listingStatus) {
      search.set("listingStatus", query.listingStatus);
    }
    if (query.eventId) {
      search.set("eventId", query.eventId);
    }

    const suffix = search.toString();
    return this.request(`/v1/internal/contracts/tokens${suffix ? `?${suffix}` : ""}`, {
      method: "GET"
    });
  }

  async getSyncedToken(tokenId: string): Promise<ApiSuccessResponse<ContractSyncedTokenData>> {
    return this.request(`/v1/internal/contracts/tokens/${tokenId}`, {
      method: "GET"
    });
  }

  private async request<T>(path: string, options: RequestOptions): Promise<ApiSuccessResponse<T>> {
    const target = new URL(path, this.config.baseUrl).toString();

    const headers: Record<string, string> = {
      accept: "application/json",
      ...this.config.defaultHeaders,
      ...options.headers
    };

    if (this.config.accessToken) {
      headers.authorization = `Bearer ${this.config.accessToken}`;
    }

    const hasBody = options.body !== undefined;
    if (hasBody) {
      headers["content-type"] = "application/json";
    }

    const response = await fetch(target, {
      method: options.method ?? "GET",
      headers,
      body: hasBody ? JSON.stringify(options.body) : undefined
    });

    const text = await response.text();
    const payload = text ? (JSON.parse(text) as ApiResponse<T>) : null;

    if (!response.ok) {
      throw new ApiClientError(response.status, payload);
    }

    if (!payload || payload.success !== true) {
      throw new ApiClientError(response.status, payload);
    }

    return payload;
  }
}
