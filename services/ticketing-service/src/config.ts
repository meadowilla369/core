export interface TicketingConfig {
  serviceName: string;
  host: string;
  port: number;
  reservationTtlSec: number;
  qrSignatureSecret: string;
  internalApiKey: string;
}

function parseNumber(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function loadConfig(): TicketingConfig {
  return {
    serviceName: process.env.SERVICE_NAME ?? "ticketing-service",
    host: process.env.HOST ?? "127.0.0.1",
    port: parseNumber(process.env.PORT, 3005),
    reservationTtlSec: parseNumber(process.env.RESERVATION_TTL_SEC, 900),
    qrSignatureSecret: process.env.QR_SIGNATURE_SECRET ?? "checkin_dev_secret",
    internalApiKey: process.env.INTERNAL_API_KEY ?? "internal-dev-key"
  };
}
