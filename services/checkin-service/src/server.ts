import { createHmac, randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { createServer, IncomingMessage, ServerResponse } from "node:http";

import { createPostgresPool, queryOne, queryMany } from "@ticket-platform/local-infra";
import type { Pool } from "pg";

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

// TicketLedger uses markUsedBatch(uint256[]) with CHECKIN_ROLE
const MARK_AS_USED_SIG = "markUsedBatch(uint256[])";

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

function computeSignature(
  config: CheckinConfig,
  qrData: Required<Omit<QrPayload, "signature">>
): string {
  const payload = `${qrData.tokenId}.${qrData.eventId}.${qrData.timestamp}.${qrData.nonce}.${qrData.walletAddress}`;
  return createHmac("sha256", config.qrSignatureSecret).update(payload, "utf8").digest("hex");
}

function normalizeSignature(signature: string): string {
  const normalized = signature.trim().toLowerCase();
  return normalized.startsWith("0x") ? normalized.slice(2) : normalized;
}

function computeRetryDelayMs(attempt: number): number {
  const multiplier = 2 ** Math.min(5, Math.max(1, attempt) - 1);
  return 500 * multiplier;
}

async function ensureSchema(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS gates (
      id         TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      event_id   TEXT NOT NULL,
      name       TEXT NOT NULL,
      location   TEXT,
      status     TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS check_ins (
      id         TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      token_id   TEXT NOT NULL,
      event_id   TEXT NOT NULL,
      gate_id    TEXT REFERENCES gates(id),
      qr_nonce   TEXT NOT NULL,
      scanned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (event_id, token_id),
      UNIQUE (event_id, qr_nonce)
    );
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_check_ins_event_scan
    ON check_ins(event_id, scanned_at DESC);
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_check_ins_gate_scan
    ON check_ins(gate_id, scanned_at DESC);
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS scan_rejections (
      id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      event_id    TEXT NOT NULL,
      gate_id     TEXT,
      reason      TEXT NOT NULL,
      rejected_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_scan_rejections_event
    ON scan_rejections(event_id, rejected_at DESC);
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_scan_rejections_gate
    ON scan_rejections(gate_id, rejected_at DESC);
  `);
}

export async function createCheckinServer(config: CheckinConfig) {
  const pool: Pool = createPostgresPool(process.env);
  await ensureSchema(pool);

  const markAsUsedQueue = new Map<string, MarkAsUsedJob>();

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

  const callMarkAsUsedOnChain = (tokenId: string): { txHash: string } => {
    if (!config.rpcUrl || !config.ticketNftAddress || !config.operatorPrivateKey) {
      throw new Error("CHAIN_NOT_CONFIGURED");
    }

    const result = spawnSync(
      "cast",
      [
        "send",
        "--async",
        "--rpc-url",
        config.rpcUrl,
        "--private-key",
        config.operatorPrivateKey,
        config.ticketNftAddress,
        MARK_AS_USED_SIG,
        `[${tokenId}]`
      ],
      { encoding: "utf8" }
    );

    if (result.status !== 0) {
      const details = [result.stdout, result.stderr]
        .filter((s) => typeof s === "string" && s.trim().length > 0)
        .join("\n")
        .trim();
      throw new Error(`cast send failed: ${details}`);
    }

    const match = result.stdout.match(/0x[a-fA-F0-9]{64}/);
    if (!match) {
      throw new Error(`Could not parse tx hash from cast output: ${result.stdout}`);
    }

    return { txHash: match[0].toLowerCase() };
  };

  const queueTimer = setInterval(() => {
    const now = Date.now();

    for (const job of markAsUsedQueue.values()) {
      if ((job.status !== "pending" && job.status !== "retrying") || job.nextAttemptAtMs > now) {
        continue;
      }

      job.attempt += 1;

      try {
        callMarkAsUsedOnChain(job.tokenId);
        job.status = "processed";
        job.completedAt = toIso(now);
        job.lastError = undefined;
      } catch (err) {
        const reason = err instanceof Error ? err.message : "CHAIN_MARK_AS_USED_FAILED";
        if (job.attempt >= config.markAsUsedMaxRetries) {
          job.status = "failed";
          job.completedAt = toIso(now);
          job.lastError = reason;
        } else {
          job.status = "retrying";
          job.nextAttemptAtMs = now + computeRetryDelayMs(job.attempt);
          job.lastError = reason;
        }
      }
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
          if (job.status === "pending" || job.status === "retrying") pendingJobs += 1;
          if (job.status === "failed") failedJobs += 1;
        }

        const countRow = await queryOne<{ total: string }>(
          pool,
          `SELECT COUNT(*)::text AS total FROM check_ins`
        );

        return sendJson(res, 200, {
          success: true,
          data: {
            service: config.serviceName,
            status: "ok",
            timestamp: new Date().toISOString(),
            checkedInCount: Number(countRow?.total ?? 0),
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
            error: { code: "INVALID_CHECKIN_PAYLOAD", message: "gateId and qrData are required" }
          });
        }

        const tokenId = qrData.tokenId?.trim() ?? "";
        const eventId = qrData.eventId?.trim() ?? "";
        const nonce = qrData.nonce?.trim() ?? "";
        const walletAddress = qrData.walletAddress?.trim() ?? "";
        const signature = qrData.signature?.trim() ?? "";
        const timestamp = qrData.timestamp;

        if (
          !tokenId ||
          !eventId ||
          !nonce ||
          !walletAddress ||
          !signature ||
          typeof timestamp !== "number"
        ) {
          return sendJson(res, 400, {
            success: false,
            error: { code: "INVALID_QR_PAYLOAD", message: "QR payload is incomplete" }
          });
        }

        const timestampMs = normalizeTimestampMs(timestamp);
        const nowMs = Date.now();
        const ageMs = nowMs - timestampMs;

        if (ageMs > config.maxQrAgeSec * 1000 || ageMs < -config.maxClockSkewSec * 1000) {
          void pool.query(
            `INSERT INTO scan_rejections (event_id, gate_id, reason) VALUES ($1, $2, 'QR_EXPIRED')`,
            [eventId, gateId || null]
          );
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
          void pool.query(
            `INSERT INTO scan_rejections (event_id, gate_id, reason) VALUES ($1, $2, 'SIGNATURE_INVALID')`,
            [eventId, gateId || null]
          );
          return sendJson(res, 200, {
            success: true,
            data: { valid: false, reason: "SIGNATURE_INVALID", message: "QR signature is invalid" }
          });
        }

        const gate = await queryOne<{ id: string; status: string }>(
          pool,
          `SELECT id, status FROM gates WHERE id = $1 AND event_id = $2`,
          [gateId, eventId]
        );

        if (!gate) {
          void pool.query(
            `INSERT INTO scan_rejections (event_id, gate_id, reason) VALUES ($1, $2, 'GATE_NOT_FOUND')`,
            [eventId, gateId || null]
          );
          return sendJson(res, 200, {
            success: true,
            data: {
              valid: false,
              reason: "GATE_NOT_FOUND",
              message: "Check-in gate does not exist for this event"
            }
          });
        }

        if (gate.status !== "active") {
          void pool.query(
            `INSERT INTO scan_rejections (event_id, gate_id, reason) VALUES ($1, $2, 'GATE_INACTIVE')`,
            [eventId, gateId || null]
          );
          return sendJson(res, 200, {
            success: true,
            data: {
              valid: false,
              reason: "GATE_INACTIVE",
              message: "Check-in gate is not active"
            }
          });
        }

        // Nonce replay check via DB unique constraint (event_id, qr_nonce)
        // Duplicate token check via DB unique constraint (event_id, token_id)
        // Both are enforced atomically by the INSERT below.
        const client = await pool.connect();
        try {
          await client.query("BEGIN");

          const insertResult = await client.query(
            `
              INSERT INTO check_ins (token_id, event_id, gate_id, qr_nonce)
              VALUES ($1, $2, $3, $4)
              ON CONFLICT DO NOTHING
            `,
            [tokenId, eventId, gateId || null, nonce]
          );

          if (insertResult.rowCount === 0) {
            await client.query("ROLLBACK");

            // Distinguish nonce replay from already-used
            const nonceExists = await queryOne<{ exists: boolean }>(
              pool,
              `SELECT EXISTS(SELECT 1 FROM check_ins WHERE event_id=$1 AND qr_nonce=$2) AS exists`,
              [eventId, nonce]
            );

            if (nonceExists?.exists) {
              void pool.query(
                `INSERT INTO scan_rejections (event_id, gate_id, reason) VALUES ($1, $2, 'NONCE_REPLAYED')`,
                [eventId, gateId || null]
              );
              return sendJson(res, 200, {
                success: true,
                data: { valid: false, reason: "NONCE_REPLAYED", message: "QR nonce already used" }
              });
            }

            const existing = await queryOne<{ gate_id: string | null; scanned_at: string }>(
              pool,
              `SELECT gate_id, scanned_at FROM check_ins WHERE event_id=$1 AND token_id=$2`,
              [eventId, tokenId]
            );

            void pool.query(
              `INSERT INTO scan_rejections (event_id, gate_id, reason) VALUES ($1, $2, 'ALREADY_USED')`,
              [eventId, gateId || null]
            );
            return sendJson(res, 200, {
              success: true,
              data: {
                valid: false,
                reason: "ALREADY_USED",
                message: `This ticket was checked in at gate ${existing?.gate_id ?? "unknown"} on ${existing?.scanned_at ?? "unknown"}`
              }
            });
          }

          await client.query("COMMIT");
        } catch (err) {
          await client.query("ROLLBACK");
          throw err;
        } finally {
          client.release();
        }

        const checkedInAt = new Date().toISOString();
        const markAsUsedJobId = enqueueMarkAsUsed(tokenId, eventId);

        return sendJson(res, 200, {
          success: true,
          data: { valid: true, ticketId: tokenId, eventId, gateId, checkedInAt, markAsUsedJobId }
        });
      }

      const statsMatch = /^\/checkin\/events\/([^/]+)\/stats$/.exec(url.pathname);
      if (method === "GET" && statsMatch) {
        const eventId = statsMatch[1];

        const rows = await queryMany<{ gate_id: string | null; checked_in_count: string }>(
          pool,
          `SELECT gate_id, COUNT(*)::text AS checked_in_count FROM check_ins WHERE event_id=$1 GROUP BY gate_id`,
          [eventId]
        );

        const totalRow = await queryOne<{ total: string }>(
          pool,
          `SELECT COUNT(*)::text AS total FROM check_ins WHERE event_id=$1`,
          [eventId]
        );

        return sendJson(res, 200, {
          success: true,
          data: {
            eventId,
            validScans: Number(totalRow?.total ?? 0),
            gates: rows.map((r) => ({
              gateId: r.gate_id,
              checkedInCount: Number(r.checked_in_count)
            }))
          }
        });
      }

      const gatesMatch = /^\/checkin\/events\/([^/]+)\/gates$/.exec(url.pathname);
      if (method === "GET" && gatesMatch) {
        const eventId = gatesMatch[1];

        const gateRows = await queryMany<{ gate_id: string | null; checked_in_count: string }>(
          pool,
          `SELECT gate_id, COUNT(*)::text AS checked_in_count FROM check_ins WHERE event_id=$1 GROUP BY gate_id`,
          [eventId]
        );

        return sendJson(res, 200, {
          success: true,
          data: {
            eventId,
            gates: gateRows.map((r) => ({
              gateId: r.gate_id,
              checkedInCount: Number(r.checked_in_count)
            }))
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

        return sendJson(res, 200, { success: true, data: jobs });
      }

      return sendJson(res, 404, {
        success: false,
        error: { code: "NOT_FOUND", message: "Route not found" }
      });
    } catch (error) {
      log(config.serviceName, "error", "Unhandled request error", {
        error: error instanceof Error ? error.message : String(error)
      });

      return sendJson(res, 500, {
        success: false,
        error: { code: "INTERNAL_ERROR", message: "Internal server error" }
      });
    }
  });

  server.on("close", () => {
    clearInterval(queueTimer);
    void pool.end();
  });

  return server;
}
