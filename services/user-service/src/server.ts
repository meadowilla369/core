import { randomUUID } from "node:crypto";
import { createServer, IncomingMessage, ServerResponse } from "node:http";

import {
  createPostgresPool,
  queryMany,
  queryOne,
  withPostgresTransaction
} from "@ticket-platform/local-infra";
import type { Pool } from "pg";

import type { UserServiceConfig } from "./config.js";
import { log } from "./logger.js";

interface UserProfileRow {
  id: string;
  phone_number: string;
  full_name: string;
  email: string | null;
  email_verified: boolean;
  is_frozen: boolean;
  freeze_reason: string | null;
  updated_at: string | Date;
}

interface UserDeviceRow {
  id: string;
  user_id: string;
  device_name: string;
  platform: string;
  is_current: boolean;
  revoked_at: string | Date | null;
  revoked_reason: string | null;
  last_active_at: string | Date;
}

interface UserAuditLogRow {
  id: string;
  user_id: string;
  action: string;
  actor: string;
  reason: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string | Date;
}

interface UpdateProfileBody {
  fullName?: string;
  email?: string;
}

interface SetEmailBody {
  email?: string;
}

interface FreezeBody {
  reason?: string;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

function extractUserId(req: IncomingMessage): string | null {
  const value = req.headers["x-user-id"];
  if (!value) {
    return null;
  }

  const userId = Array.isArray(value) ? value[0] : value;
  return userId?.trim() || null;
}

function derivePhoneNumber(userId: string): string {
  const suffix = userId
    .replace(/[^0-9]/g, "")
    .slice(-8)
    .padStart(8, "0");
  return `+849${suffix}`;
}

function toIso(value: string | Date): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function mapProfile(row: UserProfileRow) {
  return {
    id: row.id,
    phoneNumber: row.phone_number,
    fullName: row.full_name,
    email: row.email ?? undefined,
    emailVerified: row.email_verified,
    isFrozen: row.is_frozen,
    freezeReason: row.freeze_reason ?? undefined,
    updatedAt: toIso(row.updated_at)
  };
}

function mapDevice(row: UserDeviceRow) {
  return {
    id: row.id,
    deviceName: row.device_name,
    platform: row.platform,
    isCurrent: row.is_current,
    revokedAt: row.revoked_at ? toIso(row.revoked_at) : undefined,
    revokedReason: row.revoked_reason ?? undefined,
    lastActiveAt: toIso(row.last_active_at)
  };
}

function mapAuditLog(row: UserAuditLogRow) {
  return {
    id: row.id,
    action: row.action,
    actor: row.actor,
    reason: row.reason ?? undefined,
    metadata: row.metadata ?? undefined,
    createdAt: toIso(row.created_at)
  };
}

async function ensureSchema(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_profiles (
      id TEXT PRIMARY KEY,
      phone_number TEXT NOT NULL,
      full_name TEXT NOT NULL DEFAULT '',
      email TEXT,
      email_verified BOOLEAN NOT NULL DEFAULT FALSE,
      is_frozen BOOLEAN NOT NULL DEFAULT FALSE,
      freeze_reason TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_devices (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
      device_name TEXT NOT NULL,
      platform TEXT NOT NULL DEFAULT 'unknown',
      is_current BOOLEAN NOT NULL DEFAULT FALSE,
      revoked_at TIMESTAMPTZ,
      revoked_reason TEXT,
      last_active_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_user_devices_user_id ON user_devices (user_id);
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_audit_logs (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
      action TEXT NOT NULL,
      actor TEXT NOT NULL,
      reason TEXT,
      metadata JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_user_audit_logs_user_id ON user_audit_logs (user_id, created_at DESC);
  `);
}

async function appendAudit(
  pool: Pool,
  userId: string,
  action: string,
  actor: string,
  reason?: string,
  metadata: Record<string, unknown> = {}
): Promise<void> {
  await pool.query(
    `INSERT INTO user_audit_logs (id, user_id, action, actor, reason, metadata) VALUES ($1, $2, $3, $4, $5, $6::jsonb)`,
    [
      `ual_${randomUUID().replace(/-/g, "")}`,
      userId,
      action,
      actor,
      reason ?? null,
      JSON.stringify(metadata)
    ]
  );
}

async function ensureUser(pool: Pool, userId: string): Promise<UserProfileRow> {
  const existing = await queryOne<UserProfileRow>(
    pool,
    `SELECT id, phone_number, full_name, email, email_verified, is_frozen, freeze_reason, updated_at FROM user_profiles WHERE id = $1`,
    [userId]
  );

  if (existing) {
    return existing;
  }

  const now = new Date().toISOString();
  const phoneNumber = derivePhoneNumber(userId);

  await withPostgresTransaction(pool, async (client) => {
    await client.query(
      `INSERT INTO user_profiles (id, phone_number, full_name, created_at, updated_at) VALUES ($1, $2, '', $3::timestamptz, $3::timestamptz) ON CONFLICT (id) DO NOTHING`,
      [userId, phoneNumber, now]
    );

    await client.query(
      `INSERT INTO user_devices (id, user_id, device_name, platform, is_current, last_active_at) VALUES ($1, $2, $3, $4, $5, $6::timestamptz)`,
      [`device_${randomUUID().replace(/-/g, "")}`, userId, "Current Device", "unknown", true, now]
    );

    await client.query(
      `INSERT INTO user_audit_logs (id, user_id, action, actor, metadata) VALUES ($1, $2, $3, $4, $5::jsonb)`,
      [`ual_${randomUUID().replace(/-/g, "")}`, userId, "PROFILE_CREATED", "system", "{}"]
    );
  });

  const created = await queryOne<UserProfileRow>(
    pool,
    `SELECT id, phone_number, full_name, email, email_verified, is_frozen, freeze_reason, updated_at FROM user_profiles WHERE id = $1`,
    [userId]
  );

  return created!;
}

export async function createUserServer(config: UserServiceConfig) {
  const pool = createPostgresPool(process.env);
  await ensureSchema(pool);

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

      if (!url.pathname.startsWith("/users/")) {
        return sendJson(res, 404, {
          success: false,
          error: {
            code: "NOT_FOUND",
            message: "Route not found"
          }
        });
      }

      const userId = extractUserId(req);
      if (!userId) {
        return sendJson(res, 401, {
          success: false,
          error: {
            code: "UNAUTHORIZED",
            message: "Missing x-user-id header"
          }
        });
      }

      const profileRow = await ensureUser(pool, userId);

      if (method === "GET" && url.pathname === "/users/me") {
        return sendJson(res, 200, {
          success: true,
          data: mapProfile(profileRow)
        });
      }

      if (method === "PUT" && url.pathname === "/users/me") {
        const body = await readJson<UpdateProfileBody>(req);
        const updates: string[] = [];
        const values: unknown[] = [];
        let paramIdx = 1;

        if (typeof body.fullName === "string") {
          paramIdx++;
          updates.push(`full_name = $${paramIdx}`);
          values.push(body.fullName.trim());
        }

        if (typeof body.email === "string") {
          const nextEmail = body.email.trim().toLowerCase();
          if (nextEmail && !EMAIL_REGEX.test(nextEmail)) {
            return sendJson(res, 400, {
              success: false,
              error: {
                code: "INVALID_EMAIL",
                message: "Email format is invalid"
              }
            });
          }

          paramIdx++;
          updates.push(`email = $${paramIdx}`);
          values.push(nextEmail || null);
          updates.push(`email_verified = FALSE`);
        }

        if (updates.length > 0) {
          updates.push(`updated_at = NOW()`);
          await pool.query(`UPDATE user_profiles SET ${updates.join(", ")} WHERE id = $1`, [
            userId,
            ...values
          ]);
        }

        await appendAudit(pool, userId, "PROFILE_UPDATED", userId, undefined, {
          fullNameUpdated: typeof body.fullName === "string",
          emailUpdated: typeof body.email === "string"
        });

        const updated = await queryOne<UserProfileRow>(
          pool,
          `SELECT id, phone_number, full_name, email, email_verified, is_frozen, freeze_reason, updated_at FROM user_profiles WHERE id = $1`,
          [userId]
        );

        return sendJson(res, 200, {
          success: true,
          data: mapProfile(updated!)
        });
      }

      if (method === "POST" && url.pathname === "/users/me/email") {
        const body = await readJson<SetEmailBody>(req);
        const email = body.email?.trim().toLowerCase() ?? "";

        if (!email || !EMAIL_REGEX.test(email)) {
          return sendJson(res, 400, {
            success: false,
            error: {
              code: "INVALID_EMAIL",
              message: "Valid email is required"
            }
          });
        }

        await pool.query(
          `UPDATE user_profiles SET email = $2, email_verified = FALSE, updated_at = NOW() WHERE id = $1`,
          [userId, email]
        );
        await appendAudit(pool, userId, "EMAIL_SET", userId, undefined, { email });

        return sendJson(res, 200, {
          success: true,
          data: {
            email,
            verificationSent: true
          }
        });
      }

      if (method === "GET" && url.pathname === "/users/me/devices") {
        const devices = await queryMany<UserDeviceRow>(
          pool,
          `SELECT id, user_id, device_name, platform, is_current, revoked_at, revoked_reason, last_active_at
           FROM user_devices WHERE user_id = $1 ORDER BY last_active_at DESC`,
          [userId]
        );

        return sendJson(res, 200, {
          success: true,
          data: devices.map(mapDevice)
        });
      }

      const revokeMatch = url.pathname.match(/^\/users\/me\/devices\/([^/]+)$/);
      if (method === "DELETE" && revokeMatch) {
        const deviceId = revokeMatch[1];
        const device = await queryOne<UserDeviceRow>(
          pool,
          `SELECT id, user_id, device_name, platform, is_current, revoked_at, revoked_reason, last_active_at
           FROM user_devices WHERE id = $1 AND user_id = $2`,
          [deviceId, userId]
        );

        if (!device) {
          return sendJson(res, 404, {
            success: false,
            error: {
              code: "DEVICE_NOT_FOUND",
              message: "Device not found"
            }
          });
        }

        if (device.is_current) {
          return sendJson(res, 400, {
            success: false,
            error: {
              code: "DEVICE_REVOKE_BLOCKED",
              message: "Cannot revoke current device"
            }
          });
        }

        await pool.query(
          `UPDATE user_devices SET revoked_at = NOW(), revoked_reason = 'user_request' WHERE id = $1`,
          [deviceId]
        );
        await appendAudit(pool, userId, "DEVICE_REVOKED", userId, "user_request", { deviceId });

        return sendJson(res, 200, {
          success: true,
          data: {
            revoked: true,
            deviceId
          }
        });
      }

      if (method === "POST" && url.pathname === "/users/me/freeze") {
        const body = await readJson<FreezeBody>(req);
        const reason = body.reason?.trim() || "user_requested";

        if (profileRow.is_frozen) {
          return sendJson(res, 400, {
            success: false,
            error: {
              code: "ALREADY_FROZEN",
              message: "User is already frozen"
            }
          });
        }

        await pool.query(
          `UPDATE user_profiles SET is_frozen = TRUE, freeze_reason = $2, updated_at = NOW() WHERE id = $1`,
          [userId, reason]
        );
        await appendAudit(pool, userId, "ACCOUNT_FROZEN", userId, reason);

        const frozen = await queryOne<UserProfileRow>(
          pool,
          `SELECT id, phone_number, full_name, email, email_verified, is_frozen, freeze_reason, updated_at FROM user_profiles WHERE id = $1`,
          [userId]
        );

        return sendJson(res, 200, {
          success: true,
          data: mapProfile(frozen!)
        });
      }

      if (method === "POST" && url.pathname === "/users/me/unfreeze") {
        const body = await readJson<FreezeBody>(req);
        const reason = body.reason?.trim() || "user_requested";

        if (!profileRow.is_frozen) {
          return sendJson(res, 400, {
            success: false,
            error: {
              code: "NOT_FROZEN",
              message: "User is not frozen"
            }
          });
        }

        await pool.query(
          `UPDATE user_profiles SET is_frozen = FALSE, freeze_reason = NULL, updated_at = NOW() WHERE id = $1`,
          [userId]
        );
        await appendAudit(pool, userId, "ACCOUNT_UNFROZEN", userId, reason);

        const unfrozen = await queryOne<UserProfileRow>(
          pool,
          `SELECT id, phone_number, full_name, email, email_verified, is_frozen, freeze_reason, updated_at FROM user_profiles WHERE id = $1`,
          [userId]
        );

        return sendJson(res, 200, {
          success: true,
          data: mapProfile(unfrozen!)
        });
      }

      if (method === "GET" && url.pathname === "/users/me/audit-logs") {
        const entries = await queryMany<UserAuditLogRow>(
          pool,
          `SELECT id, user_id, action, actor, reason, metadata, created_at
           FROM user_audit_logs WHERE user_id = $1 ORDER BY created_at DESC`,
          [userId]
        );

        return sendJson(res, 200, {
          success: true,
          data: entries.map(mapAuditLog)
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
    void pool.end();
  });

  return server;
}
