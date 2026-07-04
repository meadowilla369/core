export const CHECKIN_EIP712_DOMAIN_NAME = "EntrCheckIn";
export const CHECKIN_EIP712_DOMAIN_VERSION = "1";

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

export interface CheckInChallengePayload {
  domain: CheckInChallengeDomain;
  types: {
    CheckInChallenge: Array<{ name: string; type: string }>;
  };
  primaryType: "CheckInChallenge";
  message: CheckInChallengeMessage;
}

export interface BuildCheckInTypedDataInput {
  chainId: number;
  verifyingContract: `0x${string}`;
  tokenId: string;
  eventId: string;
  ownerWallet: `0x${string}`;
  gateScope: string;
  nonce: `0x${string}`;
  issuedAt: number;
  expiresAt: number;
}

export function buildCheckInTypedData(input: BuildCheckInTypedDataInput): CheckInChallengePayload {
  return {
    domain: {
      name: CHECKIN_EIP712_DOMAIN_NAME,
      version: CHECKIN_EIP712_DOMAIN_VERSION,
      chainId: input.chainId,
      verifyingContract: input.verifyingContract
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
      tokenId: input.tokenId,
      eventId: input.eventId,
      ownerWallet: input.ownerWallet,
      gateScope: input.gateScope,
      nonce: input.nonce,
      issuedAt: input.issuedAt,
      expiresAt: input.expiresAt
    }
  };
}
