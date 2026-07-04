import { recoverTypedDataAddress } from "viem";

export interface CheckInChallengeDomain {
  name: string;
  version: string;
  chainId: number;
  verifyingContract: `0x${string}`;
}

export interface CheckInChallengeMessage {
  tokenId: string;
  eventId: string;
  ownerWallet: `0x${string}`;
  gateScope: string;
  nonce: `0x${string}`;
  issuedAt: number;
  expiresAt: number;
}

export interface SignedCheckInPayload {
  domain: CheckInChallengeDomain;
  types: {
    CheckInChallenge: Array<{ name: string; type: string }>;
  };
  primaryType: "CheckInChallenge";
  message: CheckInChallengeMessage;
  signature: `0x${string}`;
}

export interface VerifyCheckInConfig {
  chainId: number;
  ticketLedgerAddress: `0x${string}`;
  maxClockSkewSec: number;
}

export function buildSignedCheckInPayload(
  payload: Omit<SignedCheckInPayload, "signature">,
  signature: `0x${string}`
): SignedCheckInPayload {
  return { ...payload, signature };
}

export async function verifySignedCheckInPayload(
  config: VerifyCheckInConfig,
  payload: SignedCheckInPayload,
  nowMs = Date.now()
): Promise<
  | { valid: true; message: CheckInChallengeMessage }
  | { valid: false; reason: "QR_EXPIRED" | "SIGNATURE_INVALID" }
> {
  const nowSec = Math.floor(nowMs / 1000);

  if (
    payload.message.expiresAt < nowSec ||
    payload.message.issuedAt > nowSec + config.maxClockSkewSec
  ) {
    return { valid: false, reason: "QR_EXPIRED" };
  }

  try {
    const recovered = await recoverTypedDataAddress({
      domain: {
        name: payload.domain.name,
        version: payload.domain.version,
        chainId: payload.domain.chainId,
        verifyingContract: payload.domain.verifyingContract
      },
      types: payload.types,
      primaryType: payload.primaryType,
      message: payload.message as unknown as Record<string, unknown>,
      signature: payload.signature
    });

    const domainMatches =
      payload.domain.name === "EntrCheckIn" &&
      payload.domain.version === "1" &&
      payload.domain.chainId === config.chainId &&
      payload.domain.verifyingContract.toLowerCase() === config.ticketLedgerAddress.toLowerCase();

    if (!domainMatches || recovered.toLowerCase() !== payload.message.ownerWallet.toLowerCase()) {
      return { valid: false, reason: "SIGNATURE_INVALID" };
    }

    return { valid: true, message: payload.message };
  } catch {
    return { valid: false, reason: "SIGNATURE_INVALID" };
  }
}
