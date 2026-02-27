import { randomUUID } from "node:crypto";
import { createServer, IncomingMessage, ServerResponse } from "node:http";

import type { WorkerMintConfig } from "./config.js";
import { log } from "./logger.js";

type MintJobStatus = "queued" | "processing" | "retrying" | "minted" | "failed";

interface MintRequestBody {
  paymentId?: string;
  reservationId?: string;
  userId?: string;
  walletAddress?: string;
  eventId?: string;
  ticketTypeId?: string;
  quantity?: number;
  forceFailures?: number;
}

interface MintRunBody {
  limit?: number;
}

interface MintJob {
  id: string;
  paymentId: string;
  reservationId: string;
  userId: string;
  walletAddress: string;
  eventId: string;
  ticketTypeId: string;
  quantity: number;
  status: MintJobStatus;
  attempts: number;
  nextRunAtMs: number;
  forceFailuresRemaining: number;
  lastError?: string;
  mintedTokenIds: string[];
  createdAt: string;
  updatedAt: string;
  mintedAt?: string;
}

interface SupportQueueItem {
  jobId: string;
  paymentId: string;
  reason: string;
  failedAt: string;
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

  const rawBody = Buffer.concat(chunks).toString("utf-8").trim();
  if (!rawBody) {
    return {} as T;
  }

  return JSON.parse(rawBody) as T;
}

function toIso(ms: number): string {
  return new Date(ms).toISOString();
}

function computeRetryDelayMs(config: WorkerMintConfig, attempt: number): number {
  const multiplier = 2 ** Math.min(5, Math.max(1, attempt) - 1);
  return config.retryBaseDelaySec * 1000 * multiplier;
}

function sanitizeLimit(limit: number | undefined, fallback: number, maxBatchSize: number): number {
  if (!limit || !Number.isFinite(limit)) {
    return fallback;
  }

  const normalized = Math.floor(limit);
  if (normalized <= 0) {
    return fallback;
  }

  return Math.min(maxBatchSize, normalized);
}

function serializeJob(job: MintJob): Record<string, unknown> {
  return {
    jobId: job.id,
    paymentId: job.paymentId,
    reservationId: job.reservationId,
    userId: job.userId,
    walletAddress: job.walletAddress,
    eventId: job.eventId,
    ticketTypeId: job.ticketTypeId,
    quantity: job.quantity,
    status: job.status,
    attempts: job.attempts,
    nextRunAt: toIso(job.nextRunAtMs),
    lastError: job.lastError,
    mintedTokenIds: job.mintedTokenIds,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    mintedAt: job.mintedAt
  };
}

export function createWorkerMintServer(config: WorkerMintConfig) {
  const jobsById = new Map<string, MintJob>();
  const jobIdByPaymentId = new Map<string, string>();
  const supportQueue: SupportQueueItem[] = [];
  let nextTokenNumericId = config.tokenIdSeed;

  const processJob = (job: MintJob): { status: "minted" | "retrying" | "failed"; reason?: string } => {
    const now = Date.now();
    const nowIso = toIso(now);

    job.status = "processing";
    job.attempts += 1;
    job.updatedAt = nowIso;

    if (job.forceFailuresRemaining > 0) {
      job.forceFailuresRemaining -= 1;
      const reason = "SIMULATED_RPC_FAILURE";

      if (job.attempts >= config.maxAttempts) {
        job.status = "failed";
        job.lastError = reason;
        job.nextRunAtMs = now;
        job.updatedAt = nowIso;
        supportQueue.push({
          jobId: job.id,
          paymentId: job.paymentId,
          reason,
          failedAt: nowIso
        });
        return { status: "failed", reason };
      }

      job.status = "retrying";
      job.lastError = reason;
      job.nextRunAtMs = now + computeRetryDelayMs(config, job.attempts);
      job.updatedAt = nowIso;
      return { status: "retrying", reason };
    }

    const mintedTokenIds: string[] = [];
    for (let index = 0; index < job.quantity; index += 1) {
      mintedTokenIds.push(String(nextTokenNumericId));
      nextTokenNumericId += 1;
    }

    job.status = "minted";
    job.lastError = undefined;
    job.nextRunAtMs = now;
    job.mintedTokenIds = mintedTokenIds;
    job.mintedAt = nowIso;
    job.updatedAt = nowIso;

    log(config.serviceName, "info", "Mint job completed", {
      jobId: job.id,
      paymentId: job.paymentId,
      tokenCount: mintedTokenIds.length,
      mintedTokenIds
    });

    return { status: "minted" };
  };

  return createServer(async (req, res) => {
    try {
      const method = req.method ?? "GET";
      const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);

      if (method === "GET" && url.pathname === "/healthz") {
        let queuedCount = 0;
        let retryingCount = 0;
        let mintedCount = 0;
        let failedCount = 0;

        for (const job of jobsById.values()) {
          if (job.status === "queued") {
            queuedCount += 1;
          }

          if (job.status === "retrying") {
            retryingCount += 1;
          }

          if (job.status === "minted") {
            mintedCount += 1;
          }

          if (job.status === "failed") {
            failedCount += 1;
          }
        }

        return sendJson(res, 200, {
          success: true,
          data: {
            service: config.serviceName,
            status: "ok",
            timestamp: new Date().toISOString(),
            chainId: config.chainId,
            baseRpcUrl: config.baseRpcUrl,
            ticketNftAddress: config.ticketNftAddress,
            queue: {
              queued: queuedCount,
              retrying: retryingCount,
              minted: mintedCount,
              failed: failedCount,
              supportQueue: supportQueue.length
            }
          }
        });
      }

      if (method === "POST" && url.pathname === "/mint/jobs") {
        const body = await readJson<MintRequestBody>(req);

        const paymentId = body.paymentId?.trim() ?? "";
        const reservationId = body.reservationId?.trim() ?? "";
        const userId = body.userId?.trim() ?? "";
        const walletAddress = body.walletAddress?.trim() ?? "";
        const eventId = body.eventId?.trim() ?? "";
        const ticketTypeId = body.ticketTypeId?.trim() ?? "";
        const quantity = body.quantity;

        if (!paymentId || !reservationId || !userId || !walletAddress || !eventId || !ticketTypeId || !quantity) {
          return sendJson(res, 400, {
            success: false,
            error: {
              code: "INVALID_MINT_JOB_PAYLOAD",
              message:
                "paymentId, reservationId, userId, walletAddress, eventId, ticketTypeId, quantity are required"
            }
          });
        }

        if (!Number.isInteger(quantity) || quantity < 1 || quantity > 4) {
          return sendJson(res, 400, {
            success: false,
            error: {
              code: "INVALID_QUANTITY",
              message: "quantity must be integer in range 1..4"
            }
          });
        }

        const existingJobId = jobIdByPaymentId.get(paymentId);
        if (existingJobId) {
          const existingJob = jobsById.get(existingJobId);
          if (existingJob) {
            return sendJson(res, 200, {
              success: true,
              data: {
                ...serializeJob(existingJob),
                deduplicated: true
              }
            });
          }
        }

        const now = Date.now();
        const nowIso = toIso(now);
        const job: MintJob = {
          id: `mint_${randomUUID().replace(/-/g, "")}`,
          paymentId,
          reservationId,
          userId,
          walletAddress,
          eventId,
          ticketTypeId,
          quantity,
          status: "queued",
          attempts: 0,
          nextRunAtMs: now,
          forceFailuresRemaining: Math.max(0, Math.floor(body.forceFailures ?? 0)),
          mintedTokenIds: [],
          createdAt: nowIso,
          updatedAt: nowIso
        };

        jobsById.set(job.id, job);
        jobIdByPaymentId.set(paymentId, job.id);

        return sendJson(res, 200, {
          success: true,
          data: serializeJob(job)
        });
      }

      if (method === "GET" && url.pathname === "/mint/jobs") {
        const statusFilter = url.searchParams.get("status")?.trim().toLowerCase();
        const jobs = Array.from(jobsById.values())
          .filter((job) => {
            if (!statusFilter) {
              return true;
            }

            return job.status === statusFilter;
          })
          .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
          .map((job) => serializeJob(job));

        return sendJson(res, 200, {
          success: true,
          data: jobs
        });
      }

      const mintJobMatch = /^\/mint\/jobs\/([^/]+)$/.exec(url.pathname);
      if (method === "GET" && mintJobMatch) {
        const job = jobsById.get(mintJobMatch[1]);
        if (!job) {
          return sendJson(res, 404, {
            success: false,
            error: {
              code: "MINT_JOB_NOT_FOUND",
              message: "Mint job not found"
            }
          });
        }

        return sendJson(res, 200, {
          success: true,
          data: serializeJob(job)
        });
      }

      if (method === "GET" && url.pathname === "/mint/support-queue") {
        return sendJson(res, 200, {
          success: true,
          data: supportQueue
        });
      }

      if (method === "POST" && url.pathname === "/mint/run") {
        const body = await readJson<MintRunBody>(req);
        const limit = sanitizeLimit(body.limit, config.maxBatchSize, config.maxBatchSize);
        const now = Date.now();

        const candidates = Array.from(jobsById.values())
          .filter((job) => (job.status === "queued" || job.status === "retrying") && job.nextRunAtMs <= now)
          .sort((left, right) => left.nextRunAtMs - right.nextRunAtMs)
          .slice(0, limit);

        let mintedCount = 0;
        let retryingCount = 0;
        let failedCount = 0;

        for (const job of candidates) {
          const result = processJob(job);

          if (result.status === "minted") {
            mintedCount += 1;
          }

          if (result.status === "retrying") {
            retryingCount += 1;
          }

          if (result.status === "failed") {
            failedCount += 1;
          }
        }

        return sendJson(res, 200, {
          success: true,
          data: {
            processed: candidates.length,
            minted: mintedCount,
            retrying: retryingCount,
            failed: failedCount,
            remainingQueue: Array.from(jobsById.values()).filter(
              (job) => job.status === "queued" || job.status === "retrying"
            ).length
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
