export interface AuthConfig {
  serviceName: string;
  host: string;
  port: number;
  otpLength: number;
  otpTtlSec: number;
  otpMaxRequestsPerWindow: number;
  otpRateWindowSec: number;
  accessTokenTtlSec: number;
  refreshTokenTtlSec: number;
  exposeOtpInResponse: boolean;
}

function parseNumber(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (!value) {
    return fallback;
  }

  const normalized = value.toLowerCase().trim();
  if (["1", "true", "yes", "y"].includes(normalized)) {
    return true;
  }

  if (["0", "false", "no", "n"].includes(normalized)) {
    return false;
  }

  return fallback;
}

export function loadConfig(): AuthConfig {
  return {
    serviceName: process.env.SERVICE_NAME ?? "auth-service",
    host: process.env.HOST ?? "127.0.0.1",
    port: parseNumber(process.env.PORT, 3001),
    otpLength: parseNumber(process.env.OTP_LENGTH, 6),
    otpTtlSec: parseNumber(process.env.OTP_TTL_SEC, 300),
    otpMaxRequestsPerWindow: parseNumber(process.env.OTP_MAX_REQUESTS_PER_WINDOW, 5),
    otpRateWindowSec: parseNumber(process.env.OTP_RATE_WINDOW_SEC, 900),
    accessTokenTtlSec: parseNumber(process.env.ACCESS_TOKEN_TTL_SEC, 900),
    refreshTokenTtlSec: parseNumber(process.env.REFRESH_TOKEN_TTL_SEC, 2_592_000),
    exposeOtpInResponse: parseBoolean(process.env.AUTH_EXPOSE_OTP_IN_RESPONSE, true)
  };
}
