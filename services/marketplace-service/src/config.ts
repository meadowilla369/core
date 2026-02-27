export interface MarketplaceConfig {
  serviceName: string;
  host: string;
  port: number;
  chainId: number;
  marketplaceContractAddress: string;
  ticketNftAddress: string;
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
    chainId: parseNumber(process.env.BASE_CHAIN_ID, 31337),
    marketplaceContractAddress:
      process.env.MARKETPLACE_CONTRACT_ADDRESS ?? "0xe7f1725e7734ce288f8367e1bb143e90bb3f0512",
    ticketNftAddress: process.env.TICKET_NFT_ADDRESS ?? "0x5fbdb2315678afecb367f032d93f642f64180aa3",
    maxMarkupBps: parseNumber(process.env.MAX_MARKUP_BPS, 12000),
    platformFeeBps: parseNumber(process.env.PLATFORM_FEE_BPS, 500),
    organizerRoyaltyBps: parseNumber(process.env.ORGANIZER_ROYALTY_BPS, 200),
    internalApiKey: process.env.INTERNAL_API_KEY ?? "internal_dev_key"
  };
}
