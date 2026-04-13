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

const TICKET_PURCHASED_TOPIC =
  "0xdb9bb3f84ac1ee7db57c4b8993fdc604c65ef51a09847bf3fe5eae09c7cbd26a";

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
  from: `0x${string}`;
  to: `0x${string}`;
  data: `0x${string}`;
}): Promise<`0x${string}`> {
  return jsonRpcRequest<`0x${string}`>(input.rpcUrl, "eth_sendTransaction", [
    {
      from: input.from,
      to: input.to,
      data: input.data
    }
  ]);
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

export function extractPurchasedTokenId(
  receipt: RpcReceipt,
  ledgerAddress: `0x${string}`
): string | null {
  const normalizedLedger = ledgerAddress.toLowerCase();
  const ticketLog = receipt.logs.find(
    (log) =>
      log.address.toLowerCase() === normalizedLedger &&
      log.topics[0]?.toLowerCase() === TICKET_PURCHASED_TOPIC
  );

  if (!ticketLog?.topics[1]) {
    return null;
  }

  return BigInt(ticketLog.topics[1]).toString();
}
