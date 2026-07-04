export interface QrTicketingTicket {
  tokenId: string;
  eventId: string;
  ownerUserId: string;
}

export interface QrSyncedToken {
  tokenId: string;
  eventId?: string | null;
  onchainEventId?: string | null;
  ownerWalletAddress: string | null;
  ownerUserId: string | null;
  isRefunded: boolean;
}

export interface ResolvedQrTicket {
  tokenId: string;
  onchainEventId: string;
  walletAddress: string;
}

function normalizeWalletAddress(value: string): string {
  return value.trim().toLowerCase();
}

export function resolveQrTicket(input: {
  tokenId: string;
  ownerWalletAddress: string | null;
  ticketingTicket: QrTicketingTicket | null;
  syncedToken: QrSyncedToken | null;
}): ResolvedQrTicket | null {
  if (
    !input.ownerWalletAddress ||
    !input.syncedToken ||
    input.syncedToken.tokenId !== input.tokenId ||
    input.syncedToken.isRefunded ||
    !input.syncedToken.eventId ||
    !input.syncedToken.ownerWalletAddress ||
    normalizeWalletAddress(input.syncedToken.ownerWalletAddress) !==
      normalizeWalletAddress(input.ownerWalletAddress)
  ) {
    return null;
  }

  return {
    tokenId: input.syncedToken.tokenId,
    onchainEventId: input.syncedToken.onchainEventId ?? "",
    walletAddress: input.syncedToken.ownerWalletAddress
  };
}
