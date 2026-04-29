import type { TicketQrData } from "@ticket-platform/sdk-client";

export type TicketQrSource = "backend" | "local";

export interface TicketQrPayload extends TicketQrData {
  source: TicketQrSource;
}

export function serializeTicketQrPayload(payload: TicketQrPayload): string {
  return JSON.stringify({
    type: "entr.ticket.qr.v1",
    tokenId: payload.tokenId,
    eventId: payload.eventId,
    timestamp: payload.timestamp,
    nonce: payload.nonce,
    walletAddress: payload.walletAddress,
    signature: payload.signature,
    source: payload.source
  });
}

export function buildLocalTicketQrPayload(input: {
  tokenId: string;
  eventId: string;
  walletAddress: string;
  nowMs?: number;
}): TicketQrPayload {
  const timestamp = input.nowMs ?? Date.now();
  const nonce = `local:${input.tokenId}:${timestamp}`;
  return {
    tokenId: input.tokenId,
    eventId: input.eventId,
    timestamp,
    nonce,
    walletAddress: input.walletAddress,
    signature: `local:${input.walletAddress}:${nonce}`,
    source: "local"
  };
}

export function getTicketQrAgeMs(
  payload: Pick<TicketQrPayload, "timestamp">,
  nowMs = Date.now()
): number {
  return Math.max(0, nowMs - payload.timestamp);
}

export function getTicketQrRefreshDelayMs(
  payload: Pick<TicketQrPayload, "timestamp">,
  nowMs = Date.now(),
  ttlMs = 30_000
): number {
  const refreshAt = payload.timestamp + ttlMs - 5_000;
  return Math.max(0, refreshAt - nowMs);
}
