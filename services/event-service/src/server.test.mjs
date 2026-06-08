import assert from "node:assert/strict";
import { once } from "node:events";
import test from "node:test";

import pg from "pg";

import { createEventServer } from "./server.ts";

const { Client } = pg;

async function createIsolatedDatabase() {
  const admin = new Client({
    connectionString:
      process.env.TEST_DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:5432/postgres"
  });
  await admin.connect();

  const dbName = `event_service_test_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  await admin.query(`CREATE DATABASE ${dbName}`);
  await admin.end();

  const connectionString = (
    process.env.TEST_DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:5432/postgres"
  ).replace(/\/[^/?]+(\?.*)?$/, `/${dbName}$1`);

  return { dbName, connectionString };
}

async function dropIsolatedDatabase(dbName) {
  const admin = new Client({
    connectionString:
      process.env.TEST_DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:5432/postgres"
  });
  await admin.connect();
  await admin.query(`DROP DATABASE IF EXISTS ${dbName} WITH (FORCE)`);
  await admin.end();
}

async function withServer(t, fn) {
  const { dbName, connectionString } = await createIsolatedDatabase();
  const previousDatabaseUrl = process.env.DATABASE_URL;
  process.env.DATABASE_URL = connectionString;

  const server = await createEventServer({ serviceName: "event-service-test", port: 0 });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;

  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    if (previousDatabaseUrl === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = previousDatabaseUrl;
    }
    await dropIsolatedDatabase(dbName);
  });

  return fn(baseUrl);
}

async function requestJson(baseUrl, path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      accept: "application/json",
      ...(options.body ? { "content-type": "application/json" } : {}),
      ...options.headers
    }
  });
  const body = await response.json();
  return { response, body };
}

const completePayload = {
  title: "Cyber Symphony 2026",
  city: "Ho Chi Minh",
  venue: "Riverside Arena",
  startAt: "2026-08-14T19:00:00.000Z",
  endAt: "2026-08-14T23:00:00.000Z",
  status: "draft",
  metadata: {
    category: "Hoa nhac",
    address: "Riverside Arena, Thu Duc, Ho Chi Minh",
    description: "A full event description for attendee detail.",
    lineup: ["Neural Beats", "Quantum Strings"],
    heroImageDataUrl: "data:image/png;base64,aGVybw==",
    posterImageDataUrl: "data:image/png;base64,cG9zdGVy"
  },
  ticketTypes: [
    {
      name: "General Admission",
      price: 900000,
      quantity: 5000,
      perks: ["Vao cong", "Khu vuc dung"]
    }
  ]
};

test("POST /events creates a draft with metadata and ticket perks", async (t) => {
  await withServer(t, async (baseUrl) => {
    const { response, body } = await requestJson(baseUrl, "/events", {
      method: "POST",
      headers: { "x-organizer-id": "org_create" },
      body: JSON.stringify(completePayload)
    });

    assert.equal(response.status, 200);
    assert.equal(body.success, true);
    assert.equal(body.data.status, "draft");
    assert.equal(body.data.organizerId, "org_create");
    assert.equal(body.data.metadata.category, "Hoa nhac");
    assert.deepEqual(body.data.metadata.lineup, ["Neural Beats", "Quantum Strings"]);
    assert.deepEqual(body.data.ticketTypes[0].perks, ["Vao cong", "Khu vuc dung"]);
  });
});

test("active event list excludes draft and in-review events", async (t) => {
  await withServer(t, async (baseUrl) => {
    const created = await requestJson(baseUrl, "/events", {
      method: "POST",
      headers: { "x-organizer-id": "org_create" },
      body: JSON.stringify(completePayload)
    });

    const draftList = await requestJson(baseUrl, "/events?status=active");
    assert.equal(
      draftList.body.data.some((event) => event.id === created.body.data.id),
      false
    );

    await requestJson(baseUrl, `/events/${created.body.data.id}/submit-review`, {
      method: "POST",
      headers: { "x-organizer-id": "org_create" }
    });

    const reviewList = await requestJson(baseUrl, "/events?status=active");
    assert.equal(
      reviewList.body.data.some((event) => event.id === created.body.data.id),
      false
    );
  });
});

test("submit review and dev publish enforce organizer ownership and publish readiness", async (t) => {
  await withServer(t, async (baseUrl) => {
    const created = await requestJson(baseUrl, "/events", {
      method: "POST",
      headers: { "x-organizer-id": "org_create" },
      body: JSON.stringify(completePayload)
    });
    const eventId = created.body.data.id;

    const forbidden = await requestJson(baseUrl, `/events/${eventId}/submit-review`, {
      method: "POST",
      headers: { "x-organizer-id": "org_other" }
    });
    assert.equal(forbidden.response.status, 403);

    const submitted = await requestJson(baseUrl, `/events/${eventId}/submit-review`, {
      method: "POST",
      headers: { "x-organizer-id": "org_create" }
    });
    assert.equal(submitted.response.status, 200);
    assert.equal(submitted.body.data.status, "in_review");

    const published = await requestJson(baseUrl, `/events/${eventId}/dev-publish`, {
      method: "POST",
      headers: { "x-organizer-id": "org_create" }
    });
    assert.equal(published.response.status, 200);
    assert.equal(published.body.data.status, "active");
  });
});

test("draft updates can replace metadata and ticket perks", async (t) => {
  await withServer(t, async (baseUrl) => {
    const created = await requestJson(baseUrl, "/events", {
      method: "POST",
      headers: { "x-organizer-id": "org_create" },
      body: JSON.stringify(completePayload)
    });
    const eventId = created.body.data.id;

    const updated = await requestJson(baseUrl, `/events/${eventId}`, {
      method: "PUT",
      headers: { "x-organizer-id": "org_create" },
      body: JSON.stringify({
        title: "Cyber Symphony Updated",
        metadata: {
          ...completePayload.metadata,
          description: "Updated description",
          lineup: ["Updated Artist"]
        },
        ticketTypes: [
          {
            id: created.body.data.ticketTypes[0].id,
            name: "GA Updated",
            price: 1000000,
            quantity: 6000,
            perks: ["Updated perk"]
          }
        ]
      })
    });

    assert.equal(updated.response.status, 200);
    assert.equal(updated.body.data.title, "Cyber Symphony Updated");
    assert.equal(updated.body.data.metadata.description, "Updated description");
    assert.deepEqual(updated.body.data.ticketTypes[0].perks, ["Updated perk"]);
  });
});
