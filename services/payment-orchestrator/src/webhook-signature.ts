import { createHmac, timingSafeEqual } from "node:crypto";

export interface VerificationResult {
  ok: boolean;
  code?: string;
  message?: string;
}

interface VerifyWebhookSignatureInput {
  signature: string | null;
  timestampHeader: string | null;
  nonce: string | null;
  rawBody: string;
  secret: string;
  nonceExpiryByValue: Map<string, number>;
  webhookMaxSkewSec: number;
  webhookNonceTtlSec: number;
  nowMs?: number;
}

function parseTimestampMs(rawTimestamp: string): number | null {
  const parsed = Number(rawTimestamp);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }

  if (parsed > 1_000_000_000_000) {
    return Math.floor(parsed);
  }

  return Math.floor(parsed * 1000);
}

function safeHexEqual(left: string, right: string): boolean {
  try {
    const leftBuffer = Buffer.from(left, "hex");
    const rightBuffer = Buffer.from(right, "hex");

    if (leftBuffer.length === 0 || rightBuffer.length === 0 || leftBuffer.length !== rightBuffer.length) {
      return false;
    }

    return timingSafeEqual(leftBuffer, rightBuffer);
  } catch {
    return false;
  }
}

export function verifyWebhookSignature(input: VerifyWebhookSignatureInput): VerificationResult {
  const {
    signature,
    timestampHeader,
    nonce,
    rawBody,
    secret,
    nonceExpiryByValue,
    webhookMaxSkewSec,
    webhookNonceTtlSec,
    nowMs = Date.now()
  } = input;

  if (!signature || !timestampHeader || !nonce) {
    return {
      ok: false,
      code: "WEBHOOK_SIGNATURE_HEADERS_MISSING",
      message: "x-webhook-signature, x-webhook-timestamp, x-webhook-nonce are required"
    };
  }

  const timestampMs = parseTimestampMs(timestampHeader);
  if (!timestampMs) {
    return {
      ok: false,
      code: "WEBHOOK_INVALID_TIMESTAMP",
      message: "Invalid webhook timestamp"
    };
  }

  const allowedSkewMs = webhookMaxSkewSec * 1000;
  if (Math.abs(nowMs - timestampMs) > allowedSkewMs) {
    return {
      ok: false,
      code: "WEBHOOK_TIMESTAMP_OUT_OF_RANGE",
      message: "Webhook timestamp outside allowed skew"
    };
  }

  const nonceExpiry = nonceExpiryByValue.get(nonce);
  if (nonceExpiry && nonceExpiry > nowMs) {
    return {
      ok: false,
      code: "WEBHOOK_REPLAY_DETECTED",
      message: "Webhook nonce already used"
    };
  }

  const canonicalPayload = `${timestampHeader}.${nonce}.${rawBody}`;
  const expectedSignature = createHmac("sha256", secret).update(canonicalPayload, "utf8").digest("hex");

  if (!safeHexEqual(expectedSignature, signature)) {
    return {
      ok: false,
      code: "WEBHOOK_SIGNATURE_INVALID",
      message: "Webhook signature verification failed"
    };
  }

  nonceExpiryByValue.set(nonce, nowMs + webhookNonceTtlSec * 1000);
  return { ok: true };
}
