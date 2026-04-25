import { spawnSync } from "node:child_process";

export interface PurchaseTypedData {
  types: {
    EIP712Domain: Array<{ name: string; type: string }>;
    Purchase: Array<{ name: string; type: string }>;
  };
  primaryType: "Purchase";
  domain: {
    name: "TicketLedger";
    version: "1";
    chainId: number;
    verifyingContract: string;
  };
  message: {
    eventId: number;
    ticketTypeId: number;
    quantity: number;
    paymentHash: string;
    buyer: string;
  };
}

interface RunCastInput {
  castBinaryPath?: string;
  args: string[];
  action: string;
}

type CastRunner = (input: RunCastInput) => string;

interface ComputePaymentHashInput {
  castBinaryPath?: string;
  orderId: string;
  userId: string;
  ticketIds: string[];
  amount: bigint;
  nonce: string;
}

interface SignTypedDataInput {
  castBinaryPath?: string;
  privateKey: string;
  typedData: PurchaseTypedData;
}

interface NativeBalanceInput {
  rpcUrl: string;
  walletAddress: string;
}

interface SendNativePrefundInput {
  rpcUrl: string;
  privateKey: string;
  walletAddress: string;
  amountWei: string;
  castBinaryPath?: string;
}

const DEFAULT_CAST_BINARY = "cast";

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
  const result = spawnSync(input.castBinaryPath ?? DEFAULT_CAST_BINARY, input.args, {
    encoding: "utf8"
  });

  if (result.status !== 0) {
    const details = [result.stdout, result.stderr]
      .filter((value) => typeof value === "string" && value.trim().length > 0)
      .join("\n")
      .trim();

    throw new Error(`${input.action} failed${details ? `: ${details}` : ""}`);
  }

  return result.stdout.trim();
}

async function jsonRpcRequest<T>(rpcUrl: string, method: string, params: unknown[]): Promise<T> {
  const response = await fetch(rpcUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method,
      params
    })
  });

  const payload = (await response.json()) as { result?: T; error?: { message?: string } };
  if (!response.ok || payload.error) {
    throw new Error(payload.error?.message ?? `RPC ${method} failed with HTTP ${response.status}`);
  }

  return payload.result as T;
}

export function buildPurchaseTypedData(input: {
  chainId: number;
  verifyingContract: string;
  eventId: number;
  ticketTypeId: number;
  quantity: number;
  paymentHash: string;
  buyer: string;
}): PurchaseTypedData {
  return {
    types: {
      EIP712Domain: [
        { name: "name", type: "string" },
        { name: "version", type: "string" },
        { name: "chainId", type: "uint256" },
        { name: "verifyingContract", type: "address" }
      ],
      Purchase: [
        { name: "eventId", type: "uint256" },
        { name: "ticketTypeId", type: "uint256" },
        { name: "quantity", type: "uint256" },
        { name: "paymentHash", type: "bytes32" },
        { name: "buyer", type: "address" }
      ]
    },
    primaryType: "Purchase",
    domain: {
      name: "TicketLedger",
      version: "1",
      chainId: input.chainId,
      verifyingContract: normalizeAddress(input.verifyingContract)
    },
    message: {
      eventId: input.eventId,
      ticketTypeId: input.ticketTypeId,
      quantity: input.quantity,
      paymentHash: normalizeBytes32(input.paymentHash),
      buyer: normalizeAddress(input.buyer)
    }
  };
}

export function computePaymentHash(input: ComputePaymentHashInput): string {
  const encoded = runCast({
    castBinaryPath: input.castBinaryPath,
    action: "ABI encoding payment hash payload",
    args: [
      "abi-encode",
      "f(string,string,string[],uint256,bytes32)",
      input.orderId,
      input.userId,
      JSON.stringify(input.ticketIds),
      input.amount.toString(),
      normalizeBytes32(input.nonce)
    ]
  });

  return runCast({
    castBinaryPath: input.castBinaryPath,
    action: "Computing payment hash",
    args: ["keccak", encoded]
  }).toLowerCase();
}

export function signPurchaseTypedData(input: SignTypedDataInput): string {
  return runCast({
    castBinaryPath: input.castBinaryPath,
    action: "Signing EIP-712 purchase payload",
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

export function computePrefundShortfall(
  minimumBalanceWei: string,
  currentBalanceWei: bigint
): bigint {
  const minimumBalance = BigInt(minimumBalanceWei);
  if (currentBalanceWei >= minimumBalance) {
    return 0n;
  }

  return minimumBalance - currentBalanceWei;
}

export function extractTransactionHash(output: string): string {
  const match = output.match(/0x[a-fA-F0-9]{64}/);
  if (!match) {
    throw new Error(`Could not parse transaction hash from cast output: ${output}`);
  }

  return match[0].toLowerCase();
}

export async function getNativeBalanceWei(input: NativeBalanceInput): Promise<bigint> {
  const balanceHex = await jsonRpcRequest<string>(input.rpcUrl, "eth_getBalance", [
    normalizeAddress(input.walletAddress),
    "latest"
  ]);

  return BigInt(balanceHex);
}

export function sendNativePrefund(
  input: SendNativePrefundInput,
  runner: CastRunner = runCast
): string {
  const output = runner({
    castBinaryPath: input.castBinaryPath,
    action: "Sending wallet prefund transaction",
    args: [
      "send",
      "--async",
      "--rpc-url",
      input.rpcUrl,
      "--private-key",
      normalizePrivateKey(input.privateKey),
      "--value",
      input.amountWei,
      normalizeAddress(input.walletAddress)
    ]
  });

  return extractTransactionHash(output);
}
