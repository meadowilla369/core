export interface Ticket {
  tokenId: string;
  eventId: string;
  reservationId: string;
  seatInfo: string;
}

export interface TicketQrPayload {
  tokenId: string;
  timestamp: number;
  nonce: string;
  signature: string;
}

export function buildRotatingQr(tokenId: string, ownerId: string): TicketQrPayload {
  const timestamp = Date.now();
  const nonce = `${tokenId}-${timestamp}`;

  return {
    tokenId,
    timestamp,
    nonce,
    signature: `sig_${ownerId}_${nonce}`
  };
}
