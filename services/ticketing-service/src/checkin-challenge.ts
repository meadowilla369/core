import { randomBytes } from "node:crypto";

export const CHECKIN_EIP712_DOMAIN_NAME = "EntrCheckIn";
export const CHECKIN_EIP712_DOMAIN_VERSION = "1";

export interface CheckInChallengeConfig {
  checkinChainId: number;
  ticketLedgerAddress: `0x${string}`;
}

export interface ResolvedQrTicket {
  tokenId: string;
  onchainEventId: string;
  walletAddress: `0x${string}`;
}

export interface CheckInChallengeTiming {
  nonce?: `0x${string}`;
  issuedAt?: number;
  expiresAt?: number;
}

export interface CheckInChallengePayload {
  domain: {
    name: string;
    version: string;
    chainId: number;
    verifyingContract: `0x${string}`;
  };
  types: {
    CheckInChallenge: Array<{ name: string; type: string }>;
  };
  primaryType: "CheckInChallenge";
  message: {
    tokenId: string;
    eventId: string;
    ownerWallet: `0x${string}`;
    gateScope: "event";
    nonce: `0x${string}`;
    issuedAt: number;
    expiresAt: number;
  };
}

export function createCheckInChallenge(
  config: CheckInChallengeConfig,
  ticket: ResolvedQrTicket,
  timing: CheckInChallengeTiming = {}
): CheckInChallengePayload {
  if (!/^\d+$/.test(ticket.onchainEventId)) {
    throw new Error("Resolved QR ticket must include a numeric onchain event id");
  }

  const issuedAt = timing.issuedAt ?? Math.floor(Date.now() / 1000);
  const expiresAt = timing.expiresAt ?? issuedAt + 30;
  const nonce = timing.nonce ?? (`0x${randomBytes(32).toString("hex")}` as `0x${string}`);

  return {
    domain: {
      name: CHECKIN_EIP712_DOMAIN_NAME,
      version: CHECKIN_EIP712_DOMAIN_VERSION,
      chainId: config.checkinChainId,
      verifyingContract: config.ticketLedgerAddress
    },
    types: {
      CheckInChallenge: [
        { name: "tokenId", type: "uint256" },
        { name: "eventId", type: "uint256" },
        { name: "ownerWallet", type: "address" },
        { name: "gateScope", type: "string" },
        { name: "nonce", type: "bytes32" },
        { name: "issuedAt", type: "uint256" },
        { name: "expiresAt", type: "uint256" }
      ]
    },
    primaryType: "CheckInChallenge",
    message: {
      tokenId: ticket.tokenId,
      eventId: ticket.onchainEventId,
      ownerWallet: ticket.walletAddress,
      gateScope: "event",
      nonce,
      issuedAt,
      expiresAt
    }
  };
}
