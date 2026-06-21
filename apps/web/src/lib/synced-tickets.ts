import type { ContractSyncedTokenData } from "@ticket-platform/sdk-client";

const PURCHASED_TICKET_METADATA_KEY = "entr:purchased-ticket-metadata:v1";

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface PurchasedTicketMetadata {
  tokenId: string;
  eventId: string;
  ticketTypeId: string;
  ownerUserId: string;
  ownerWalletAddress: string;
  transactionHash?: string;
  source?: "primary-purchase" | "resale-purchase";
  createdAt: string;
}

export interface MergedTicketRecord {
  tokenId: string;
  eventId: string;
  ticketTypeId: string;
  ownerUserId: string;
  seatInfo: string;
  reservationId: string;
  createdAt: string;
  ownerWalletAddress: string | null;
  source: "contract-sync";
  transactionHash?: string;
  listingStatus: "none" | "active" | "cancelled" | "completed";
  isUsed: boolean;
  originalPrice?: number;
}

function getBrowserStorage(): StorageLike | null {
  if (typeof window === "undefined") {
    return null;
  }
  return window.localStorage;
}

function normalizeWalletAddress(value: string): string {
  return value.trim().toLowerCase();
}

function isPurchasedTicketMetadata(value: unknown): value is PurchasedTicketMetadata {
  const candidate = value as Partial<PurchasedTicketMetadata>;
  return (
    typeof candidate?.tokenId === "string" &&
    typeof candidate.eventId === "string" &&
    typeof candidate.ticketTypeId === "string" &&
    typeof candidate.ownerUserId === "string" &&
    typeof candidate.ownerWalletAddress === "string" &&
    typeof candidate.createdAt === "string"
  );
}

export function loadPurchasedTicketMetadata(
  storage: StorageLike | null = getBrowserStorage()
): PurchasedTicketMetadata[] {
  if (!storage) {
    return [];
  }

  const raw = storage.getItem(PURCHASED_TICKET_METADATA_KEY);
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      storage.removeItem(PURCHASED_TICKET_METADATA_KEY);
      return [];
    }

    return parsed.filter(isPurchasedTicketMetadata).map((item) => ({
      ...item,
      ownerWalletAddress: normalizeWalletAddress(item.ownerWalletAddress)
    }));
  } catch {
    storage.removeItem(PURCHASED_TICKET_METADATA_KEY);
    return [];
  }
}

export function clearPurchasedTicketMetadata(
  storage: StorageLike | null = getBrowserStorage()
): void {
  storage?.removeItem(PURCHASED_TICKET_METADATA_KEY);
}

export function savePurchasedTicketMetadata(
  ticket: PurchasedTicketMetadata,
  storage: StorageLike | null = getBrowserStorage()
): void {
  if (!storage) {
    return;
  }

  const normalized = {
    ...ticket,
    ownerWalletAddress: normalizeWalletAddress(ticket.ownerWalletAddress)
  };
  const existing = loadPurchasedTicketMetadata(storage).filter(
    (item) => item.tokenId !== normalized.tokenId
  );
  storage.setItem(PURCHASED_TICKET_METADATA_KEY, JSON.stringify([normalized, ...existing]));
}

export function toSyncedTicketRecord(
  token: ContractSyncedTokenData,
  fallbackUserId: string,
  metadata?: PurchasedTicketMetadata
): MergedTicketRecord | null {
  // Prefer contract-sync data (source of truth); fall back to cached metadata
  // only when contract-sync doesn't know the value (e.g. before event/ticketType is resolved).
  const eventId = token.eventId ?? metadata?.eventId;
  if (!eventId) {
    return null;
  }

  return {
    tokenId: token.tokenId,
    eventId,
    ticketTypeId: token.ticketTypeId ?? metadata?.ticketTypeId ?? token.tokenId,
    ownerUserId: token.ownerUserId ?? metadata?.ownerUserId ?? fallbackUserId,
    seatInfo:
      token.sourceListingId != null
        ? `Marketplace resale · ${token.sourceListingId}`
        : "Primary purchase",
    reservationId: token.sourceListingId ?? `sync_${token.tokenId}`,
    ownerWalletAddress: normalizeWalletAddress(
      token.ownerWalletAddress ?? metadata?.ownerWalletAddress ?? ""
    ) || null,
    source: "contract-sync",
    transactionHash: token.lastTransactionHash ?? metadata?.transactionHash ?? undefined,
    createdAt: token.updatedAt ?? metadata?.createdAt,
    listingStatus: token.listingStatus ?? "none",
    isUsed: token.isUsed ?? false,
    originalPrice: token.lastSalePrice ?? undefined
  };
}

export function mergeTicketRecords(input: {
  syncedTokens: ContractSyncedTokenData[];
  cachedTickets: PurchasedTicketMetadata[];
  userId: string;
  walletAddress: string;
}): MergedTicketRecord[] {
  const metadataByTokenId = new Map(input.cachedTickets.map((ticket) => [ticket.tokenId, ticket]));
  const knownTokenIds = new Set<string>();
  const normalizedWallet = normalizeWalletAddress(input.walletAddress);
  const merged: MergedTicketRecord[] = [];

  for (const token of input.syncedTokens) {
    if (
      token.isRefunded ||
      knownTokenIds.has(token.tokenId) ||
      normalizeWalletAddress(token.ownerWalletAddress ?? "") !== normalizedWallet
    ) {
      continue;
    }

    const metadata = metadataByTokenId.get(token.tokenId);
    const record = toSyncedTicketRecord(token, input.userId, metadata);
    if (record) {
      merged.push(record);
      knownTokenIds.add(record.tokenId);
    }
  }

  return merged;
}
