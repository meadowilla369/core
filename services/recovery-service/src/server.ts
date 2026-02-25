import { randomUUID } from "node:crypto";
import { createServer, IncomingMessage, ServerResponse } from "node:http";

import type { RecoveryConfig } from "./config.js";
import { log } from "./logger.js";

type RecoveryStatus =
  | "pending_verification"
  | "on_hold"
  | "eligible_for_rotation"
  | "completed"
  | "cancelled";

type RecoveryChannel = "phone_otp" | "email_otp" | "kyc_selfie";

interface InitiateRecoveryBody {
  newDeviceFingerprint?: string;
  reason?: string;
  currentGuardianAddress?: string;
  requestedGuardianAddress?: string;
}

interface VerifyRecoveryBody {
  recoveryId?: string;
  channel?: string;
  code?: string;
}

interface RotateGuardianBody {
  requestedGuardianAddress?: string;
}

interface RecoveryRecord {
  id: string;
  userId: string;
  newDeviceFingerprint: string;
  reason: string;
  status: RecoveryStatus;
  verifiedChannels: Set<RecoveryChannel>;
  initiatedAt: string;
  holdExpiresAt?: string;
  currentGuardianAddress?: string;
  requestedGuardianAddress?: string;
  completedAt?: string;
  cancelledAt?: string;
}

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

function extractSingleHeader(req: IncomingMessage, headerName: string): string | null {
  const value = req.headers[headerName.toLowerCase()];
  if (!value) {
    return null;
  }

  const normalized = Array.isArray(value) ? value[0] : value;
  const trimmed = normalized?.trim();
  return trimmed ? trimmed : null;
}

function extractUserId(req: IncomingMessage): string | null {
  return extractSingleHeader(req, "x-user-id");
}

function toIso(ms: number): string {
  return new Date(ms).toISOString();
}

function parseChannel(raw: string | undefined): RecoveryChannel | null {
  const normalized = raw?.trim().toLowerCase();
  if (normalized === "phone_otp") {
    return "phone_otp";
  }

  if (normalized === "email_otp") {
    return "email_otp";
  }

  if (normalized === "kyc_selfie") {
    return "kyc_selfie";
  }

  return null;
}

function serializeRecovery(recovery: RecoveryRecord): Record<string, unknown> {
  return {
    recoveryId: recovery.id,
    userId: recovery.userId,
    status: recovery.status,
    newDeviceFingerprint: recovery.newDeviceFingerprint,
    reason: recovery.reason,
    verifiedChannels: Array.from(recovery.verifiedChannels.values()),
    initiatedAt: recovery.initiatedAt,
    holdExpiresAt: recovery.holdExpiresAt,
    currentGuardianAddress: recovery.currentGuardianAddress,
    requestedGuardianAddress: recovery.requestedGuardianAddress,
    completedAt: recovery.completedAt,
    cancelledAt: recovery.cancelledAt
  };
}

export function createRecoveryServer(config: RecoveryConfig) {
  const recoveriesById = new Map<string, RecoveryRecord>();

  const updateEligibility = (recovery: RecoveryRecord): void => {
    if (recovery.status !== "on_hold" || !recovery.holdExpiresAt) {
      return;
    }

    if (Date.now() >= new Date(recovery.holdExpiresAt).getTime()) {
      recovery.status = "eligible_for_rotation";
    }
  };

  const eligibilityTimer = setInterval(() => {
    for (const recovery of recoveriesById.values()) {
      const previousStatus = recovery.status;
      updateEligibility(recovery);

      if (previousStatus !== recovery.status && recovery.status === "eligible_for_rotation") {
        log(config.serviceName, "info", "Recovery became eligible for guardian rotation", {
          recoveryId: recovery.id,
          userId: recovery.userId
        });
      }
    }
  }, config.eligibilityScanIntervalMs);

  const server = createServer(async (req, res) => {
    try {
      const method = req.method ?? "GET";
      const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);

      if (method === "GET" && url.pathname === "/healthz") {
        const summary = {
          pendingVerification: 0,
          onHold: 0,
          eligible: 0,
          completed: 0,
          cancelled: 0
        };

        for (const recovery of recoveriesById.values()) {
          if (recovery.status === "pending_verification") {
            summary.pendingVerification += 1;
          }

          if (recovery.status === "on_hold") {
            summary.onHold += 1;
          }

          if (recovery.status === "eligible_for_rotation") {
            summary.eligible += 1;
          }

          if (recovery.status === "completed") {
            summary.completed += 1;
          }

          if (recovery.status === "cancelled") {
            summary.cancelled += 1;
          }
        }

        return sendJson(res, 200, {
          success: true,
          data: {
            service: config.serviceName,
            status: "ok",
            timestamp: new Date().toISOString(),
            summary
          }
        });
      }

      if (method === "POST" && url.pathname === "/recovery/initiate") {
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

        const body = await readJson<InitiateRecoveryBody>(req);
        const newDeviceFingerprint = body.newDeviceFingerprint?.trim() ?? "";

        if (!newDeviceFingerprint) {
          return sendJson(res, 400, {
            success: false,
            error: {
              code: "INVALID_RECOVERY_PAYLOAD",
              message: "newDeviceFingerprint is required"
            }
          });
        }

        const activeRecovery = Array.from(recoveriesById.values()).find(
          (item) =>
            item.userId === userId &&
            item.status !== "cancelled" &&
            item.status !== "completed"
        );

        if (activeRecovery) {
          return sendJson(res, 409, {
            success: false,
            error: {
              code: "RECOVERY_ALREADY_ACTIVE",
              message: "User already has active recovery request"
            }
          });
        }

        const recovery: RecoveryRecord = {
          id: `rcv_${randomUUID().replace(/-/g, "")}`,
          userId,
          newDeviceFingerprint,
          reason: body.reason?.trim() || "lost_device",
          status: "pending_verification",
          verifiedChannels: new Set<RecoveryChannel>(),
          initiatedAt: new Date().toISOString(),
          currentGuardianAddress: body.currentGuardianAddress?.trim(),
          requestedGuardianAddress: body.requestedGuardianAddress?.trim()
        };

        recoveriesById.set(recovery.id, recovery);

        return sendJson(res, 200, {
          success: true,
          data: serializeRecovery(recovery)
        });
      }

      if (method === "POST" && url.pathname === "/recovery/verify") {
        const body = await readJson<VerifyRecoveryBody>(req);
        const recoveryId = body.recoveryId?.trim() ?? "";
        const code = body.code?.trim() ?? "";
        const channel = parseChannel(body.channel);

        if (!recoveryId || !channel || code.length < 4) {
          return sendJson(res, 400, {
            success: false,
            error: {
              code: "INVALID_VERIFY_PAYLOAD",
              message: "recoveryId, valid channel and code are required"
            }
          });
        }

        const recovery = recoveriesById.get(recoveryId);
        if (!recovery) {
          return sendJson(res, 404, {
            success: false,
            error: {
              code: "RECOVERY_NOT_FOUND",
              message: "Recovery request not found"
            }
          });
        }

        if (recovery.status !== "pending_verification") {
          return sendJson(res, 400, {
            success: false,
            error: {
              code: "INVALID_RECOVERY_STATE",
              message: "Recovery is not in pending verification state"
            }
          });
        }

        recovery.verifiedChannels.add(channel);

        if (recovery.verifiedChannels.size >= config.requiredVerificationChannels) {
          recovery.status = "on_hold";
          recovery.holdExpiresAt = toIso(Date.now() + config.holdDurationSec * 1000);
        }

        return sendJson(res, 200, {
          success: true,
          data: serializeRecovery(recovery)
        });
      }

      const statusMatch = /^\/recovery\/([^/]+)\/status$/.exec(url.pathname);
      if (method === "GET" && statusMatch) {
        const recovery = recoveriesById.get(statusMatch[1]);
        if (!recovery) {
          return sendJson(res, 404, {
            success: false,
            error: {
              code: "RECOVERY_NOT_FOUND",
              message: "Recovery request not found"
            }
          });
        }

        updateEligibility(recovery);

        return sendJson(res, 200, {
          success: true,
          data: serializeRecovery(recovery)
        });
      }

      const cancelMatch = /^\/recovery\/([^/]+)\/cancel$/.exec(url.pathname);
      if (method === "POST" && cancelMatch) {
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

        const recovery = recoveriesById.get(cancelMatch[1]);
        if (!recovery) {
          return sendJson(res, 404, {
            success: false,
            error: {
              code: "RECOVERY_NOT_FOUND",
              message: "Recovery request not found"
            }
          });
        }

        if (recovery.userId !== userId) {
          return sendJson(res, 403, {
            success: false,
            error: {
              code: "FORBIDDEN",
              message: "Only request owner can cancel recovery"
            }
          });
        }

        if (recovery.status === "completed" || recovery.status === "cancelled") {
          return sendJson(res, 400, {
            success: false,
            error: {
              code: "INVALID_RECOVERY_STATE",
              message: "Recovery cannot be cancelled"
            }
          });
        }

        recovery.status = "cancelled";
        recovery.cancelledAt = new Date().toISOString();

        return sendJson(res, 200, {
          success: true,
          data: serializeRecovery(recovery)
        });
      }

      const rotateMatch = /^\/recovery\/([^/]+)\/rotate-guardian$/.exec(url.pathname);
      if (method === "POST" && rotateMatch) {
        const recovery = recoveriesById.get(rotateMatch[1]);
        if (!recovery) {
          return sendJson(res, 404, {
            success: false,
            error: {
              code: "RECOVERY_NOT_FOUND",
              message: "Recovery request not found"
            }
          });
        }

        updateEligibility(recovery);

        if (recovery.status !== "eligible_for_rotation") {
          return sendJson(res, 400, {
            success: false,
            error: {
              code: "RECOVERY_HOLD_NOT_FINISHED",
              message: "Recovery is not eligible for guardian rotation yet"
            }
          });
        }

        const body = await readJson<RotateGuardianBody>(req);
        const nextGuardianAddress =
          body.requestedGuardianAddress?.trim() || recovery.requestedGuardianAddress || recovery.currentGuardianAddress;

        if (!nextGuardianAddress) {
          return sendJson(res, 400, {
            success: false,
            error: {
              code: "MISSING_GUARDIAN_ADDRESS",
              message: "requestedGuardianAddress is required"
            }
          });
        }

        const oldGuardianAddress = recovery.currentGuardianAddress;
        recovery.status = "completed";
        recovery.completedAt = new Date().toISOString();
        recovery.currentGuardianAddress = nextGuardianAddress;
        recovery.requestedGuardianAddress = nextGuardianAddress;

        return sendJson(res, 200, {
          success: true,
          data: {
            ...serializeRecovery(recovery),
            guardianRotation: {
              oldGuardianAddress,
              newGuardianAddress: nextGuardianAddress,
              rotatedAt: recovery.completedAt
            }
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
    clearInterval(eligibilityTimer);
  });

  return server;
}
