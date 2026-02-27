export interface ContractSyncConfig {
  serviceName: string;
  host: string;
  port: number;
  chainId: number;
  trackedContractAddresses: Set<string>;
  internalApiKey: string;
}

function parseNumber(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseAddresses(rawValue: string | undefined, fallback: string[]): Set<string> {
  const raw = rawValue?.trim();
  const addresses = (raw ? raw.split(",") : fallback)
    .map((item) => item.trim().toLowerCase())
    .filter((item) => item.length > 0);
  return new Set(addresses);
}

export function loadConfig(): ContractSyncConfig {
  return {
    serviceName: process.env.SERVICE_NAME ?? "contract-sync-service",
    host: process.env.HOST ?? "127.0.0.1",
    port: parseNumber(process.env.PORT, 3014),
    chainId: parseNumber(process.env.BASE_CHAIN_ID, 31337),
    trackedContractAddresses: parseAddresses(process.env.TRACKED_CONTRACT_ADDRESSES, [
      "0x5fbdb2315678afecb367f032d93f642f64180aa3",
      "0xe7f1725e7734ce288f8367e1bb143e90bb3f0512",
      "0x9fe46736679d2d9a65f0992f2272de9f3c7fa6e0",
      "0xcf7ed3acca5a467e9e704c703e8d87f634fb0fc9"
    ]),
    internalApiKey: process.env.INTERNAL_API_KEY ?? "internal-dev-key"
  };
}
