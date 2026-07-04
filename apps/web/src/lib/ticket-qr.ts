import type { CheckInChallengePayload } from "@ticket-platform/sdk-client";

export interface SignedTicketQrPayload extends CheckInChallengePayload {
  signature: `0x${string}`;
}

export function serializeTicketQrPayload(payload: SignedTicketQrPayload): string {
  return JSON.stringify({
    type: "entr.ticket.qr.v1",
    domain: payload.domain,
    types: payload.types,
    primaryType: payload.primaryType,
    message: payload.message,
    signature: payload.signature
  });
}

export function getTicketQrAgeMs(
  payload: Pick<SignedTicketQrPayload, "message">,
  nowMs = Date.now()
): number {
  return Math.max(0, nowMs - payload.message.issuedAt * 1000);
}

export function getTicketQrRefreshDelayMs(
  payload: Pick<SignedTicketQrPayload, "message">,
  nowMs = Date.now()
): number {
  const refreshAtMs = payload.message.expiresAt * 1000 - 5_000;
  return Math.max(0, refreshAtMs - nowMs);
}
