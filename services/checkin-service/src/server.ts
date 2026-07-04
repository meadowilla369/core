import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { createServer, IncomingMessage, ServerResponse } from "node:http";

import { createPostgresPool, queryOne, queryMany } from "@ticket-platform/local-infra";
import type { Pool, PoolClient } from "pg";

import { verifySignedCheckInPayload, type SignedCheckInPayload } from "./checkin-typed-data.js";
import type { CheckinConfig } from "./config.js";
import { normalizeOnchainEventId } from "./event-id-resolution.js";
import { log } from "./logger.js";
import {
  formatMarkAsUsedJobRow,
  isRecoverableMarkAsUsedJob,
  type MarkAsUsedJobRow,
  type MarkAsUsedJobStatus
} from "./mark-as-used-jobs.js";

interface VerifyRequestBody {
  qrData?: Partial<SignedCheckInPayload>;
  gateId?: string;
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

  await pool.query(`
    CREATE TABLE IF NOT EXISTS mark_as_used_jobs (
      id TEXT PRIMARY KEY,
      check_in_id TEXT NOT NULL REFERENCES check_ins(id) ON DELETE CASCADE,
      token_id TEXT NOT NULL,
      event_id TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('pending', 'retrying', 'processed', 'failed')),
      attempt_count INTEGER NOT NULL DEFAULT 0,
      next_attempt_at TIMESTAMPTZ NOT NULL,
      last_error TEXT,
      tx_hash TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      completed_at TIMESTAMPTZ
    );
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_mark_as_used_jobs_status_next_attempt
    ON mark_as_used_jobs(status, next_attempt_at ASC);
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_mark_as_used_jobs_check_in_id
    ON mark_as_used_jobs(check_in_id);
  `);
}

export async function createCheckinServer(config: CheckinConfig) {
  const pool: Pool = createPostgresPool(process.env);
  await ensureSchema(pool);

  const callMarkAsUsedOnChain = (tokenId: string): { txHash: string } => {
    if (!config.rpcUrl || !config.ticketLedgerOperatorAddress || !config.operatorPrivateKey) {
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
        config.ticketLedgerOperatorAddress,
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

  const enqueueMarkAsUsed = async (
    client: Pool | PoolClient,
    checkInId: string,
    tokenId: string,
    eventId: string
  ): Promise<string> => {
    const jobId = `mku_${randomUUID().replace(/-/g, "")}`;
    await client.query(
      `
        INSERT INTO mark_as_used_jobs (
          id,
          check_in_id,
          token_id,
          event_id,
          status,
          attempt_count,
          next_attempt_at
        )
        VALUES ($1, $2, $3, $4, 'pending', 0, NOW())
      `,
      [jobId, checkInId, tokenId, eventId]
    );
    return jobId;
  };

  const queueTimer = setInterval(() => {
    void (async () => {
      const jobs = await queryMany<MarkAsUsedJobRow>(
        pool,
        `
          SELECT
            id,
            check_in_id,
            token_id,
            event_id,
            status,
            attempt_count,
            next_attempt_at::text,
            created_at::text,
            updated_at::text,
            completed_at::text,
            last_error,
            tx_hash
          FROM mark_as_used_jobs
          WHERE next_attempt_at <= NOW()
          ORDER BY next_attempt_at ASC
          LIMIT 25
        `
      );

      for (const job of jobs.filter(isRecoverableMarkAsUsedJob)) {
        const nextAttempt = job.attempt_count + 1;
        const now = Date.now();

        try {
          const result = callMarkAsUsedOnChain(job.token_id);
          await pool.query(
            `
              UPDATE mark_as_used_jobs
              SET
                status = 'processed',
                attempt_count = $2,
                tx_hash = $3,
                last_error = NULL,
                completed_at = NOW(),
                updated_at = NOW()
              WHERE id = $1
            `,
            [job.id, nextAttempt, result.txHash]
          );
        } catch (err) {
          const reason = err instanceof Error ? err.message : "CHAIN_MARK_AS_USED_FAILED";
          if (nextAttempt >= config.markAsUsedMaxRetries) {
            await pool.query(
              `
                UPDATE mark_as_used_jobs
                SET
                  status = 'failed',
                  attempt_count = $2,
                  last_error = $3,
                  completed_at = NOW(),
                  updated_at = NOW()
                WHERE id = $1
              `,
              [job.id, nextAttempt, reason]
            );
          } else {
            await pool.query(
              `
                UPDATE mark_as_used_jobs
                SET
                  status = 'retrying',
                  attempt_count = $2,
                  next_attempt_at = $3::timestamptz,
                  last_error = $4,
                  updated_at = NOW()
                WHERE id = $1
              `,
              [job.id, nextAttempt, toIso(now + computeRetryDelayMs(nextAttempt)), reason]
            );
          }
        }
      }
    })().catch((error) => {
      log(config.serviceName, "error", "Failed to process mark_as_used_jobs", {
        error: error instanceof Error ? error.message : String(error)
      });
    });
  }, config.markAsUsedPollMs);

  const server = createServer(async (req, res) => {
    try {
      const method = req.method ?? "GET";
      const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);

      if (method === "GET" && url.pathname === "/healthz") {
        const countRow = await queryOne<{ total: string }>(
          pool,
          `SELECT COUNT(*)::text AS total FROM check_ins`
        );
        const pendingJobsRow = await queryOne<{ total: string }>(
          pool,
          `SELECT COUNT(*)::text AS total FROM mark_as_used_jobs WHERE status IN ('pending', 'retrying')`
        );
        const failedJobsRow = await queryOne<{ total: string }>(
          pool,
          `SELECT COUNT(*)::text AS total FROM mark_as_used_jobs WHERE status = 'failed'`
        );

        return sendJson(res, 200, {
          success: true,
          data: {
            service: config.serviceName,
            status: "ok",
            timestamp: new Date().toISOString(),
            checkedInCount: Number(countRow?.total ?? 0),
            pendingMarkAsUsedJobs: Number(pendingJobsRow?.total ?? 0),
            failedMarkAsUsedJobs: Number(failedJobsRow?.total ?? 0)
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

        const tokenId = qrData.message?.tokenId?.trim() ?? "";
        const onchainEventIdRaw = qrData.message?.eventId?.trim() ?? "";
        const nonce = qrData.message?.nonce?.trim() ?? "";
        const signature = qrData.signature?.trim() ?? "";

        if (
          !tokenId ||
          !onchainEventIdRaw ||
          !nonce ||
          !signature ||
          !qrData.domain ||
          !qrData.message
        ) {
          return sendJson(res, 400, {
            success: false,
            error: { code: "INVALID_QR_PAYLOAD", message: "QR payload is incomplete" }
          });
        }

        const onchainEventId = normalizeOnchainEventId(onchainEventIdRaw);
        const resolvedEvent = await queryOne<{ id: string }>(
          pool,
          `SELECT id FROM events WHERE onchain_event_id = $1::numeric`,
          [onchainEventId]
        );

        if (!resolvedEvent) {
          return sendJson(res, 200, {
            success: true,
            data: {
              valid: false,
              reason: "EVENT_NOT_FOUND",
              message: "No local event mapping exists for this onchain event"
            }
          });
        }

        const eventId = resolvedEvent.id;

        const verification = await verifySignedCheckInPayload(
          {
            chainId: config.chainId,
            ticketLedgerAddress: (config.ticketLedgerAddress ??
              "0x0000000000000000000000000000000000000000") as `0x${string}`,
            maxClockSkewSec: config.maxClockSkewSec
          },
          qrData as SignedCheckInPayload
        );

        if (!verification.valid && verification.reason === "QR_EXPIRED") {
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

        if (!verification.valid) {
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

          const insertResult = await client.query<{
            id: string;
            scanned_at: string;
          }>(
            `
              INSERT INTO check_ins (token_id, event_id, gate_id, qr_nonce)
              VALUES ($1, $2, $3, $4)
              ON CONFLICT DO NOTHING
              RETURNING id, scanned_at
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

          const insertedCheckIn = insertResult.rows[0];
          const markAsUsedJobId = await enqueueMarkAsUsed(
            client,
            insertedCheckIn.id,
            tokenId,
            eventId
          );

          await client.query("COMMIT");
          return sendJson(res, 200, {
            success: true,
            data: {
              valid: true,
              ticketId: tokenId,
              eventId,
              gateId,
              checkedInAt: insertedCheckIn.scanned_at,
              markAsUsedJobId
            }
          });
        } catch (err) {
          await client.query("ROLLBACK");
          throw err;
        } finally {
          client.release();
        }
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
        const jobs = await queryMany<MarkAsUsedJobRow>(
          pool,
          `
            SELECT
              id,
              check_in_id,
              token_id,
              event_id,
              status,
              attempt_count,
              next_attempt_at::text,
              created_at::text,
              updated_at::text,
              completed_at::text,
              last_error,
              tx_hash
            FROM mark_as_used_jobs
            ORDER BY created_at DESC
          `
        );

        return sendJson(res, 200, { success: true, data: jobs.map(formatMarkAsUsedJobRow) });
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
