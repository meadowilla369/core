import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import test from "node:test";

const EXPECTED_TICKET_TYPE_COLUMNS = [
  "id",
  "event_id",
  "onchain_ticket_type_id",
  "name",
  "unit_price",
  "quantity",
  "perks"
];

const EXPECTED_PAYMENT_INTENT_COLUMNS = [
  "id",
  "reservation_id",
  "status",
  "amount",
  "gateway",
  "gateway_transaction_id",
  "created_at",
  "updated_at"
];

const EXPECTED_TICKET_COLUMNS = [
  "id",
  "event_id",
  "ticket_type_id",
  "owner_user_id",
  "is_used",
  "created_at",
  "updated_at"
];

const EXPECTED_RESERVATION_COLUMNS = [
  "id",
  "user_id",
  "ticket_type_id",
  "quantity",
  "status",
  "expires_at"
];

const SKIPPED_SERVICE_TABLES = [
  "kyc_records",
  "kyc_provider_status",
  "refund_requests",
  "recovery_requests",
  "disputes",
  "notifications",
  "mint_jobs"
];

function dockerCompose(args, options = {}) {
  return execFileSync("docker", ["compose", ...args], {
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"],
    ...options
  });
}

function psql(sql, database = "ticket_platform") {
  return dockerCompose([
    "exec",
    "-T",
    "postgres",
    "psql",
    "-v",
    "ON_ERROR_STOP=1",
    "-U",
    "ticket_platform",
    "-d",
    database,
    "-At",
    "-c",
    sql
  ]);
}

function requireDockerComposePostgres() {
  const result = spawnSync("docker", ["compose", "ps"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  });

  if (result.status !== 0) {
    return false;
  }

  return result.stdout.includes("postgres");
}

test(
  "canonical schema defines ticket_types with only the approved columns",
  { skip: !requireDockerComposePostgres() },
  () => {
    const schemaSql = readFileSync(new URL("../../infra/db/schema.sql", import.meta.url), "utf8");
    const testDatabase = "ticket_platform_schema_contract";

    psql(`DROP DATABASE IF EXISTS ${testDatabase};`, "postgres");
    psql(`CREATE DATABASE ${testDatabase};`, "postgres");

    try {
      dockerCompose(
        [
          "exec",
          "-T",
          "postgres",
          "psql",
          "-v",
          "ON_ERROR_STOP=1",
          "-U",
          "ticket_platform",
          "-d",
          testDatabase
        ],
        { input: schemaSql }
      );

      const columns = psql(
        `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'ticket_types' ORDER BY ordinal_position;`,
        testDatabase
      )
        .trim()
        .split("\n")
        .filter(Boolean);

      assert.deepEqual(columns, EXPECTED_TICKET_TYPE_COLUMNS);
    } finally {
      psql(`DROP DATABASE IF EXISTS ${testDatabase};`, "postgres");
    }
  }
);

test(
  "canonical schema defines payment_intents and tickets with only the approved columns",
  { skip: !requireDockerComposePostgres() },
  () => {
    const schemaSql = readFileSync(new URL("../../infra/db/schema.sql", import.meta.url), "utf8");
    const testDatabase = "ticket_platform_schema_contract";

    psql(`DROP DATABASE IF EXISTS ${testDatabase};`, "postgres");
    psql(`CREATE DATABASE ${testDatabase};`, "postgres");

    try {
      dockerCompose(
        [
          "exec",
          "-T",
          "postgres",
          "psql",
          "-v",
          "ON_ERROR_STOP=1",
          "-U",
          "ticket_platform",
          "-d",
          testDatabase
        ],
        { input: schemaSql }
      );

      const paymentIntentColumns = psql(
        `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'payment_intents' ORDER BY ordinal_position;`,
        testDatabase
      )
        .trim()
        .split("\n")
        .filter(Boolean);

      const ticketColumns = psql(
        `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'tickets' ORDER BY ordinal_position;`,
        testDatabase
      )
        .trim()
        .split("\n")
        .filter(Boolean);

      assert.deepEqual(
        { paymentIntents: paymentIntentColumns, tickets: ticketColumns },
        { paymentIntents: EXPECTED_PAYMENT_INTENT_COLUMNS, tickets: EXPECTED_TICKET_COLUMNS }
      );
    } finally {
      psql(`DROP DATABASE IF EXISTS ${testDatabase};`, "postgres");
    }
  }
);

test(
  "canonical schema defines reservations with only the approved columns and status values",
  { skip: !requireDockerComposePostgres() },
  () => {
    const schemaSql = readFileSync(new URL("../../infra/db/schema.sql", import.meta.url), "utf8");
    const testDatabase = "ticket_platform_schema_contract";

    psql(`DROP DATABASE IF EXISTS ${testDatabase};`, "postgres");
    psql(`CREATE DATABASE ${testDatabase};`, "postgres");

    try {
      dockerCompose(
        [
          "exec",
          "-T",
          "postgres",
          "psql",
          "-v",
          "ON_ERROR_STOP=1",
          "-U",
          "ticket_platform",
          "-d",
          testDatabase
        ],
        { input: schemaSql }
      );

      const reservationColumns = psql(
        `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'reservations' ORDER BY ordinal_position;`,
        testDatabase
      )
        .trim()
        .split("\n")
        .filter(Boolean);

      const statusConstraint = psql(
        `SELECT pg_get_constraintdef(c.oid)
       FROM pg_constraint c
       JOIN pg_class t ON t.oid = c.conrelid
       WHERE t.relname = 'reservations' AND c.contype = 'c' AND pg_get_constraintdef(c.oid) LIKE '%status%';`,
        testDatabase
      ).trim();

      assert.deepEqual(reservationColumns, EXPECTED_RESERVATION_COLUMNS);
      assert.match(statusConstraint, /pending/);
      assert.match(statusConstraint, /paid/);
      assert.match(statusConstraint, /expired/);
      assert.doesNotMatch(statusConstraint, /payment_pending/);
    } finally {
      psql(`DROP DATABASE IF EXISTS ${testDatabase};`, "postgres");
    }
  }
);

test(
  "canonical schema omits tables for services skipped from localchain startup",
  { skip: !requireDockerComposePostgres() },
  () => {
    const schemaSql = readFileSync(new URL("../../infra/db/schema.sql", import.meta.url), "utf8");
    const testDatabase = "ticket_platform_schema_contract";

    psql(`DROP DATABASE IF EXISTS ${testDatabase};`, "postgres");
    psql(`CREATE DATABASE ${testDatabase};`, "postgres");

    try {
      dockerCompose(
        [
          "exec",
          "-T",
          "postgres",
          "psql",
          "-v",
          "ON_ERROR_STOP=1",
          "-U",
          "ticket_platform",
          "-d",
          testDatabase
        ],
        { input: schemaSql }
      );

      const skippedTables = psql(
        `SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename = ANY (ARRAY[${SKIPPED_SERVICE_TABLES.map((table) => `'${table}'`).join(",")}]) ORDER BY tablename;`,
        testDatabase
      )
        .trim()
        .split("\n")
        .filter(Boolean);

      assert.deepEqual(skippedTables, []);
    } finally {
      psql(`DROP DATABASE IF EXISTS ${testDatabase};`, "postgres");
    }
  }
);
