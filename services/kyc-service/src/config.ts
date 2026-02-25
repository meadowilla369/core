export interface KycServiceConfig {
  serviceName: string;
  host: string;
  port: number;
  provider: string;
  minLivenessScore: number;
  minFaceMatchScore: number;
}

function parseNumber(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function loadConfig(): KycServiceConfig {
  return {
    serviceName: process.env.SERVICE_NAME ?? "kyc-service",
    host: process.env.HOST ?? "127.0.0.1",
    port: parseNumber(process.env.PORT, 3003),
    provider: process.env.KYC_PROVIDER ?? "fpt",
    minLivenessScore: parseNumber(process.env.KYC_MIN_LIVENESS_SCORE, 0.8),
    minFaceMatchScore: parseNumber(process.env.KYC_MIN_FACE_MATCH_SCORE, 0.7)
  };
}
