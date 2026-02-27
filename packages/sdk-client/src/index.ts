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
  phoneNumber: string;
}

export interface OtpVerifyInput {
  phoneNumber: string;
  otpCode: string;
  deviceFingerprint?: string;
  deviceName?: string;
}

export interface RefreshInput {
  refreshToken: string;
}

export interface AuthTokenData {
  accessToken: string;
  refreshToken: string;
  userId: string;
  sessionId: string;
  expiresInSec: number;
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
  eventStartAt: string;
  expiresAt: string;
  resaleCount: number;
  createdAt: string;
  updatedAt: string;
  buyerUserId?: string;
  paymentId?: string;
  settlementId?: string;
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

  async requestOtp(input: OtpRequestInput): Promise<ApiSuccessResponse<{ otpSessionId: string; expiresAt: string }>> {
    return this.request("/v1/auth/otp/request", { method: "POST", body: input });
  }

  async verifyOtp(input: OtpVerifyInput): Promise<ApiSuccessResponse<AuthTokenData>> {
    return this.request("/v1/auth/otp/verify", { method: "POST", body: input });
  }

  async refreshToken(input: RefreshInput): Promise<ApiSuccessResponse<AuthTokenData>> {
    return this.request("/v1/auth/refresh", { method: "POST", body: input });
  }

  async listEvents(query: { city?: string; status?: string; organizerId?: string } = {}): Promise<ApiSuccessResponse<EventSummary[]>> {
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

  async listMarketplaceListings(query: { eventId?: string; status?: string } = {}): Promise<ApiSuccessResponse<MarketplaceListing[]>> {
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
      eventStartAt: string;
      expiresAt: string;
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
    input: { paymentId: string; gateway: "momo" | "vnpay"; gatewayReference: string; buyerWalletAddress: string },
    ctx: { userId: string; kycStatus?: string; idempotencyKey?: string }
  ): Promise<ApiSuccessResponse<Record<string, unknown>>> {
    return this.request(`/v1/marketplace/listings/${listingId}/purchase`, {
      method: "POST",
      body: input,
      headers: {
        "x-user-id": ctx.userId,
        ...(ctx.kycStatus ? { "x-kyc-status": ctx.kycStatus } : {}),
        ...(ctx.idempotencyKey ? { "idempotency-key": ctx.idempotencyKey } : {})
      }
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
