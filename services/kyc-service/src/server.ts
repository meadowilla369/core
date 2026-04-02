import { randomUUID } from "node:crypto";
import { createServer, IncomingMessage, ServerResponse } from "node:http";

import {
  CreateBucketCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3ServiceException
} from "@aws-sdk/client-s3";
import {
  createMinioS3Client,
  createPostgresPool,
  queryOne,
  withPostgresTransaction
} from "@ticket-platform/local-infra";
import type { Pool } from "pg";

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
  documentArchiveObjectKey?: string;
  faceMatchArchiveObjectKey?: string;
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

interface ProviderStatusBody {
  provider?: string;
  status?: string;
}

interface KycRow {
  id: string;
  user_id: string;
  provider: string;
  status: KycStatus;
  cccd_number: string | null;
  front_image_ref: string | null;
  back_image_ref: string | null;
  selfie_image_ref: string | null;
  liveness_score: number | string | null;
  face_match_score: number | string | null;
  rejection_reason: string | null;
  document_archive_object_key: string | null;
  face_match_archive_object_key: string | null;
  created_at: string | Date;
  updated_at: string | Date;
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

function extractSingleHeader(req: IncomingMessage, headerName: string): string | null {
  const value = req.headers[headerName.toLowerCase()];
  if (!value) {
    return null;
  }

  const normalized = Array.isArray(value) ? value[0] : value;
  const trimmed = normalized?.trim();
  return trimmed ? trimmed : null;
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

function toIso(value: string | Date): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function mapRecord(row: KycRow): KycRecord {
  return {
    id: row.id,
    userId: row.user_id,
    provider: row.provider,
    status: row.status,
    cccdNumber: row.cccd_number ?? undefined,
    frontImageRef: row.front_image_ref ?? undefined,
    backImageRef: row.back_image_ref ?? undefined,
    selfieImageRef: row.selfie_image_ref ?? undefined,
    livenessScore: row.liveness_score === null ? undefined : Number(row.liveness_score),
    faceMatchScore: row.face_match_score === null ? undefined : Number(row.face_match_score),
    rejectionReason: row.rejection_reason ?? undefined,
    documentArchiveObjectKey: row.document_archive_object_key ?? undefined,
    faceMatchArchiveObjectKey: row.face_match_archive_object_key ?? undefined,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at)
  };
}

async function ensureSchema(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS kyc_records (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL UNIQUE,
      provider TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('pending', 'document_uploaded', 'in_review', 'approved', 'rejected')),
      cccd_number TEXT,
      front_image_ref TEXT,
      back_image_ref TEXT,
      selfie_image_ref TEXT,
      liveness_score NUMERIC,
      face_match_score NUMERIC,
      rejection_reason TEXT,
      document_archive_object_key TEXT,
      face_match_archive_object_key TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS kyc_provider_status (
      provider TEXT PRIMARY KEY,
      status TEXT NOT NULL CHECK (status IN ('up', 'down')),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}

async function ensureBucket(
  config: KycServiceConfig
): Promise<ReturnType<typeof createMinioS3Client>> {
  const s3 = createMinioS3Client(process.env);
  try {
    await s3.send(new HeadBucketCommand({ Bucket: config.archiveBucket }));
  } catch (error) {
    if (
      error instanceof S3ServiceException &&
      error.$metadata.httpStatusCode !== undefined &&
      error.$metadata.httpStatusCode !== 404
    ) {
      throw error;
    }

    await s3.send(new CreateBucketCommand({ Bucket: config.archiveBucket }));
  }

  return s3;
}

async function getProviderStatus(pool: Pool, provider: string): Promise<"up" | "down"> {
  const row = await queryOne<{ status: "up" | "down" }>(
    pool,
    `SELECT status FROM kyc_provider_status WHERE provider = $1`,
    [provider]
  );
  return row?.status ?? "up";
}

async function canUseProvider(pool: Pool, provider: string): Promise<boolean> {
  return (await getProviderStatus(pool, provider)) === "up";
}

async function resolveProvider(
  pool: Pool,
  config: KycServiceConfig,
  preferredProvider: string
): Promise<{ provider: string; fallbackUsed: boolean } | null> {
  if (await canUseProvider(pool, preferredProvider)) {
    return { provider: preferredProvider, fallbackUsed: false };
  }

  if (
    preferredProvider !== config.fallbackProvider &&
    (await canUseProvider(pool, config.fallbackProvider))
  ) {
    return { provider: config.fallbackProvider, fallbackUsed: true };
  }

  if (await canUseProvider(pool, config.provider)) {
    return { provider: config.provider, fallbackUsed: preferredProvider !== config.provider };
  }

  return null;
}

async function ensureRecord(
  pool: Pool,
  config: KycServiceConfig,
  userId: string
): Promise<KycRecord> {
  const existing = await queryOne<KycRow>(pool, `SELECT * FROM kyc_records WHERE user_id = $1`, [
    userId
  ]);
  if (existing) {
    return mapRecord(existing);
  }

  const now = new Date().toISOString();
  const activeProvider = await resolveProvider(pool, config, config.provider);
  const id = `kyc_${randomUUID().replace(/-/g, "")}`;

  await pool.query(
    `
      INSERT INTO kyc_records (id, user_id, provider, status, created_at, updated_at)
      VALUES ($1, $2, $3, 'pending', $4::timestamptz, $4::timestamptz)
    `,
    [id, userId, activeProvider?.provider ?? config.provider, now]
  );

  const created = await queryOne<KycRow>(pool, `SELECT * FROM kyc_records WHERE user_id = $1`, [
    userId
  ]);
  return mapRecord(created as KycRow);
}

async function archiveJson(
  config: KycServiceConfig,
  s3: Awaited<ReturnType<typeof ensureBucket>>,
  key: string,
  payload: Record<string, unknown>
): Promise<string> {
  await s3.send(
    new PutObjectCommand({
      Bucket: config.archiveBucket,
      Key: key,
      ContentType: "application/json",
      Body: JSON.stringify(payload, null, 2)
    })
  );

  return key;
}

export async function createKycServer(config: KycServiceConfig) {
  const pool = createPostgresPool(process.env);
  await ensureSchema(pool);
  const s3 = await ensureBucket(config);

  await pool.query(
    `
      INSERT INTO kyc_provider_status (provider, status)
      VALUES ($1, 'up'), ($2, 'up')
      ON CONFLICT (provider) DO NOTHING
    `,
    [config.provider, config.fallbackProvider]
  );

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
            storage: {
              primary: "postgres",
              objects: "minio"
            },
            archiveBucket: config.archiveBucket,
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

      if (method === "POST" && url.pathname === "/kyc/providers/status") {
        const internalApiKey = extractSingleHeader(req, "x-internal-api-key");
        if (internalApiKey !== config.internalApiKey) {
          return sendJson(res, 401, {
            success: false,
            error: {
              code: "UNAUTHORIZED_INTERNAL",
              message: "Invalid internal API key"
            }
          });
        }

        const body = await readJson<ProviderStatusBody>(req);
        const provider = body.provider?.trim().toLowerCase() ?? "";
        const status = body.status?.trim().toLowerCase() ?? "";

        if (!provider || (status !== "up" && status !== "down")) {
          return sendJson(res, 400, {
            success: false,
            error: {
              code: "INVALID_PROVIDER_STATUS_PAYLOAD",
              message: "provider and status(up/down) are required"
            }
          });
        }

        await pool.query(
          `
            INSERT INTO kyc_provider_status (provider, status, updated_at)
            VALUES ($1, $2, NOW())
            ON CONFLICT (provider) DO UPDATE SET status = EXCLUDED.status, updated_at = NOW()
          `,
          [provider, status]
        );

        const providers = await pool.query<{ provider: string; status: string }>(
          `SELECT provider, status FROM kyc_provider_status ORDER BY provider ASC`
        );

        return sendJson(res, 200, {
          success: true,
          data: {
            provider,
            status,
            providers: providers.rows
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
        const record = await ensureRecord(pool, config, userId);
        const requestedProvider = body.provider?.trim().toLowerCase() || config.provider;
        const resolvedProvider = await resolveProvider(pool, config, requestedProvider);
        if (!resolvedProvider) {
          return sendJson(res, 503, {
            success: false,
            error: {
              code: "KYC_PROVIDER_UNAVAILABLE",
              message: "No KYC provider is currently available"
            }
          });
        }

        await pool.query(
          `
            UPDATE kyc_records
            SET provider = $2, status = 'pending', rejection_reason = NULL, updated_at = NOW()
            WHERE user_id = $1
          `,
          [userId, resolvedProvider.provider]
        );

        return sendJson(res, 200, {
          success: true,
          data: {
            kycId: record.id,
            provider: resolvedProvider.provider,
            fallbackUsed: resolvedProvider.fallbackUsed,
            status: "pending",
            updatedAt: new Date().toISOString()
          }
        });
      }

      if (method === "POST" && url.pathname === "/kyc/upload") {
        const body = await readJson<UploadBody>(req);
        const record = await ensureRecord(pool, config, userId);
        const resolvedProvider = await resolveProvider(pool, config, record.provider);
        if (!resolvedProvider) {
          return sendJson(res, 503, {
            success: false,
            error: {
              code: "KYC_PROVIDER_UNAVAILABLE",
              message: "No KYC provider is currently available"
            }
          });
        }

        if (!body.frontImageRef || !body.backImageRef) {
          return sendJson(res, 400, {
            success: false,
            error: {
              code: "INVALID_KYC_UPLOAD",
              message: "frontImageRef and backImageRef are required"
            }
          });
        }

        const objectKey = await archiveJson(
          config,
          s3,
          `${userId}/${record.id}/document-upload-${Date.now()}.json`,
          {
            type: "document_upload",
            userId,
            kycId: record.id,
            provider: resolvedProvider.provider,
            cccdNumber: body.cccdNumber?.trim() || null,
            frontImageRef: body.frontImageRef.trim(),
            backImageRef: body.backImageRef.trim(),
            archivedAt: new Date().toISOString()
          }
        );

        await pool.query(
          `
            UPDATE kyc_records
            SET provider = $2,
                cccd_number = $3,
                front_image_ref = $4,
                back_image_ref = $5,
                status = 'document_uploaded',
                document_archive_object_key = $6,
                updated_at = NOW()
            WHERE user_id = $1
          `,
          [
            userId,
            resolvedProvider.provider,
            body.cccdNumber?.trim() || null,
            body.frontImageRef.trim(),
            body.backImageRef.trim(),
            objectKey
          ]
        );

        const updated = await ensureRecord(pool, config, userId);
        return sendJson(res, 200, {
          success: true,
          data: {
            kycId: updated.id,
            provider: updated.provider,
            fallbackUsed: resolvedProvider.fallbackUsed,
            status: updated.status,
            archiveObjectKey: updated.documentArchiveObjectKey,
            updatedAt: updated.updatedAt
          }
        });
      }

      if (method === "POST" && url.pathname === "/kyc/face-match") {
        const body = await readJson<FaceMatchBody>(req);
        const record = await ensureRecord(pool, config, userId);
        const resolvedProvider = await resolveProvider(pool, config, record.provider);
        if (!resolvedProvider) {
          return sendJson(res, 503, {
            success: false,
            error: {
              code: "KYC_PROVIDER_UNAVAILABLE",
              message: "No KYC provider is currently available"
            }
          });
        }

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

        const nextStatus =
          livenessScore < config.minLivenessScore || faceMatchScore < config.minFaceMatchScore
            ? "rejected"
            : "in_review";
        const rejectionReason = nextStatus === "rejected" ? "face_match_threshold_not_met" : null;

        const objectKey = await archiveJson(
          config,
          s3,
          `${userId}/${record.id}/face-match-${Date.now()}.json`,
          {
            type: "face_match",
            userId,
            kycId: record.id,
            provider: resolvedProvider.provider,
            selfieImageRef,
            livenessScore,
            faceMatchScore,
            archivedAt: new Date().toISOString(),
            status: nextStatus,
            rejectionReason
          }
        );

        await pool.query(
          `
            UPDATE kyc_records
            SET provider = $2,
                selfie_image_ref = $3,
                liveness_score = $4,
                face_match_score = $5,
                status = $6,
                rejection_reason = $7,
                face_match_archive_object_key = $8,
                updated_at = NOW()
            WHERE user_id = $1
          `,
          [
            userId,
            resolvedProvider.provider,
            selfieImageRef,
            livenessScore,
            faceMatchScore,
            nextStatus,
            rejectionReason,
            objectKey
          ]
        );

        const updated = await ensureRecord(pool, config, userId);
        return sendJson(res, 200, {
          success: true,
          data: {
            kycId: updated.id,
            provider: updated.provider,
            fallbackUsed: resolvedProvider.fallbackUsed,
            status: updated.status,
            livenessScore,
            faceMatchScore,
            rejectionReason: updated.rejectionReason,
            archiveObjectKey: updated.faceMatchArchiveObjectKey,
            updatedAt: updated.updatedAt
          }
        });
      }

      if (method === "GET" && url.pathname === "/kyc/status") {
        const record = await ensureRecord(pool, config, userId);
        return sendJson(res, 200, {
          success: true,
          data: {
            kycId: record.id,
            provider: record.provider,
            providerStatus: await getProviderStatus(pool, record.provider),
            status: record.status,
            cccdNumber: record.cccdNumber,
            livenessScore: record.livenessScore,
            faceMatchScore: record.faceMatchScore,
            rejectionReason: record.rejectionReason,
            documentArchiveObjectKey: record.documentArchiveObjectKey,
            faceMatchArchiveObjectKey: record.faceMatchArchiveObjectKey,
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
  }).on("close", () => {
    void pool.end();
  });
}
