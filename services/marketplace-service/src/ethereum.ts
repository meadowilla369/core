import { spawnSync } from "node:child_process";

export interface BuyTypedData {
  types: {
    EIP712Domain: Array<{ name: string; type: string }>;
    Buy: Array<{ name: string; type: string }>;
  };
  primaryType: "Buy";
  domain: {
    name: "MarketplaceV2";
    version: "1";
    chainId: number;
    verifyingContract: string;
  };
  message: {
    listingId: number;
    paymentHash: string;
    buyer: string;
  };
}

interface RunCastInput {
  castBinaryPath?: string;
  args: string[];
  action: string;
}

const DEFAULT_CAST = "cast";

function normalizeHex(value: string): string {
  const trimmed = value.trim();
  return trimmed.startsWith("0x") ? trimmed : `0x${trimmed}`;
}

function normalizePrivateKey(privateKey: string): string {
  const normalized = normalizeHex(privateKey);
  if (!/^0x[0-9a-fA-F]{64}$/.test(normalized)) {
    throw new Error("Invalid backend signer private key");
  }
  return normalized;
}

function normalizeBytes32(value: string): string {
  const normalized = normalizeHex(value);
  if (!/^0x[0-9a-fA-F]{64}$/.test(normalized)) {
    throw new Error("Invalid bytes32 value");
  }
  return normalized.toLowerCase();
}

function normalizeAddress(address: string): string {
  const normalized = normalizeHex(address);
  if (!/^0x[0-9a-fA-F]{40}$/.test(normalized)) {
    throw new Error(`Invalid address: ${address}`);
  }
  return normalized.toLowerCase();
}

function runCast(input: RunCastInput): string {
  const result = spawnSync(input.castBinaryPath ?? DEFAULT_CAST, input.args, { encoding: "utf8" });
  if (result.status !== 0) {
    const details = [result.stdout, result.stderr]
      .filter((v) => typeof v === "string" && v.trim().length > 0)
      .join("\n")
      .trim();
    throw new Error(`${input.action} failed${details ? `: ${details}` : ""}`);
  }
  return result.stdout.trim();
}

export function buildBuyTypedData(input: {
  chainId: number;
  verifyingContract: string;
  listingId: number;
  paymentHash: string;
  buyer: string;
}): BuyTypedData {
  return {
    types: {
      EIP712Domain: [
        { name: "name", type: "string" },
        { name: "version", type: "string" },
        { name: "chainId", type: "uint256" },
        { name: "verifyingContract", type: "address" }
      ],
      Buy: [
        { name: "listingId", type: "uint256" },
        { name: "paymentHash", type: "bytes32" },
        { name: "buyer", type: "address" }
      ]
    },
    primaryType: "Buy",
    domain: {
      name: "MarketplaceV2",
      version: "1",
      chainId: input.chainId,
      verifyingContract: normalizeAddress(input.verifyingContract)
    },
    message: {
      listingId: input.listingId,
      paymentHash: normalizeBytes32(input.paymentHash),
      buyer: normalizeAddress(input.buyer)
    }
  };
}

export function computeBuyPaymentHash(input: {
  castBinaryPath?: string;
  orderId: string;
  userId: string;
  listingId: number;
  amount: bigint;
  nonce: string;
}): string {
  const encoded = runCast({
    castBinaryPath: input.castBinaryPath,
    action: "ABI encoding buy payment hash payload",
    args: [
      "abi-encode",
      "f(string,string,uint256,uint256,bytes32)",
      input.orderId,
      input.userId,
      String(input.listingId),
      input.amount.toString(),
      normalizeBytes32(input.nonce)
    ]
  });

  return runCast({
    castBinaryPath: input.castBinaryPath,
    action: "Computing buy payment hash",
    args: ["keccak", encoded]
  }).toLowerCase();
}

export function signBuyTypedData(input: {
  castBinaryPath?: string;
  privateKey: string;
  typedData: BuyTypedData;
}): string {
  return runCast({
    castBinaryPath: input.castBinaryPath,
    action: "Signing EIP-712 buy payload",
    args: [
      "wallet",
      "sign",
      "--data",
      "--private-key",
      normalizePrivateKey(input.privateKey),
      JSON.stringify(input.typedData)
    ]
  }).toLowerCase();
}

export function deriveAddressFromPrivateKey(privateKey: string, castBinaryPath?: string): string {
  return runCast({
    castBinaryPath,
    action: "Deriving backend signer address",
    args: ["wallet", "address", "--private-key", normalizePrivateKey(privateKey)]
  }).toLowerCase();
}
