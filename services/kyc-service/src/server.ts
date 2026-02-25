import { randomUUID } from "node:crypto";
import { createServer, IncomingMessage, ServerResponse } from "node:http";

import type { KycServiceConfig } from "./config.js";
import { log } from "./logger.js";

type KycStatus = "pending" | "document_uploaded" | "in_review" | "approved" | "rejected";

interface KycRecord {
  id: string;
  userId: string;
  provider: string;
  status: KycStatus;
  cccdNumber?: string;
  frontImageRef?: string;
  backImageRef?: string;
  selfieImageRef?: string;
  livenessScore?: number;
  faceMatchScore?: number;
  rejectionReason?: string;
  createdAt: string;
  updatedAt: string;
}

interface InitiateBody {
  provider?: string;
}

interface UploadBody {
  cccdNumber?: string;
  frontImageRef?: string;
  backImageRef?: string;
}

interface FaceMatchBody {
  selfieImageRef?: string;
  livenessScore?: number;
  faceMatchScore?: number;
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

function extractUserId(req: IncomingMessage): string | null {
  const value = req.headers["x-user-id"];
  if (!value) {
    return null;
  }

  const userId = Array.isArray(value) ? value[0] : value;
  return userId?.trim() || null;
}

function ensureScore(score: number | undefined): number | null {
  if (typeof score !== "number" || Number.isNaN(score)) {
    return null;
  }

  if (score < 0 || score > 1) {
    return null;
  }

  return score;
}

export function createKycServer(config: KycServiceConfig) {
  const kycByUser = new Map<string, KycRecord>();

  const ensureRecord = (userId: string): KycRecord => {
    const existing = kycByUser.get(userId);
    if (existing) {
      return existing;
    }

    const now = new Date().toISOString();
    const next: KycRecord = {
      id: `kyc_${randomUUID().replace(/-/g, "")}`,
      userId,
      provider: config.provider,
      status: "pending",
      createdAt: now,
      updatedAt: now
    };

    kycByUser.set(userId, next);
    return next;
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

      if (!url.pathname.startsWith("/kyc/")) {
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

      if (method === "POST" && url.pathname === "/kyc/initiate") {
        const body = await readJson<InitiateBody>(req);
        const record = ensureRecord(userId);

        if (body.provider?.trim()) {
          record.provider = body.provider.trim().toLowerCase();
        }

        record.status = "pending";
        record.rejectionReason = undefined;
        record.updatedAt = new Date().toISOString();
        kycByUser.set(userId, record);

        return sendJson(res, 200, {
          success: true,
          data: {
            kycId: record.id,
            provider: record.provider,
            status: record.status,
            updatedAt: record.updatedAt
          }
        });
      }

      if (method === "POST" && url.pathname === "/kyc/upload") {
        const body = await readJson<UploadBody>(req);
        const record = ensureRecord(userId);

        if (!body.frontImageRef || !body.backImageRef) {
          return sendJson(res, 400, {
            success: false,
            error: {
              code: "INVALID_KYC_UPLOAD",
              message: "frontImageRef and backImageRef are required"
            }
          });
        }

        record.frontImageRef = body.frontImageRef.trim();
        record.backImageRef = body.backImageRef.trim();
        record.cccdNumber = body.cccdNumber?.trim();
        record.status = "document_uploaded";
        record.updatedAt = new Date().toISOString();

        kycByUser.set(userId, record);

        return sendJson(res, 200, {
          success: true,
          data: {
            kycId: record.id,
            status: record.status,
            updatedAt: record.updatedAt
          }
        });
      }

      if (method === "POST" && url.pathname === "/kyc/face-match") {
        const body = await readJson<FaceMatchBody>(req);
        const record = ensureRecord(userId);

        const livenessScore = ensureScore(body.livenessScore);
        const faceMatchScore = ensureScore(body.faceMatchScore);
        const selfieImageRef = body.selfieImageRef?.trim();

        if (!selfieImageRef || livenessScore === null || faceMatchScore === null) {
          return sendJson(res, 400, {
            success: false,
            error: {
              code: "INVALID_FACE_MATCH_PAYLOAD",
              message: "selfieImageRef, livenessScore, and faceMatchScore are required"
            }
          });
        }

        record.selfieImageRef = selfieImageRef;
        record.livenessScore = livenessScore;
        record.faceMatchScore = faceMatchScore;
        record.updatedAt = new Date().toISOString();

        if (livenessScore < config.minLivenessScore || faceMatchScore < config.minFaceMatchScore) {
          record.status = "rejected";
          record.rejectionReason = "face_match_threshold_not_met";
        } else {
          record.status = "in_review";
          record.rejectionReason = undefined;
        }

        kycByUser.set(userId, record);

        return sendJson(res, 200, {
          success: true,
          data: {
            kycId: record.id,
            status: record.status,
            livenessScore,
            faceMatchScore,
            rejectionReason: record.rejectionReason,
            updatedAt: record.updatedAt
          }
        });
      }

      if (method === "GET" && url.pathname === "/kyc/status") {
        const record = ensureRecord(userId);
        return sendJson(res, 200, {
          success: true,
          data: {
            kycId: record.id,
            provider: record.provider,
            status: record.status,
            cccdNumber: record.cccdNumber,
            livenessScore: record.livenessScore,
            faceMatchScore: record.faceMatchScore,
            rejectionReason: record.rejectionReason,
            updatedAt: record.updatedAt
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
}
