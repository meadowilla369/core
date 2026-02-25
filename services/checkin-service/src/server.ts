import { createHmac, randomUUID } from "node:crypto";
import { createServer, IncomingMessage, ServerResponse } from "node:http";

import type { CheckinConfig } from "./config.js";
import { log } from "./logger.js";

interface QrPayload {
  tokenId?: string;
  eventId?: string;
  timestamp?: number;
  nonce?: string;
  walletAddress?: string;
  signature?: string;
}

interface VerifyRequestBody {
  qrData?: QrPayload;
  gateId?: string;
}

interface CheckinRecord {
  tokenId: string;
  eventId: string;
  gateId: string;
  nonce: string;
  walletAddress: string;
  checkedInAt: string;
}

interface EventStats {
  totalScans: number;
  validScans: number;
  invalidScans: number;
  invalidByReason: Record<string, number>;
  gateSuccessCount: Map<string, number>;
}

type MarkAsUsedJobStatus = "pending" | "retrying" | "processed" | "failed";

interface MarkAsUsedJob {
  id: string;
  tokenId: string;
  eventId: string;
  requestedAt: string;
  status: MarkAsUsedJobStatus;
  attempt: number;
  nextAttemptAtMs: number;
  lastError?: string;
  completedAt?: string;
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

function toIso(ms: number): string {
  return new Date(ms).toISOString();
}

function normalizeTimestampMs(value: number): number {
  if (value > 1_000_000_000_000) {
    return Math.floor(value);
  }

  return Math.floor(value * 1000);
}

function computeSignature(config: CheckinConfig, qrData: Required<Omit<QrPayload, "signature">>): string {
  const payload = `${qrData.tokenId}.${qrData.eventId}.${qrData.timestamp}.${qrData.nonce}.${qrData.walletAddress}`;
  return createHmac("sha256", config.qrSignatureSecret).update(payload, "utf8").digest("hex");
}

function normalizeSignature(signature: string): string {
  const normalized = signature.trim().toLowerCase();
  return normalized.startsWith("0x") ? normalized.slice(2) : normalized;
}

function incrementReason(stat: EventStats, reason: string): void {
  const key = reason.toUpperCase();
  stat.invalidByReason[key] = (stat.invalidByReason[key] ?? 0) + 1;
}

function computeRetryDelayMs(attempt: number): number {
  const multiplier = 2 ** Math.min(5, Math.max(1, attempt) - 1);
  return 500 * multiplier;
}

function serializeGateStats(gateSuccessCount: Map<string, number>): Array<Record<string, unknown>> {
  return Array.from(gateSuccessCount.entries())
    .sort((left, right) => left[0].localeCompare(right[0]))
    .map(([gateId, checkedInCount]) => ({ gateId, checkedInCount }));
}

export function createCheckinServer(config: CheckinConfig) {
  const checkinsByKey = new Map<string, CheckinRecord>();
  const nonceByKey = new Map<string, string>();
  const eventStatsById = new Map<string, EventStats>();
  const markAsUsedQueue = new Map<string, MarkAsUsedJob>();

  const getOrCreateStats = (eventId: string): EventStats => {
    const current = eventStatsById.get(eventId);
    if (current) {
      return current;
    }

    const created: EventStats = {
      totalScans: 0,
      validScans: 0,
      invalidScans: 0,
      invalidByReason: {},
      gateSuccessCount: new Map<string, number>()
    };

    eventStatsById.set(eventId, created);
    return created;
  };

  const enqueueMarkAsUsed = (tokenId: string, eventId: string): string => {
    const jobId = `mku_${randomUUID().replace(/-/g, "")}`;
    const now = Date.now();

    markAsUsedQueue.set(jobId, {
      id: jobId,
      tokenId,
      eventId,
      requestedAt: toIso(now),
      status: "pending",
      attempt: 0,
      nextAttemptAtMs: now
    });

    return jobId;
  };

  const queueTimer = setInterval(() => {
    const now = Date.now();

    for (const job of markAsUsedQueue.values()) {
      if ((job.status !== "pending" && job.status !== "retrying") || job.nextAttemptAtMs > now) {
        continue;
      }

      job.attempt += 1;
      const shouldFail = Math.random() < config.markAsUsedFailureRate;

      if (!shouldFail) {
        job.status = "processed";
        job.completedAt = toIso(now);
        job.lastError = undefined;
        continue;
      }

      const reason = "CHAIN_MARK_AS_USED_FAILED";
      if (job.attempt >= config.markAsUsedMaxRetries) {
        job.status = "failed";
        job.completedAt = toIso(now);
        job.lastError = reason;
        continue;
      }

      job.status = "retrying";
      job.nextAttemptAtMs = now + computeRetryDelayMs(job.attempt);
      job.lastError = reason;
    }
  }, config.markAsUsedPollMs);

  const server = createServer(async (req, res) => {
    try {
      const method = req.method ?? "GET";
      const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);

      if (method === "GET" && url.pathname === "/healthz") {
        let pendingJobs = 0;
        let failedJobs = 0;

        for (const job of markAsUsedQueue.values()) {
          if (job.status === "pending" || job.status === "retrying") {
            pendingJobs += 1;
          }

          if (job.status === "failed") {
            failedJobs += 1;
          }
        }

        return sendJson(res, 200, {
          success: true,
          data: {
            service: config.serviceName,
            status: "ok",
            timestamp: new Date().toISOString(),
            checkedInCount: checkinsByKey.size,
            pendingMarkAsUsedJobs: pendingJobs,
            failedMarkAsUsedJobs: failedJobs
          }
        });
      }

      if (method === "POST" && url.pathname === "/checkin/verify") {
        const body = await readJson<VerifyRequestBody>(req);
        const gateId = body.gateId?.trim() ?? "";
        const qrData = body.qrData;

        if (!gateId || !qrData) {
          return sendJson(res, 400, {
            success: false,
            error: {
              code: "INVALID_CHECKIN_PAYLOAD",
              message: "gateId and qrData are required"
            }
          });
        }

        const tokenId = qrData.tokenId?.trim() ?? "";
        const eventId = qrData.eventId?.trim() ?? "";
        const nonce = qrData.nonce?.trim() ?? "";
        const walletAddress = qrData.walletAddress?.trim() ?? "";
        const signature = qrData.signature?.trim() ?? "";
        const timestamp = qrData.timestamp;

        if (!tokenId || !eventId || !nonce || !walletAddress || !signature || typeof timestamp !== "number") {
          return sendJson(res, 400, {
            success: false,
            error: {
              code: "INVALID_QR_PAYLOAD",
              message: "QR payload is incomplete"
            }
          });
        }

        const stats = getOrCreateStats(eventId);
        stats.totalScans += 1;

        const timestampMs = normalizeTimestampMs(timestamp);
        const nowMs = Date.now();
        const ageMs = nowMs - timestampMs;

        if (ageMs > config.maxQrAgeSec * 1000 || ageMs < -config.maxClockSkewSec * 1000) {
          stats.invalidScans += 1;
          incrementReason(stats, "QR_EXPIRED");

          return sendJson(res, 200, {
            success: true,
            data: {
              valid: false,
              reason: "QR_EXPIRED",
              message: "QR code expired or timestamp invalid"
            }
          });
        }

        const expectedSignature = computeSignature(config, {
          tokenId,
          eventId,
          timestamp,
          nonce,
          walletAddress
        });

        if (normalizeSignature(signature) !== normalizeSignature(expectedSignature)) {
          stats.invalidScans += 1;
          incrementReason(stats, "SIGNATURE_INVALID");

          return sendJson(res, 200, {
            success: true,
            data: {
              valid: false,
              reason: "SIGNATURE_INVALID",
              message: "QR signature is invalid"
            }
          });
        }

        const nonceKey = `${eventId}:${nonce}`;
        if (nonceByKey.has(nonceKey)) {
          stats.invalidScans += 1;
          incrementReason(stats, "NONCE_REPLAYED");

          return sendJson(res, 200, {
            success: true,
            data: {
              valid: false,
              reason: "NONCE_REPLAYED",
              message: "QR nonce already used"
            }
          });
        }

        const checkinKey = `${eventId}:${tokenId}`;
        const existing = checkinsByKey.get(checkinKey);
        if (existing) {
          stats.invalidScans += 1;
          incrementReason(stats, "ALREADY_USED");

          return sendJson(res, 200, {
            success: true,
            data: {
              valid: false,
              reason: "ALREADY_USED",
              message: `This ticket was checked in at ${existing.gateId} on ${existing.checkedInAt}`
            }
          });
        }

        const checkedInAt = new Date().toISOString();
        const record: CheckinRecord = {
          tokenId,
          eventId,
          gateId,
          nonce,
          walletAddress,
          checkedInAt
        };

        // Single write to key ensures first-scan-wins behavior in this in-memory skeleton.
        checkinsByKey.set(checkinKey, record);
        nonceByKey.set(nonceKey, checkinKey);

        stats.validScans += 1;
        const currentCount = stats.gateSuccessCount.get(gateId) ?? 0;
        stats.gateSuccessCount.set(gateId, currentCount + 1);

        const markAsUsedJobId = enqueueMarkAsUsed(tokenId, eventId);

        return sendJson(res, 200, {
          success: true,
          data: {
            valid: true,
            ticketId: tokenId,
            eventId,
            gateId,
            checkedInAt,
            markAsUsedJobId
          }
        });
      }

      const statsMatch = /^\/checkin\/events\/([^/]+)\/stats$/.exec(url.pathname);
      if (method === "GET" && statsMatch) {
        const eventId = statsMatch[1];
        const stats = eventStatsById.get(eventId);

        return sendJson(res, 200, {
          success: true,
          data: {
            eventId,
            totalScans: stats?.totalScans ?? 0,
            validScans: stats?.validScans ?? 0,
            invalidScans: stats?.invalidScans ?? 0,
            invalidByReason: stats?.invalidByReason ?? {},
            gates: stats ? serializeGateStats(stats.gateSuccessCount) : []
          }
        });
      }

      const gatesMatch = /^\/checkin\/events\/([^/]+)\/gates$/.exec(url.pathname);
      if (method === "GET" && gatesMatch) {
        const eventId = gatesMatch[1];
        const stats = eventStatsById.get(eventId);

        return sendJson(res, 200, {
          success: true,
          data: {
            eventId,
            gates: stats ? serializeGateStats(stats.gateSuccessCount) : []
          }
        });
      }

      if (method === "GET" && url.pathname === "/checkin/mark-as-used/jobs") {
        const jobs = Array.from(markAsUsedQueue.values())
          .sort((left, right) => right.requestedAt.localeCompare(left.requestedAt))
          .map((job) => ({
            jobId: job.id,
            tokenId: job.tokenId,
            eventId: job.eventId,
            status: job.status,
            attempt: job.attempt,
            nextAttemptAt: toIso(job.nextAttemptAtMs),
            requestedAt: job.requestedAt,
            completedAt: job.completedAt,
            lastError: job.lastError
          }));

        return sendJson(res, 200, {
          success: true,
          data: jobs
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
    clearInterval(queueTimer);
  });

  return server;
}
