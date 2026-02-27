export interface WorkerMintConfig {
  serviceName: string;
  host: string;
  port: number;
  chainId: number;
  baseRpcUrl: string;
  ticketNftAddress: string;
  maxAttempts: number;
  maxBatchSize: number;
  retryBaseDelaySec: number;
  tokenIdSeed: number;
}

function parseNumber(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function loadConfig(): WorkerMintConfig {
  return {
    serviceName: process.env.SERVICE_NAME ?? "worker-mint",
    host: process.env.HOST ?? "127.0.0.1",
    port: parseNumber(process.env.PORT, 3010),
    chainId: parseNumber(process.env.BASE_CHAIN_ID, 31337),
    baseRpcUrl: process.env.BASE_RPC_URL ?? "http://127.0.0.1:8545",
    ticketNftAddress: process.env.TICKET_NFT_ADDRESS ?? "0x5fbdb2315678afecb367f032d93f642f64180aa3",
    maxAttempts: parseNumber(process.env.MAX_MINT_ATTEMPTS, 5),
    maxBatchSize: parseNumber(process.env.MAX_MINT_BATCH_SIZE, 10),
    retryBaseDelaySec: parseNumber(process.env.RETRY_BASE_DELAY_SEC, 20),
    tokenIdSeed: parseNumber(process.env.TOKEN_ID_SEED, 100000)
  };
}
