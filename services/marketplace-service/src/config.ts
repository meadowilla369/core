export interface MarketplaceConfig {
  serviceName: string;
  host: string;
  port: number;
  maxMarkupBps: number;
  platformFeeBps: number;
  organizerRoyaltyBps: number;
  internalApiKey: string;
  contractSyncServiceBaseUrl: string;
  /** Private key used to sign EIP-712 BUY_TYPE authorizations for resale purchases. */
  backendSignerPrivateKey?: string;
  /** Chain ID for MarketplaceV2 EIP-712 domain. */
  marketplaceChainId?: number;
  /** Deployed MarketplaceV2 contract address for EIP-712 domain. */
  marketplaceAddress?: string;
  /** TTL in seconds for issued buy-hash records. */
  buyHashTtlSec?: number;
}

export const DEFAULT_MARKETPLACE_CHAIN_ID = 84532;
export const DEFAULT_MARKETPLACE_ADDRESS = "0x2000000000000000000000000000000000000002";
export const DEFAULT_BUY_HASH_TTL_SEC = 24 * 60 * 60;
export const DEFAULT_BACKEND_SIGNER_PRIVATE_KEY =
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";

function parseNumber(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function loadConfig(): MarketplaceConfig {
  return {
    serviceName: process.env.SERVICE_NAME ?? "marketplace-service",
    host: process.env.HOST ?? "127.0.0.1",
    port: parseNumber(process.env.PORT, 3007),
    maxMarkupBps: parseNumber(process.env.MAX_MARKUP_BPS, 12000),
    platformFeeBps: parseNumber(process.env.PLATFORM_FEE_BPS, 500),
    organizerRoyaltyBps: parseNumber(process.env.ORGANIZER_ROYALTY_BPS, 200),
    internalApiKey: process.env.INTERNAL_API_KEY ?? "internal-dev-key",
    contractSyncServiceBaseUrl:
      process.env.CONTRACT_SYNC_SERVICE_BASE_URL ?? "http://127.0.0.1:3014",
    backendSignerPrivateKey:
      process.env.BACKEND_SIGNER_PRIVATE_KEY ?? DEFAULT_BACKEND_SIGNER_PRIVATE_KEY,
    marketplaceChainId: parseNumber(process.env.MARKETPLACE_CHAIN_ID, DEFAULT_MARKETPLACE_CHAIN_ID),
    marketplaceAddress: process.env.MARKETPLACE_ADDRESS ?? DEFAULT_MARKETPLACE_ADDRESS,
    buyHashTtlSec: parseNumber(process.env.BUY_HASH_TTL_SEC, DEFAULT_BUY_HASH_TTL_SEC)
  };
}
