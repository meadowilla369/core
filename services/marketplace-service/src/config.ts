export interface MarketplaceConfig {
  serviceName: string;
  host: string;
  port: number;
  maxMarkupBps: number;
  platformFeeBps: number;
  organizerRoyaltyBps: number;
  internalApiKey: string;
}

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
    internalApiKey: process.env.INTERNAL_API_KEY ?? "internal_dev_key"
  };
}
