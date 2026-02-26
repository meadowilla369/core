import { createHmac } from "node:crypto";

export function createWebhookSignature({ timestamp, nonce, rawBody, secret }) {
  const canonical = `${timestamp}.${nonce}.${rawBody}`;
  return createHmac("sha256", secret).update(canonical, "utf8").digest("hex");
}

export function createCheckinSignature({ tokenId, eventId, timestamp, nonce, walletAddress, secret }) {
  const payload = `${tokenId}.${eventId}.${timestamp}.${nonce}.${walletAddress}`;
  return createHmac("sha256", secret).update(payload, "utf8").digest("hex");
}
