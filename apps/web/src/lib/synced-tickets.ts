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
  source?: "primary-purchase" | "resale-purchase";
  createdAt: string;
}

export interface MergedTicketRecord extends TicketRecord {
  ownerWalletAddress: string | null;
  source: "contract-sync";
  transactionHash?: string;
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
  metadata?: PurchasedTicketMetadata,
  ticketingTicket?: TicketRecord
): MergedTicketRecord | null {
  const eventId = metadata?.eventId ?? ticketingTicket?.eventId ?? token.eventId;
  if (!eventId) {
    return null;
  }

  return {
    tokenId: token.tokenId,
    eventId,
    ticketTypeId: metadata?.ticketTypeId ?? ticketingTicket?.ticketTypeId ?? token.tokenId,
    ownerUserId:
      metadata?.ownerUserId ?? ticketingTicket?.ownerUserId ?? token.ownerUserId ?? fallbackUserId,
    seatInfo:
      ticketingTicket?.seatInfo ??
      (token.sourceListingId != null
        ? `Marketplace resale · ${token.sourceListingId}`
        : "Primary purchase"),
    reservationId: ticketingTicket?.reservationId ?? token.sourceListingId ?? `sync_${token.tokenId}`,
    ownerWalletAddress: normalizeWalletAddress(
      metadata?.ownerWalletAddress ?? token.ownerWalletAddress ?? ""
    ) || null,
    source: "contract-sync",
    transactionHash: metadata?.transactionHash ?? token.lastTransactionHash ?? undefined,
    createdAt: metadata?.createdAt ?? ticketingTicket?.createdAt ?? token.updatedAt
  };
}

export function mergeTicketRecords(input: {
  ticketingTickets: TicketRecord[];
  syncedTokens: ContractSyncedTokenData[];
  cachedTickets: PurchasedTicketMetadata[];
  userId: string;
  walletAddress: string;
}): MergedTicketRecord[] {
  const metadataByTokenId = new Map(input.cachedTickets.map((ticket) => [ticket.tokenId, ticket]));
  const ticketingByTokenId = new Map(input.ticketingTickets.map((ticket) => [ticket.tokenId, ticket]));
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
    const ticketingTicket = ticketingByTokenId.get(token.tokenId);
    const record = toSyncedTicketRecord(token, input.userId, metadata, ticketingTicket);
    if (record) {
      merged.push(record);
      knownTokenIds.add(record.tokenId);
    }
  }

  return merged;
}
