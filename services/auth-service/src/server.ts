import { randomBytes, randomUUID } from "node:crypto";
import { createServer, IncomingMessage, ServerResponse } from "node:http";

import type { AuthConfig } from "./config.js";
import { log } from "./logger.js";

interface OtpRecord {
  phone: string;
  requestId: string;
  code: string;
  expiresAtMs: number;
}

interface RefreshRecord {
  userId: string;
  phone: string;
  sessionId: string;
  expiresAtMs: number;
}

interface RequestOtpBody {
  phone?: string;
}

interface VerifyOtpBody {
  phone?: string;
  requestId?: string;
  otp?: string;
  deviceId?: string;
  deviceName?: string;
  platform?: string;
}

interface RefreshBody {
  refreshToken?: string;
}

interface SessionRecord {
  id: string;
  userId: string;
  phone: string;
  deviceId: string;
  deviceName: string;
  platform: string;
  createdAt: string;
  lastActiveAt: string;
  currentRefreshToken: string;
  revokedAt?: string;
}

const PHONE_REGEX = /^\+?[1-9]\d{7,14}$/;

function sendJson(res: ServerResponse, statusCode: number, payload: unknown): void {
  res.statusCode = statusCode;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}

async function readJson<T>(req: IncomingMessage): Promise<T> {
  const chunks: Buffer[] = [];

  for await (const chunk of req) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }

  const raw = Buffer.concat(chunks).toString("utf-8").trim();
  if (!raw) {
    return {} as T;
  }

  return JSON.parse(raw) as T;
}

function generateOtpCode(length: number): string {
  const min = 10 ** Math.max(length - 1, 1);
  const max = 10 ** length;
  return String(Math.floor(Math.random() * (max - min) + min));
}

function generateToken(prefix: string): string {
  return `${prefix}_${randomUUID().replace(/-/g, "")}${randomBytes(8).toString("hex")}`;
}

function deriveUserId(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return `usr_${digits.slice(-10) || randomUUID().replace(/-/g, "").slice(0, 10)}`;
}

function extractUserIdHeader(req: IncomingMessage): string | null {
  const raw = req.headers["x-user-id"];
  if (!raw) {
    return null;
  }

  const value = Array.isArray(raw) ? raw[0] : raw;
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function pruneTimestamps(now: number, timestamps: number[], windowMs: number): number[] {
  return timestamps.filter((value) => now - value < windowMs);
}

export function createAuthServer(config: AuthConfig) {
  const otpByKey = new Map<string, OtpRecord>();
  const refreshByToken = new Map<string, RefreshRecord>();
  const requestAttemptsByPhone = new Map<string, number[]>();
  const sessionsById = new Map<string, SessionRecord>();
  const sessionIdsByUserId = new Map<string, Set<string>>();

  const cleanupTimer = setInterval(() => {
    const now = Date.now();

    for (const [key, otp] of otpByKey.entries()) {
      if (otp.expiresAtMs <= now) {
        otpByKey.delete(key);
      }
    }

    for (const [token, refreshRecord] of refreshByToken.entries()) {
      if (refreshRecord.expiresAtMs <= now) {
        const session = sessionsById.get(refreshRecord.sessionId);
        if (session && session.currentRefreshToken === token) {
          session.revokedAt = new Date(now).toISOString();
        }
        refreshByToken.delete(token);
      }
    }

    for (const [phone, attempts] of requestAttemptsByPhone.entries()) {
      const validAttempts = pruneTimestamps(now, attempts, config.otpRateWindowSec * 1000);
      if (validAttempts.length === 0) {
        requestAttemptsByPhone.delete(phone);
      } else {
        requestAttemptsByPhone.set(phone, validAttempts);
      }
    }
  }, 60_000);

  const server = createServer(async (req, res) => {
    try {
      const method = req.method ?? "GET";
      const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);

      if (method === "GET" && url.pathname === "/healthz") {
        return sendJson(res, 200, {
          success: true,
          data: {
            service: config.serviceName,
            status: "ok",
            timestamp: new Date().toISOString()
          }
        });
      }

      if (method === "POST" && url.pathname === "/auth/otp/request") {
        const body = await readJson<RequestOtpBody>(req);
        const phone = body.phone?.trim() ?? "";

        if (!PHONE_REGEX.test(phone)) {
          return sendJson(res, 400, {
            success: false,
            error: {
              code: "INVALID_PHONE",
              message: "Phone number is invalid"
            }
          });
        }

        const now = Date.now();
        const windowMs = config.otpRateWindowSec * 1000;
        const attempts = pruneTimestamps(now, requestAttemptsByPhone.get(phone) ?? [], windowMs);

        if (attempts.length >= config.otpMaxRequestsPerWindow) {
          const retryAfterSec = Math.max(1, Math.ceil((attempts[0] + windowMs - now) / 1000));
          return sendJson(res, 429, {
            success: false,
            error: {
              code: "OTP_RATE_LIMITED",
              message: "Too many OTP requests"
            },
            data: {
              retryAfter: retryAfterSec
            }
          });
        }

        const requestId = `req_${randomUUID().replace(/-/g, "")}`;
        const otpCode = generateOtpCode(config.otpLength);
        const expiresAtMs = now + config.otpTtlSec * 1000;
        const key = `${phone}:${requestId}`;

        otpByKey.set(key, {
          phone,
          requestId,
          code: otpCode,
          expiresAtMs
        });

        attempts.push(now);
        requestAttemptsByPhone.set(phone, attempts);

        log(config.serviceName, "info", "OTP issued", {
          phone,
          requestId,
          expiresAtMs
        });

        return sendJson(res, 200, {
          success: true,
          data: {
            requestId,
            expiresIn: config.otpTtlSec,
            retryAfter: 60,
            ...(config.exposeOtpInResponse ? { otpCode } : {})
          }
        });
      }

      if (method === "POST" && url.pathname === "/auth/otp/verify") {
        const body = await readJson<VerifyOtpBody>(req);
        const phone = body.phone?.trim() ?? "";
        const requestId = body.requestId?.trim() ?? "";
        const otp = body.otp?.trim() ?? "";

        if (!phone || !requestId || !otp) {
          return sendJson(res, 400, {
            success: false,
            error: {
              code: "INVALID_VERIFY_PAYLOAD",
              message: "phone, requestId and otp are required"
            }
          });
        }

        const key = `${phone}:${requestId}`;
        const record = otpByKey.get(key);

        if (!record) {
          return sendJson(res, 401, {
            success: false,
            error: {
              code: "OTP_NOT_FOUND",
              message: "OTP request not found"
            }
          });
        }

        if (Date.now() > record.expiresAtMs) {
          otpByKey.delete(key);
          return sendJson(res, 401, {
            success: false,
            error: {
              code: "OTP_EXPIRED",
              message: "OTP has expired"
            }
          });
        }

        if (record.code !== otp) {
          return sendJson(res, 401, {
            success: false,
            error: {
              code: "OTP_INVALID",
              message: "OTP is invalid"
            }
          });
        }

        otpByKey.delete(key);

        const userId = deriveUserId(phone);
        const sessionId = `ses_${randomUUID().replace(/-/g, "")}`;
        const accessToken = generateToken("atk");
        const refreshToken = generateToken("rtk");
        const accessTokenExpiresAtMs = Date.now() + config.accessTokenTtlSec * 1000;
        const refreshTokenExpiresAtMs = Date.now() + config.refreshTokenTtlSec * 1000;
        const nowIso = new Date().toISOString();

        refreshByToken.set(refreshToken, {
          userId,
          phone,
          sessionId,
          expiresAtMs: refreshTokenExpiresAtMs
        });

        const session: SessionRecord = {
          id: sessionId,
          userId,
          phone,
          deviceId: body.deviceId?.trim() || `dev_${randomUUID().replace(/-/g, "").slice(0, 12)}`,
          deviceName: body.deviceName?.trim() || "Unknown Device",
          platform: body.platform?.trim() || "unknown",
          createdAt: nowIso,
          lastActiveAt: nowIso,
          currentRefreshToken: refreshToken
        };

        sessionsById.set(sessionId, session);
        const userSessions = sessionIdsByUserId.get(userId) ?? new Set<string>();
        userSessions.add(sessionId);
        sessionIdsByUserId.set(userId, userSessions);

        return sendJson(res, 200, {
          success: true,
          data: {
            userId,
            sessionId,
            accessToken,
            accessTokenExpiresAt: new Date(accessTokenExpiresAtMs).toISOString(),
            refreshToken,
            refreshTokenExpiresAt: new Date(refreshTokenExpiresAtMs).toISOString()
          }
        });
      }

      if (method === "POST" && url.pathname === "/auth/refresh") {
        const body = await readJson<RefreshBody>(req);
        const refreshToken = body.refreshToken?.trim() ?? "";

        if (!refreshToken) {
          return sendJson(res, 400, {
            success: false,
            error: {
              code: "INVALID_REFRESH_PAYLOAD",
              message: "refreshToken is required"
            }
          });
        }

        const refreshRecord = refreshByToken.get(refreshToken);
        if (!refreshRecord || Date.now() > refreshRecord.expiresAtMs) {
          refreshByToken.delete(refreshToken);
          return sendJson(res, 401, {
            success: false,
            error: {
              code: "REFRESH_INVALID",
              message: "Refresh token is invalid or expired"
            }
          });
        }

        const session = sessionsById.get(refreshRecord.sessionId);
        if (!session || session.revokedAt) {
          refreshByToken.delete(refreshToken);
          return sendJson(res, 401, {
            success: false,
            error: {
              code: "SESSION_REVOKED",
              message: "Session is revoked or unavailable"
            }
          });
        }

        refreshByToken.delete(refreshToken);

        const nextAccessToken = generateToken("atk");
        const nextRefreshToken = generateToken("rtk");
        const accessTokenExpiresAtMs = Date.now() + config.accessTokenTtlSec * 1000;
        const refreshTokenExpiresAtMs = Date.now() + config.refreshTokenTtlSec * 1000;

        refreshByToken.set(nextRefreshToken, {
          userId: refreshRecord.userId,
          phone: refreshRecord.phone,
          sessionId: refreshRecord.sessionId,
          expiresAtMs: refreshTokenExpiresAtMs
        });

        session.currentRefreshToken = nextRefreshToken;
        session.lastActiveAt = new Date().toISOString();

        return sendJson(res, 200, {
          success: true,
          data: {
            userId: refreshRecord.userId,
            sessionId: refreshRecord.sessionId,
            accessToken: nextAccessToken,
            accessTokenExpiresAt: new Date(accessTokenExpiresAtMs).toISOString(),
            refreshToken: nextRefreshToken,
            refreshTokenExpiresAt: new Date(refreshTokenExpiresAtMs).toISOString()
          }
        });
      }

      if (method === "GET" && url.pathname === "/auth/sessions") {
        const userId = extractUserIdHeader(req);
        if (!userId) {
          return sendJson(res, 401, {
            success: false,
            error: {
              code: "UNAUTHORIZED",
              message: "Missing x-user-id header"
            }
          });
        }

        const sessionIds = sessionIdsByUserId.get(userId) ?? new Set<string>();
        const sessions = Array.from(sessionIds.values())
          .map((sessionId) => sessionsById.get(sessionId))
          .filter((session): session is SessionRecord => Boolean(session))
          .sort((left, right) => right.lastActiveAt.localeCompare(left.lastActiveAt))
          .map((session) => ({
            sessionId: session.id,
            phone: session.phone,
            deviceId: session.deviceId,
            deviceName: session.deviceName,
            platform: session.platform,
            createdAt: session.createdAt,
            lastActiveAt: session.lastActiveAt,
            revokedAt: session.revokedAt
          }));

        return sendJson(res, 200, {
          success: true,
          data: sessions
        });
      }

      const revokeMatch = /^\/auth\/sessions\/([^/]+)$/.exec(url.pathname);
      if (method === "DELETE" && revokeMatch) {
        const userId = extractUserIdHeader(req);
        if (!userId) {
          return sendJson(res, 401, {
            success: false,
            error: {
              code: "UNAUTHORIZED",
              message: "Missing x-user-id header"
            }
          });
        }

        const session = sessionsById.get(revokeMatch[1]);
        if (!session) {
          return sendJson(res, 404, {
            success: false,
            error: {
              code: "SESSION_NOT_FOUND",
              message: "Session not found"
            }
          });
        }

        if (session.userId !== userId) {
          return sendJson(res, 403, {
            success: false,
            error: {
              code: "FORBIDDEN",
              message: "Cannot revoke session of another user"
            }
          });
        }

        session.revokedAt = new Date().toISOString();
        refreshByToken.delete(session.currentRefreshToken);

        return sendJson(res, 200, {
          success: true,
          data: {
            sessionId: session.id,
            revokedAt: session.revokedAt
          }
        });
      }

      return sendJson(res, 404, {
        success: false,
        error: {
          code: "NOT_FOUND",
          message: "Route not found"
        }
      });
    } catch (error) {
      log(config.serviceName, "error", "Unhandled request error", {
        error: error instanceof Error ? error.message : String(error)
      });

      return sendJson(res, 500, {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "Internal server error"
        }
      });
    }
  });

  server.on("close", () => {
    clearInterval(cleanupTimer);
  });

  return server;
}
