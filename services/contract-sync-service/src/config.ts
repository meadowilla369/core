export interface ContractSyncConfig {
  serviceName: string;
  host: string;
  port: number;
  internalApiKey: string;
}

function parseNumber(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function loadConfig(): ContractSyncConfig {
  return {
    serviceName: process.env.SERVICE_NAME ?? "contract-sync-service",
    host: process.env.HOST ?? "127.0.0.1",
    port: parseNumber(process.env.PORT, 3014),
    internalApiKey: process.env.INTERNAL_API_KEY ?? "internal-dev-key"
  };
}
