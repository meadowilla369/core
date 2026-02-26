import { randomUUID } from "node:crypto";
import { createServer, IncomingMessage, ServerResponse } from "node:http";

import type { UserServiceConfig } from "./config.js";
import { log } from "./logger.js";

interface UserProfile {
  id: string;
  phoneNumber: string;
  fullName: string;
  email?: string;
  emailVerified: boolean;
  isFrozen: boolean;
  freezeReason?: string;
  updatedAt: string;
}

interface UserDevice {
  id: string;
  deviceName: string;
  platform: string;
  isCurrent: boolean;
  revokedAt?: string;
  revokedReason?: string;
  lastActiveAt: string;
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

interface UserAuditLog {
  id: string;
  action: string;
  actor: string;
  reason?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
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
  const suffix = userId.replace(/[^0-9]/g, "").slice(-8).padStart(8, "0");
  return `+849${suffix}`;
}

export function createUserServer(config: UserServiceConfig) {
  const users = new Map<string, UserProfile>();
  const devicesByUser = new Map<string, UserDevice[]>();
  const auditLogsByUser = new Map<string, UserAuditLog[]>();

  const appendAudit = (
    userId: string,
    action: string,
    actor: string,
    reason?: string,
    metadata: Record<string, unknown> = {}
  ): void => {
    const entries = auditLogsByUser.get(userId) ?? [];
    entries.push({
      id: `ual_${randomUUID().replace(/-/g, "")}`,
      action,
      actor,
      reason,
      metadata,
      createdAt: new Date().toISOString()
    });
    auditLogsByUser.set(userId, entries);
  };

  const ensureUser = (userId: string): UserProfile => {
    const existing = users.get(userId);
    if (existing) {
      return existing;
    }

    const now = new Date().toISOString();
    const profile: UserProfile = {
      id: userId,
      phoneNumber: derivePhoneNumber(userId),
      fullName: "",
      emailVerified: false,
      isFrozen: false,
      updatedAt: now
    };

    users.set(userId, profile);
    devicesByUser.set(userId, [
      {
        id: `device_${randomUUID().replace(/-/g, "")}`,
        deviceName: "Current Device",
        platform: "unknown",
        isCurrent: true,
        lastActiveAt: now
      }
    ]);
    auditLogsByUser.set(userId, []);
    appendAudit(userId, "PROFILE_CREATED", "system");

    return profile;
  };

  return createServer(async (req, res) => {
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

      const profile = ensureUser(userId);

      if (method === "GET" && url.pathname === "/users/me") {
        return sendJson(res, 200, {
          success: true,
          data: profile
        });
      }

      if (method === "PUT" && url.pathname === "/users/me") {
        const body = await readJson<UpdateProfileBody>(req);

        if (typeof body.fullName === "string") {
          profile.fullName = body.fullName.trim();
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

          profile.email = nextEmail || undefined;
          profile.emailVerified = false;
        }

        profile.updatedAt = new Date().toISOString();
        users.set(userId, profile);
        appendAudit(userId, "PROFILE_UPDATED", userId, undefined, {
          fullNameUpdated: typeof body.fullName === "string",
          emailUpdated: typeof body.email === "string"
        });

        return sendJson(res, 200, {
          success: true,
          data: profile
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

        profile.email = email;
        profile.emailVerified = false;
        profile.updatedAt = new Date().toISOString();
        users.set(userId, profile);
        appendAudit(userId, "EMAIL_SET", userId, undefined, { email });

        return sendJson(res, 200, {
          success: true,
          data: {
            email,
            verificationSent: true
          }
        });
      }

      if (method === "GET" && url.pathname === "/users/me/devices") {
        const devices = devicesByUser.get(userId) ?? [];
        return sendJson(res, 200, {
          success: true,
          data: devices
        });
      }

      const revokeMatch = url.pathname.match(/^\/users\/me\/devices\/([^/]+)$/);
      if (method === "DELETE" && revokeMatch) {
        const deviceId = revokeMatch[1];
        const devices = devicesByUser.get(userId) ?? [];
        const index = devices.findIndex((item) => item.id === deviceId);

        if (index < 0) {
          return sendJson(res, 404, {
            success: false,
            error: {
              code: "DEVICE_NOT_FOUND",
              message: "Device not found"
            }
          });
        }

        if (devices[index].isCurrent) {
          return sendJson(res, 400, {
            success: false,
            error: {
              code: "DEVICE_REVOKE_BLOCKED",
              message: "Cannot revoke current device"
            }
          });
        }

        devices[index] = {
          ...devices[index],
          revokedAt: new Date().toISOString(),
          revokedReason: "user_request"
        };
        devicesByUser.set(userId, devices);
        appendAudit(userId, "DEVICE_REVOKED", userId, "user_request", { deviceId });

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

        if (profile.isFrozen) {
          return sendJson(res, 400, {
            success: false,
            error: {
              code: "ALREADY_FROZEN",
              message: "User is already frozen"
            }
          });
        }

        profile.isFrozen = true;
        profile.freezeReason = reason;
        profile.updatedAt = new Date().toISOString();
        users.set(userId, profile);
        appendAudit(userId, "ACCOUNT_FROZEN", userId, reason);

        return sendJson(res, 200, {
          success: true,
          data: profile
        });
      }

      if (method === "POST" && url.pathname === "/users/me/unfreeze") {
        const body = await readJson<FreezeBody>(req);
        const reason = body.reason?.trim() || "user_requested";

        if (!profile.isFrozen) {
          return sendJson(res, 400, {
            success: false,
            error: {
              code: "NOT_FROZEN",
              message: "User is not frozen"
            }
          });
        }

        profile.isFrozen = false;
        profile.freezeReason = undefined;
        profile.updatedAt = new Date().toISOString();
        users.set(userId, profile);
        appendAudit(userId, "ACCOUNT_UNFROZEN", userId, reason);

        return sendJson(res, 200, {
          success: true,
          data: profile
        });
      }

      if (method === "GET" && url.pathname === "/users/me/audit-logs") {
        const entries = (auditLogsByUser.get(userId) ?? []).slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        return sendJson(res, 200, {
          success: true,
          data: entries
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
}
