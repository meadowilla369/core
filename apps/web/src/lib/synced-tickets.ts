import type { ContractSyncedTokenData, TicketRecord } from "@ticket-platform/sdk-client";

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
  createdAt: string;
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
): TicketRecord | null {
  const eventId = metadata?.eventId ?? token.eventId;
  if (!eventId) {
    return null;
  }

  return {
    tokenId: token.tokenId,
    eventId,
    ticketTypeId: metadata?.ticketTypeId ?? token.tokenId,
    ownerUserId: metadata?.ownerUserId ?? token.ownerUserId ?? fallbackUserId,
    seatInfo:
      token.sourceListingId != null
        ? `Marketplace resale · ${token.sourceListingId}`
        : "Primary purchase",
    reservationId: token.sourceListingId ?? `sync_${token.tokenId}`,
    createdAt: metadata?.createdAt ?? token.updatedAt
  };
}

function toCachedTicketRecord(ticket: PurchasedTicketMetadata): TicketRecord {
  return {
    tokenId: ticket.tokenId,
    eventId: ticket.eventId,
    ticketTypeId: ticket.ticketTypeId,
    ownerUserId: ticket.ownerUserId,
    seatInfo: "Primary purchase",
    reservationId: `sync_${ticket.tokenId}`,
    createdAt: ticket.createdAt
  };
}

export function mergeTicketRecords(input: {
  ticketingTickets: TicketRecord[];
  syncedTokens: ContractSyncedTokenData[];
  cachedTickets: PurchasedTicketMetadata[];
  userId: string;
  walletAddress: string;
}): TicketRecord[] {
  const metadataByTokenId = new Map(input.cachedTickets.map((ticket) => [ticket.tokenId, ticket]));
  const knownTokenIds = new Set(input.ticketingTickets.map((ticket) => ticket.tokenId));
  const normalizedWallet = normalizeWalletAddress(input.walletAddress);
  const merged = [...input.ticketingTickets];

  for (const token of input.syncedTokens) {
    if (token.isRefunded || knownTokenIds.has(token.tokenId)) {
      continue;
    }

    const metadata = metadataByTokenId.get(token.tokenId);
    const record = toSyncedTicketRecord(token, input.userId, metadata);
    if (record) {
      merged.push(record);
      knownTokenIds.add(record.tokenId);
    }
  }

  for (const ticket of input.cachedTickets) {
    if (
      knownTokenIds.has(ticket.tokenId) ||
      ticket.ownerUserId !== input.userId ||
      normalizeWalletAddress(ticket.ownerWalletAddress) !== normalizedWallet
    ) {
      continue;
    }

    merged.push(toCachedTicketRecord(ticket));
    knownTokenIds.add(ticket.tokenId);
  }

  return merged;
}
