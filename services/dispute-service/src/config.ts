export interface DisputeConfig {
  serviceName: string;
  host: string;
  port: number;
  slaTier1Hours: number;
  slaTier2Hours: number;
  slaTier3Hours: number;
}

function parseNumber(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function loadConfig(): DisputeConfig {
  return {
    serviceName: process.env.SERVICE_NAME ?? "dispute-service",
    host: process.env.HOST ?? "127.0.0.1",
    port: parseNumber(process.env.PORT, 3012),
    slaTier1Hours: parseNumber(process.env.SLA_TIER1_HOURS, 24),
    slaTier2Hours: parseNumber(process.env.SLA_TIER2_HOURS, 48),
    slaTier3Hours: parseNumber(process.env.SLA_TIER3_HOURS, 72)
  };
}
