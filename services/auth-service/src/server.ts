import { createHash, randomBytes, randomUUID } from "node:crypto";
import { createServer, IncomingMessage, ServerResponse } from "node:http";

import {
  createPostgresPool,
  queryMany,
  queryOne,
  withPostgresTransaction
} from "@ticket-platform/local-infra";
import type { Pool } from "pg";

import type { AuthConfig } from "./config.js";
import { log } from "./logger.js";

interface OtpRow {
  key: string;
  phone: string;
  request_id: string;
  code: string;
  expires_at: string | Date;
}

interface RefreshRow {
  token: string;
  user_id: string;
  phone: string;
  session_id: string;
  expires_at: string | Date;
}

interface SessionRow {
  id: string;
  user_id: string;
  phone: string;
  device_id: string;
  device_name: string;
  platform: string;
  created_at: string | Date;
  last_active_at: string | Date;
  current_refresh_token: string;
  revoked_at: string | Date | null;
}

interface RateRow {
  phone: string;
  attempted_at: string | Date;
}

interface HandoffRow {
  token_hash: string;
  user_id: string;
  phone: string;
  source_session_id: string;
  expires_at: string | Date;
  consumed_at: string | Date | null;
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

interface CreateHandoffBody {
  refreshToken?: string;
}

interface ExchangeHandoffBody {
  handoffToken?: string;
  deviceId?: string;
  deviceName?: string;
  platform?: string;
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

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function deriveUserId(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return `usr_${digits || randomUUID().replace(/-/g, "").slice(0, 10)}`;
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

function toIso(value: string | Date): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

async function ensureSchema(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS auth_otp_requests (
      key TEXT PRIMARY KEY,
      phone TEXT NOT NULL,
      request_id TEXT NOT NULL,
      code TEXT NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS auth_rate_attempts (
      id SERIAL PRIMARY KEY,
      phone TEXT NOT NULL,
      attempted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_auth_rate_attempts_phone ON auth_rate_attempts (phone, attempted_at);
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS auth_sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      phone TEXT NOT NULL,
      device_id TEXT NOT NULL,
      device_name TEXT NOT NULL,
      platform TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_active_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      current_refresh_token TEXT NOT NULL,
      revoked_at TIMESTAMPTZ
    );
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_auth_sessions_user_id ON auth_sessions (user_id);
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS auth_refresh_tokens (
      token TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      phone TEXT NOT NULL,
      session_id TEXT NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS auth_handoff_tokens (
      token_hash TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      phone TEXT NOT NULL,
      source_session_id TEXT NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      consumed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}

export async function createAuthServer(config: AuthConfig) {
  const pool = createPostgresPool(process.env);
  await ensureSchema(pool);

  const cleanupTimer = setInterval(async () => {
    try {
      const now = new Date().toISOString();
      await pool.query(`DELETE FROM auth_otp_requests WHERE expires_at <= $1::timestamptz`, [now]);
      await pool.query(
        `DELETE FROM auth_rate_attempts WHERE attempted_at < NOW() - INTERVAL '1 second' * $1`,
        [config.otpRateWindowSec]
      );

      const expiredTokens = await queryMany<{ token: string; session_id: string }>(
        pool,
        `SELECT token, session_id FROM auth_refresh_tokens WHERE expires_at <= $1::timestamptz`,
        [now]
      );

      for (const expired of expiredTokens) {
        await pool.query(
          `UPDATE auth_sessions SET revoked_at = NOW() WHERE id = $1 AND current_refresh_token = $2 AND revoked_at IS NULL`,
          [expired.session_id, expired.token]
        );
      }

      await pool.query(`DELETE FROM auth_refresh_tokens WHERE expires_at <= $1::timestamptz`, [
        now
      ]);
      await pool.query(
        `DELETE FROM auth_handoff_tokens WHERE expires_at <= $1::timestamptz OR consumed_at IS NOT NULL`,
        [now]
      );
    } catch (error) {
      log(config.serviceName, "error", "Cleanup failed", {
        error: error instanceof Error ? error.message : String(error)
      });
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
            storage: "postgres",
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

        const now = new Date();
        const windowStart = new Date(now.getTime() - config.otpRateWindowSec * 1000);

        const countResult = await queryOne<{ count: string }>(
          pool,
          `SELECT COUNT(*)::text AS count FROM auth_rate_attempts WHERE phone = $1 AND attempted_at >= $2::timestamptz`,
          [phone, windowStart.toISOString()]
        );

        const attempts = Number(countResult?.count ?? 0);
        if (attempts >= config.otpMaxRequestsPerWindow) {
          const oldest = await queryOne<{ attempted_at: string | Date }>(
            pool,
            `SELECT attempted_at FROM auth_rate_attempts WHERE phone = $1 AND attempted_at >= $2::timestamptz ORDER BY attempted_at ASC LIMIT 1`,
            [phone, windowStart.toISOString()]
          );
          const oldestMs = oldest ? new Date(oldest.attempted_at).getTime() : now.getTime();
          const retryAfterSec = Math.max(
            1,
            Math.ceil((oldestMs + config.otpRateWindowSec * 1000 - now.getTime()) / 1000)
          );

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
        const expiresAt = new Date(now.getTime() + config.otpTtlSec * 1000).toISOString();
        const key = `${phone}:${requestId}`;

        await pool.query(
          `INSERT INTO auth_otp_requests (key, phone, request_id, code, expires_at) VALUES ($1, $2, $3, $4, $5::timestamptz)`,
          [key, phone, requestId, otpCode, expiresAt]
        );

        await pool.query(
          `INSERT INTO auth_rate_attempts (phone, attempted_at) VALUES ($1, $2::timestamptz)`,
          [phone, now.toISOString()]
        );

        log(config.serviceName, "info", "OTP issued", {
          phone,
          requestId,
          expiresAt
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
        const record = await queryOne<OtpRow>(
          pool,
          `SELECT key, phone, request_id, code, expires_at FROM auth_otp_requests WHERE key = $1`,
          [key]
        );

        if (!record) {
          return sendJson(res, 401, {
            success: false,
            error: {
              code: "OTP_NOT_FOUND",
              message: "OTP request not found"
            }
          });
        }

        if (new Date().getTime() > new Date(record.expires_at).getTime()) {
          await pool.query(`DELETE FROM auth_otp_requests WHERE key = $1`, [key]);
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

        await pool.query(`DELETE FROM auth_otp_requests WHERE key = $1`, [key]);

        const userId = deriveUserId(phone);
        const sessionId = `ses_${randomUUID().replace(/-/g, "")}`;
        const accessToken = generateToken("atk");
        const refreshToken = generateToken("rtk");
        const nowMs = Date.now();
        const accessTokenExpiresAtMs = nowMs + config.accessTokenTtlSec * 1000;
        const refreshTokenExpiresAtMs = nowMs + config.refreshTokenTtlSec * 1000;
        const nowIso = new Date(nowMs).toISOString();

        await withPostgresTransaction(pool, async (client) => {
          await client.query(
            `INSERT INTO auth_sessions (id, user_id, phone, device_id, device_name, platform, created_at, last_active_at, current_refresh_token)
             VALUES ($1, $2, $3, $4, $5, $6, $7::timestamptz, $7::timestamptz, $8)`,
            [
              sessionId,
              userId,
              phone,
              body.deviceId?.trim() || `dev_${randomUUID().replace(/-/g, "").slice(0, 12)}`,
              body.deviceName?.trim() || "Unknown Device",
              body.platform?.trim() || "unknown",
              nowIso,
              refreshToken
            ]
          );

          await client.query(
            `INSERT INTO auth_refresh_tokens (token, user_id, phone, session_id, expires_at)
             VALUES ($1, $2, $3, $4, $5::timestamptz)`,
            [
              refreshToken,
              userId,
              phone,
              sessionId,
              new Date(refreshTokenExpiresAtMs).toISOString()
            ]
          );
        });

        // Fire-and-forget: ensure user profile exists with the real phone number.
        fetch(`${config.userServiceBaseUrl}/internal/users/${encodeURIComponent(userId)}/ensure`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-internal-api-key": config.internalApiKey
          },
          body: JSON.stringify({ phone })
        }).catch(() => {
          // Non-fatal — profile will be created lazily on first /users/me call
        });

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

        const refreshRecord = await queryOne<RefreshRow>(
          pool,
          `SELECT token, user_id, phone, session_id, expires_at FROM auth_refresh_tokens WHERE token = $1`,
          [refreshToken]
        );

        if (!refreshRecord || new Date().getTime() > new Date(refreshRecord.expires_at).getTime()) {
          if (refreshRecord) {
            await pool.query(`DELETE FROM auth_refresh_tokens WHERE token = $1`, [refreshToken]);
          }
          return sendJson(res, 401, {
            success: false,
            error: {
              code: "REFRESH_INVALID",
              message: "Refresh token is invalid or expired"
            }
          });
        }

        const session = await queryOne<SessionRow>(
          pool,
          `SELECT id, user_id, phone, device_id, device_name, platform, created_at, last_active_at, current_refresh_token, revoked_at
           FROM auth_sessions WHERE id = $1`,
          [refreshRecord.session_id]
        );

        if (!session || session.revoked_at) {
          await pool.query(`DELETE FROM auth_refresh_tokens WHERE token = $1`, [refreshToken]);
          return sendJson(res, 401, {
            success: false,
            error: {
              code: "SESSION_REVOKED",
              message: "Session is revoked or unavailable"
            }
          });
        }

        const nextAccessToken = generateToken("atk");
        const nextRefreshToken = generateToken("rtk");
        const accessTokenExpiresAtMs = Date.now() + config.accessTokenTtlSec * 1000;
        const refreshTokenExpiresAtMs = Date.now() + config.refreshTokenTtlSec * 1000;

        await withPostgresTransaction(pool, async (client) => {
          await client.query(`DELETE FROM auth_refresh_tokens WHERE token = $1`, [refreshToken]);
          await client.query(
            `INSERT INTO auth_refresh_tokens (token, user_id, phone, session_id, expires_at)
             VALUES ($1, $2, $3, $4, $5::timestamptz)`,
            [
              nextRefreshToken,
              refreshRecord.user_id,
              refreshRecord.phone,
              refreshRecord.session_id,
              new Date(refreshTokenExpiresAtMs).toISOString()
            ]
          );

          await client.query(
            `UPDATE auth_sessions SET current_refresh_token = $2, last_active_at = NOW() WHERE id = $1`,
            [refreshRecord.session_id, nextRefreshToken]
          );
        });

        return sendJson(res, 200, {
          success: true,
          data: {
            userId: refreshRecord.user_id,
            sessionId: refreshRecord.session_id,
            accessToken: nextAccessToken,
            accessTokenExpiresAt: new Date(accessTokenExpiresAtMs).toISOString(),
            refreshToken: nextRefreshToken,
            refreshTokenExpiresAt: new Date(refreshTokenExpiresAtMs).toISOString()
          }
        });
      }

      if (method === "POST" && url.pathname === "/auth/handoff/create") {
        const body = await readJson<CreateHandoffBody>(req);
        const refreshToken = body.refreshToken?.trim() ?? "";

        if (!refreshToken) {
          return sendJson(res, 400, {
            success: false,
            error: {
              code: "INVALID_HANDOFF_CREATE_PAYLOAD",
              message: "refreshToken is required"
            }
          });
        }

        const refreshRecord = await queryOne<RefreshRow>(
          pool,
          `SELECT token, user_id, phone, session_id, expires_at FROM auth_refresh_tokens WHERE token = $1`,
          [refreshToken]
        );

        if (!refreshRecord || new Date().getTime() > new Date(refreshRecord.expires_at).getTime()) {
          return sendJson(res, 401, {
            success: false,
            error: {
              code: "REFRESH_INVALID",
              message: "Refresh token is invalid or expired"
            }
          });
        }

        const handoffToken = generateToken("hnd");
        const expiresAt = new Date(Date.now() + 180_000).toISOString();

        await pool.query(
          `INSERT INTO auth_handoff_tokens (token_hash, user_id, phone, source_session_id, expires_at)
           VALUES ($1, $2, $3, $4, $5::timestamptz)`,
          [
            hashToken(handoffToken),
            refreshRecord.user_id,
            refreshRecord.phone,
            refreshRecord.session_id,
            expiresAt
          ]
        );

        return sendJson(res, 200, {
          success: true,
          data: {
            handoffToken,
            expiresAt
          }
        });
      }

      if (method === "POST" && url.pathname === "/auth/handoff/exchange") {
        const body = await readJson<ExchangeHandoffBody>(req);
        const handoffToken = body.handoffToken?.trim() ?? "";

        if (!handoffToken) {
          return sendJson(res, 400, {
            success: false,
            error: {
              code: "INVALID_HANDOFF_EXCHANGE_PAYLOAD",
              message: "handoffToken is required"
            }
          });
        }

        const tokenHash = hashToken(handoffToken);
        const handoff = await queryOne<HandoffRow>(
          pool,
          `SELECT token_hash, user_id, phone, source_session_id, expires_at, consumed_at
           FROM auth_handoff_tokens WHERE token_hash = $1`,
          [tokenHash]
        );

        if (
          !handoff ||
          handoff.consumed_at ||
          new Date().getTime() > new Date(handoff.expires_at).getTime()
        ) {
          return sendJson(res, 401, {
            success: false,
            error: {
              code: "HANDOFF_INVALID",
              message: "Handoff token is invalid, expired or already consumed"
            }
          });
        }

        const sessionId = `ses_${randomUUID().replace(/-/g, "")}`;
        const accessToken = generateToken("atk");
        const refreshToken = generateToken("rtk");
        const nowMs = Date.now();
        const accessTokenExpiresAtMs = nowMs + config.accessTokenTtlSec * 1000;
        const refreshTokenExpiresAtMs = nowMs + config.refreshTokenTtlSec * 1000;
        const nowIso = new Date(nowMs).toISOString();

        await withPostgresTransaction(pool, async (client) => {
          await client.query(
            `UPDATE auth_handoff_tokens SET consumed_at = $2::timestamptz WHERE token_hash = $1 AND consumed_at IS NULL`,
            [tokenHash, nowIso]
          );
          await client.query(
            `INSERT INTO auth_sessions (id, user_id, phone, device_id, device_name, platform, created_at, last_active_at, current_refresh_token)
             VALUES ($1, $2, $3, $4, $5, $6, $7::timestamptz, $7::timestamptz, $8)`,
            [
              sessionId,
              handoff.user_id,
              handoff.phone,
              body.deviceId?.trim() || `dev_${randomUUID().replace(/-/g, "").slice(0, 12)}`,
              body.deviceName?.trim() || "Entr native app",
              body.platform?.trim() || "native",
              nowIso,
              refreshToken
            ]
          );
          await client.query(
            `INSERT INTO auth_refresh_tokens (token, user_id, phone, session_id, expires_at)
             VALUES ($1, $2, $3, $4, $5::timestamptz)`,
            [
              refreshToken,
              handoff.user_id,
              handoff.phone,
              sessionId,
              new Date(refreshTokenExpiresAtMs).toISOString()
            ]
          );
        });

        fetch(
          `${config.userServiceBaseUrl}/internal/users/${encodeURIComponent(handoff.user_id)}/ensure`,
          {
            method: "POST",
            headers: {
              "content-type": "application/json",
              "x-internal-api-key": config.internalApiKey
            },
            body: JSON.stringify({ phone: handoff.phone })
          }
        ).catch(() => {});

        return sendJson(res, 200, {
          success: true,
          data: {
            userId: handoff.user_id,
            phone: handoff.phone,
            sessionId,
            accessToken,
            accessTokenExpiresAt: new Date(accessTokenExpiresAtMs).toISOString(),
            refreshToken,
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

        const rows = await queryMany<SessionRow>(
          pool,
          `SELECT id, user_id, phone, device_id, device_name, platform, created_at, last_active_at, current_refresh_token, revoked_at
           FROM auth_sessions WHERE user_id = $1 ORDER BY last_active_at DESC`,
          [userId]
        );

        const sessions = rows.map((session) => ({
          sessionId: session.id,
          phone: session.phone,
          deviceId: session.device_id,
          deviceName: session.device_name,
          platform: session.platform,
          createdAt: toIso(session.created_at),
          lastActiveAt: toIso(session.last_active_at),
          revokedAt: session.revoked_at ? toIso(session.revoked_at) : undefined
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

        const session = await queryOne<SessionRow>(
          pool,
          `SELECT id, user_id, phone, device_id, device_name, platform, created_at, last_active_at, current_refresh_token, revoked_at
           FROM auth_sessions WHERE id = $1`,
          [revokeMatch[1]]
        );

        if (!session) {
          return sendJson(res, 404, {
            success: false,
            error: {
              code: "SESSION_NOT_FOUND",
              message: "Session not found"
            }
          });
        }

        if (session.user_id !== userId) {
          return sendJson(res, 403, {
            success: false,
            error: {
              code: "FORBIDDEN",
              message: "Cannot revoke session of another user"
            }
          });
        }

        const revokedAt = new Date().toISOString();
        await pool.query(`UPDATE auth_sessions SET revoked_at = $2::timestamptz WHERE id = $1`, [
          session.id,
          revokedAt
        ]);
        await pool.query(`DELETE FROM auth_refresh_tokens WHERE token = $1`, [
          session.current_refresh_token
        ]);

        return sendJson(res, 200, {
          success: true,
          data: {
            sessionId: session.id,
            revokedAt
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
    void pool.end();
  });

  return server;
}
