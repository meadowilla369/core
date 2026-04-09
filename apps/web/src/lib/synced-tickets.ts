import type { ContractSyncedTokenData, TicketRecord } from "@ticket-platform/sdk-client";

export function toSyncedTicketRecord(
  token: ContractSyncedTokenData,
  fallbackUserId: string
): TicketRecord | null {
  if (!token.eventId) {
    return null;
  }

  return {
    tokenId: token.tokenId,
    eventId: token.eventId,
    ticketTypeId: token.tokenId,
    ownerUserId: token.ownerUserId ?? fallbackUserId,
    seatInfo:
      token.sourceListingId != null
        ? `Marketplace resale · ${token.sourceListingId}`
        : "Marketplace resale",
    reservationId: token.sourceListingId ?? `sync_${token.tokenId}`,
    createdAt: token.updatedAt
  };
}
