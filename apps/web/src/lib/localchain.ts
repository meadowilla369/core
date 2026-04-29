import type { Tx4Request } from "@ticket-platform/sdk-client";
import { createPublicClient, createWalletClient, defineChain, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";

interface JsonRpcSuccess<T> {
  jsonrpc: "2.0";
  id: number;
  result: T;
}

interface JsonRpcFailure {
  jsonrpc: "2.0";
  id: number;
  error: {
    code: number;
    message: string;
  };
}

interface RpcLog {
  address: string;
  topics: string[];
}

interface RpcReceipt {
  status?: string;
  transactionHash: `0x${string}`;
  logs: RpcLog[];
}

interface SyncedTokenLike {
  tokenId: string;
}

const TICKET_LEDGER_READ_ABI = [
  {
    type: "function",
    name: "getTicketsByOwner",
    stateMutability: "view",
    inputs: [{ name: "owner", type: "address" }],
    outputs: [{ name: "ticketIds", type: "uint256[]" }]
  },
  {
    type: "function",
    name: "tickets",
    stateMutability: "view",
    inputs: [{ name: "", type: "uint256" }],
    outputs: [
      { name: "ticketId", type: "uint256" },
      { name: "eventId", type: "uint256" },
      { name: "ticketTypeId", type: "uint256" },
      { name: "owner", type: "address" },
      { name: "price", type: "uint256" },
      { name: "used", type: "bool" },
      { name: "purchasedAt", type: "uint256" },
      { name: "usedAt", type: "uint256" }
    ]
  }
] as const;

const TICKET_PURCHASED_TOPIC =
  "0xdb9bb3f84ac1ee7db57c4b8993fdc604c65ef51a09847bf3fe5eae09c7cbd26a";
const DEFAULT_LOCALCHAIN_GAS_LIMIT = 400_000n;

async function jsonRpcRequest<T>(
  rpcUrl: string,
  method: string,
  params: unknown[]
): Promise<T> {
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

  const payload = (await response.json()) as JsonRpcSuccess<T> | JsonRpcFailure;
  if (!response.ok || "error" in payload) {
    const message = "error" in payload ? payload.error.message : `HTTP ${response.status}`;
    throw new Error(`RPC ${method} failed: ${message}`);
  }

  return payload.result;
}

export async function sendLocalchainTransaction(input: {
  rpcUrl: string;
  privateKey: `0x${string}`;
  tx: Tx4Request;
}): Promise<`0x${string}`> {
  const account = privateKeyToAccount(input.privateKey);
  const chain = defineChain({
    id: input.tx.chainId,
    name: `localchain-${input.tx.chainId}`,
    nativeCurrency: {
      name: "Ether",
      symbol: "ETH",
      decimals: 18
    },
    rpcUrls: {
      default: {
        http: [input.rpcUrl]
      }
    }
  });
  const client = createWalletClient({
    account,
    chain,
    transport: http(input.rpcUrl)
  });

  const estimatedGas =
    input.tx.gas === undefined
      ? await estimateLocalchainTransactionGas({ rpcUrl: input.rpcUrl, tx: input.tx, account }).catch(
          () => undefined
        )
      : undefined;

  return client.sendTransaction({
    account,
    authorizationList: input.tx.authorizationList,
    chain,
    data: input.tx.data,
    gas: getLocalchainGasLimit(input.tx, estimatedGas),
    nonce: input.tx.nonce,
    to: input.tx.to,
    type: "eip7702",
    value: input.tx.value
  } as never);
}

async function estimateLocalchainTransactionGas(input: {
  rpcUrl: string;
  tx: Tx4Request;
  account: ReturnType<typeof privateKeyToAccount>;
}): Promise<bigint> {
  const chain = defineChain({
    id: input.tx.chainId,
    name: `localchain-${input.tx.chainId}`,
    nativeCurrency: {
      name: "Ether",
      symbol: "ETH",
      decimals: 18
    },
    rpcUrls: {
      default: {
        http: [input.rpcUrl]
      }
    }
  });
  const client = createPublicClient({
    chain,
    transport: http(input.rpcUrl)
  });

  return client.estimateGas({
    account: input.account,
    authorizationList: input.tx.authorizationList,
    data: input.tx.data,
    nonce: input.tx.nonce,
    to: input.tx.to,
    type: "eip7702",
    value: input.tx.value
  } as never);
}

export function getBufferedGasLimit(estimatedGas: bigint): bigint {
  return (estimatedGas * 120n + 99n) / 100n;
}

export function getLocalchainGasLimit(tx: Tx4Request, estimatedGas?: bigint): bigint {
  return (
    tx.gas ??
    (estimatedGas === undefined ? DEFAULT_LOCALCHAIN_GAS_LIMIT : getBufferedGasLimit(estimatedGas))
  );
}

export async function getLocalchainTransactionCount(input: {
  rpcUrl: string;
  walletAddress: `0x${string}`;
  blockTag?: "latest" | "pending";
}): Promise<bigint> {
  const nonceHex = await jsonRpcRequest<`0x${string}`>(input.rpcUrl, "eth_getTransactionCount", [
    input.walletAddress,
    input.blockTag ?? "latest"
  ]);
  return BigInt(nonceHex);
}

export async function waitForTransactionReceipt(input: {
  rpcUrl: string;
  transactionHash: `0x${string}`;
  timeoutMs?: number;
  pollMs?: number;
}): Promise<RpcReceipt> {
  const timeoutMs = input.timeoutMs ?? 30_000;
  const pollMs = input.pollMs ?? 1_000;
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    const receipt = await jsonRpcRequest<RpcReceipt | null>(input.rpcUrl, "eth_getTransactionReceipt", [
      input.transactionHash
    ]);
    if (receipt) {
      if (receipt.status && receipt.status !== "0x1") {
        throw new Error(`Transaction reverted with status ${receipt.status}`);
      }
      return receipt;
    }

    await new Promise((resolve) => window.setTimeout(resolve, pollMs));
  }

  throw new Error(`Timed out waiting for receipt ${input.transactionHash}`);
}

export function extractPurchasedTokenIds(
  receipt: RpcReceipt,
  ledgerAddress: `0x${string}`
): string[] {
  const normalizedLedger = ledgerAddress.toLowerCase();
  return receipt.logs.flatMap((log) => {
    const isTicketPurchased =
      log.address.toLowerCase() === normalizedLedger &&
      log.topics[0]?.toLowerCase() === TICKET_PURCHASED_TOPIC;

    if (!isTicketPurchased || !log.topics[1]) {
      return [];
    }

    return [BigInt(log.topics[1]).toString()];
  });
}

export function extractPurchasedTokenId(
  receipt: RpcReceipt,
  ledgerAddress: `0x${string}`
): string | null {
  return extractPurchasedTokenIds(receipt, ledgerAddress)[0] ?? null;
}

export function selectNewlySyncedTokens<T extends SyncedTokenLike>(
  previousTokenIds: Set<string>,
  tokens: T[]
): T[] {
  return tokens.filter((token) => !previousTokenIds.has(token.tokenId));
}

export function selectNewlySyncedToken<T extends SyncedTokenLike>(
  previousTokenIds: Set<string>,
  tokens: T[]
): T | null {
  return selectNewlySyncedTokens(previousTokenIds, tokens)[0] ?? null;
}

export async function listOnchainOwnerTicketIds(input: {
  rpcUrl: string;
  chainId: number;
  ledgerAddress: `0x${string}`;
  ownerWalletAddress: `0x${string}`;
}): Promise<string[]> {
  const chain = defineChain({
    id: input.chainId,
    name: `localchain-${input.chainId}`,
    nativeCurrency: {
      name: "Ether",
      symbol: "ETH",
      decimals: 18
    },
    rpcUrls: {
      default: {
        http: [input.rpcUrl]
      }
    }
  });
  const client = createPublicClient({
    chain,
    transport: http(input.rpcUrl)
  });

  const tokenIds = (await client.readContract({
    address: input.ledgerAddress,
    abi: TICKET_LEDGER_READ_ABI,
    functionName: "getTicketsByOwner",
    args: [input.ownerWalletAddress]
  } as never)) as bigint[];

  return tokenIds.map((tokenId) => tokenId.toString());
}

export function selectNewTokenIds(previousTokenIds: Set<string>, tokenIds: string[]): string[] {
  return tokenIds.filter((tokenId) => !previousTokenIds.has(tokenId));
}

export function selectNewTokenId(previousTokenIds: Set<string>, tokenIds: string[]): string | null {
  return selectNewTokenIds(previousTokenIds, tokenIds)[0] ?? null;
}

export async function getOnchainTicketOwner(input: {
  rpcUrl: string;
  chainId: number;
  ledgerAddress: `0x${string}`;
  tokenId: string;
}): Promise<`0x${string}`> {
  const chain = defineChain({
    id: input.chainId,
    name: `localchain-${input.chainId}`,
    nativeCurrency: {
      name: "Ether",
      symbol: "ETH",
      decimals: 18
    },
    rpcUrls: {
      default: {
        http: [input.rpcUrl]
      }
    }
  });
  const client = createPublicClient({
    chain,
    transport: http(input.rpcUrl)
  });

  const ticket = (await client.readContract({
    address: input.ledgerAddress,
    abi: TICKET_LEDGER_READ_ABI,
    functionName: "tickets",
    args: [BigInt(input.tokenId)]
  } as never)) as readonly [bigint, bigint, bigint, `0x${string}`, bigint, boolean, bigint, bigint];

  return ticket[3];
}
