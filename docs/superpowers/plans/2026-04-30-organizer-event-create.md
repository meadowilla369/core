# Organizer Event Create Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an end-to-end organizer event creation flow that creates draft events with full attendee-facing metadata, supports review/dev publish, and renders the result in `apps/web` Event Detail and Discover.

**Architecture:** Extend `event-service` as the source of truth for rich event metadata and ticket perks, then propagate the contract through `sdk-client`, shared view types, `apps/web` adapters, and `apps/organizer-portal`. Keep organizer UI state in focused domain/view-model helpers and route-level pages, with API access isolated behind `OrganizerApi`. Use data URLs for local/mock media upload in this milestone.

**Tech Stack:** Node HTTP service, PostgreSQL, TypeScript, node:test with `--experimental-strip-types`, React 18, Vite, React Router, Tailwind CSS, lucide-react.

---

## File Structure

Create or modify these files:

- Modify `services/event-service/src/server.ts`: event metadata schema, ticket perks, draft/review/publish statuses, create/update/status endpoints, response mapping.
- Create `services/event-service/src/server.test.mjs`: backend API regression tests using a temporary Postgres database.
- Modify `services/event-service/package.json`: add a concrete `test` script for the new server tests.
- Modify `packages/sdk-client/src/index.ts`: event metadata/perks/status types and organizer write methods.
- Create `packages/sdk-client/src/event-client.test.mjs`: SDK method and request-shape tests.
- Modify `packages/sdk-client/package.json`: add `test:events` script.
- Modify `packages/shared-types/src/index.ts`: optional `heroImageDataUrl` and `posterImageDataUrl` view fields.
- Modify `apps/web/src/lib/adapters.ts`: map metadata and ticket perks into attendee view models.
- Modify `apps/web/src/features/discover/event-posters.ts`: use poster image data URL for poster surfaces.
- Create `apps/web/src/lib/event-adapters.test.ts`: event detail/discover adapter tests.
- Modify `apps/web/src/pages/EventDetailPage.tsx`: render hero image when present.
- Modify `apps/web/package.json`: add `test:event-adapters` script.
- Create `apps/organizer-portal/src/domain/event-create.ts`: wizard state, validation, payload builders, preview model helpers.
- Create `apps/organizer-portal/src/domain/event-create.test.ts`: create-flow domain tests.
- Modify `apps/organizer-portal/src/lib/organizer-api.ts`: create/update/get/submit/dev-publish methods and event types.
- Create `apps/organizer-portal/src/lib/media.ts`: file-to-data-URL helper.
- Create `apps/organizer-portal/src/components/EventDetailPreview.tsx`: organizer-side mobile preview matching app/web event detail structure.
- Create `apps/organizer-portal/src/pages/EventCreatePage.tsx`: four-step create/edit wizard.
- Create `apps/organizer-portal/src/pages/EventReviewPage.tsx`: review checklist and submit/dev publish actions.
- Modify `apps/organizer-portal/src/pages/EventsPage.tsx`: wire Create event button to `/events/new`.
- Modify `apps/organizer-portal/src/App.tsx`: add create/edit/review routes and page metadata.

---

## Task 1: Event Service Contract Tests

**Files:**

- Create: `services/event-service/src/server.test.mjs`
- Modify: `services/event-service/package.json`

- [ ] **Step 1: Add test script**

Modify `services/event-service/package.json` scripts:

```json
{
  "test": "node --test src/server.test.mjs"
}
```

Keep the existing `build`, `dev`, `start`, `lint`, `typecheck`, and `format` scripts unchanged.

- [ ] **Step 2: Create failing event-service tests**

Create `services/event-service/src/server.test.mjs`:

```js
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
    category: "Hòa nhạc",
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
      perks: ["Vào cổng", "Khu vực đứng"]
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
    assert.equal(body.data.metadata.category, "Hòa nhạc");
    assert.deepEqual(body.data.metadata.lineup, ["Neural Beats", "Quantum Strings"]);
    assert.deepEqual(body.data.ticketTypes[0].perks, ["Vào cổng", "Khu vực đứng"]);
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
```

- [ ] **Step 3: Run tests to verify they fail**

Run:

```bash
pnpm --filter @ticket-platform/svc-event-service test
```

Expected: FAIL because `metadata`, `perks`, draft statuses, submit-review, and dev-publish are not implemented.

- [ ] **Step 4: Commit failing tests**

```bash
git add services/event-service/package.json services/event-service/src/server.test.mjs
git commit -m "event-service: add organizer event create contract tests"
```

---

## Task 2: Event Service Metadata And Status Implementation

**Files:**

- Modify: `services/event-service/src/server.ts`

- [ ] **Step 1: Extend service types**

In `services/event-service/src/server.ts`, replace the status and ticket type interfaces near the top with:

```ts
type EventStatus = "draft" | "in_review" | "active" | "cancelled";

interface TicketType {
  id: string;
  name: string;
  price: number;
  quantity: number;
  soldCount: number;
  perks: string[];
}

interface EventMetadata {
  category: string;
  address: string;
  description: string;
  lineup: string[];
  heroImageDataUrl: string;
  posterImageDataUrl: string;
}

interface EventRecord {
  id: string;
  organizerId: string;
  title: string;
  city: string;
  venue: string;
  startAt: string;
  endAt: string;
  status: EventStatus;
  metadata: EventMetadata | null;
  ticketTypes: TicketType[];
}

interface EventWriteTicketType {
  id?: string;
  name?: string;
  price?: number;
  quantity?: number;
  perks?: string[];
}

interface EventWriteMetadata {
  category?: string;
  address?: string;
  description?: string;
  lineup?: string[];
  heroImageDataUrl?: string;
  posterImageDataUrl?: string;
}

interface CreateEventBody {
  title?: string;
  city?: string;
  venue?: string;
  startAt?: string;
  endAt?: string;
  status?: EventStatus;
  metadata?: EventWriteMetadata;
  ticketTypes?: EventWriteTicketType[];
}

interface UpdateEventBody {
  title?: string;
  city?: string;
  venue?: string;
  startAt?: string;
  endAt?: string;
  metadata?: EventWriteMetadata;
  ticketTypes?: EventWriteTicketType[];
}
```

- [ ] **Step 2: Extend row interfaces**

Replace `EventRow` and `TicketTypeRow`, then add `EventMetadataRow`:

```ts
interface EventRow {
  id: string;
  organizer_id: string;
  title: string;
  city: string;
  venue: string;
  start_at: string | Date;
  end_at: string | Date;
  status: EventStatus;
}

interface EventMetadataRow {
  event_id: string;
  category: string;
  address: string;
  description: string;
  lineup: string[] | string;
  hero_image_data_url: string;
  poster_image_data_url: string;
}

interface TicketTypeRow {
  id: string;
  event_id: string;
  name: string;
  price: number | string;
  quantity: number | string;
  sold_count: number | string;
  perks: string[] | string | null;
}
```

- [ ] **Step 3: Add metadata and perks helpers**

Add these helpers after `toIso`:

```ts
function toStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as unknown;
      return toStringArray(parsed);
    } catch {
      return [];
    }
  }

  return [];
}

function normalizeMetadata(input?: EventWriteMetadata): EventMetadata | null {
  if (!input) {
    return null;
  }

  return {
    category: input.category?.trim() ?? "",
    address: input.address?.trim() ?? "",
    description: input.description?.trim() ?? "",
    lineup: toStringArray(input.lineup),
    heroImageDataUrl: input.heroImageDataUrl?.trim() ?? "",
    posterImageDataUrl: input.posterImageDataUrl?.trim() ?? ""
  };
}

function mapMetadataRow(row?: EventMetadataRow | null): EventMetadata | null {
  if (!row) {
    return null;
  }

  return {
    category: row.category,
    address: row.address,
    description: row.description,
    lineup: toStringArray(row.lineup),
    heroImageDataUrl: row.hero_image_data_url,
    posterImageDataUrl: row.poster_image_data_url
  };
}

function validatePublishReady(event: EventRecord): string[] {
  const missing: string[] = [];
  const metadata = event.metadata;

  if (!event.title.trim()) missing.push("title");
  if (!event.city.trim()) missing.push("city");
  if (!event.venue.trim()) missing.push("venue");
  if (!event.startAt.trim()) missing.push("startAt");
  if (!event.endAt.trim()) missing.push("endAt");
  if (!metadata?.category.trim()) missing.push("metadata.category");
  if (!metadata?.address.trim()) missing.push("metadata.address");
  if (!metadata?.description.trim()) missing.push("metadata.description");
  if (!metadata?.heroImageDataUrl.trim()) missing.push("metadata.heroImageDataUrl");
  if (!metadata?.posterImageDataUrl.trim()) missing.push("metadata.posterImageDataUrl");
  if (event.ticketTypes.length === 0) missing.push("ticketTypes");

  for (const [index, ticketType] of event.ticketTypes.entries()) {
    if (!ticketType.name.trim()) missing.push(`ticketTypes.${index}.name`);
    if (ticketType.price < 0) missing.push(`ticketTypes.${index}.price`);
    if (ticketType.quantity <= 0) missing.push(`ticketTypes.${index}.quantity`);
  }

  return missing;
}
```

- [ ] **Step 4: Update schema creation**

In `ensureSchema`, update the `events` status check and `event_ticket_types`, then add `event_metadata`:

```sql
status TEXT NOT NULL CHECK (status IN ('draft', 'in_review', 'active', 'cancelled')),
```

```sql
ALTER TABLE events DROP CONSTRAINT IF EXISTS events_status_check;
ALTER TABLE events ADD CONSTRAINT events_status_check CHECK (status IN ('draft', 'in_review', 'active', 'cancelled'));
```

```sql
ALTER TABLE event_ticket_types ADD COLUMN IF NOT EXISTS perks JSONB NOT NULL DEFAULT '[]'::jsonb;
```

```sql
CREATE TABLE IF NOT EXISTS event_metadata (
  event_id TEXT PRIMARY KEY REFERENCES events(id) ON DELETE CASCADE,
  category TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  lineup JSONB NOT NULL DEFAULT '[]'::jsonb,
  hero_image_data_url TEXT NOT NULL DEFAULT '',
  poster_image_data_url TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

- [ ] **Step 5: Update seed data**

Update seed event statuses to `active` and add metadata/perks:

```ts
metadata: {
  category: "Hòa nhạc",
  address: "Riverside Arena, Ho Chi Minh",
  description: "Rock Fest 2026 brings high-energy live music to Riverside Arena.",
  lineup: ["Neural Beats", "Quantum Strings"],
  heroImageDataUrl: "",
  posterImageDataUrl: ""
}
```

Add `perks` arrays to each seed ticket type, such as:

```ts
perks: ["Vào cổng", "Khu vực đứng"];
```

- [ ] **Step 6: Update mapping and loading**

Change `mapEventRow` signature to:

```ts
function mapEventRow(
  row: EventRow,
  ticketTypes: TicketTypeRow[],
  metadataRows: EventMetadataRow[] = []
): EventRecord;
```

Ticket type mapping must include:

```ts
perks: toStringArray(item.perks);
```

Event record must include:

```ts
metadata: mapMetadataRow(metadataRows.find((item) => item.event_id === row.id));
```

In `listEvents`, also load metadata rows:

```ts
const eventIds = eventRows.map((item) => item.id);
const metadataRows = eventIds.length
  ? await queryMany<EventMetadataRow>(
      pool,
      `SELECT event_id, category, address, description, lineup, hero_image_data_url, poster_image_data_url FROM event_metadata WHERE event_id = ANY($1::text[])`,
      [eventIds]
    )
  : [];
```

Guard the ticket type query the same way so empty lists do not query `ANY([])` unexpectedly.

In `loadEvent`, load one metadata row and pass it to `mapEventRow`.

- [ ] **Step 7: Persist metadata and ticket perks on create**

In `POST /events`, use:

```ts
const status: EventStatus =
  body.status === "active" || body.status === "in_review" || body.status === "cancelled"
    ? body.status
    : "draft";
const metadata = normalizeMetadata(body.metadata);
```

Insert event with `status`.

Insert ticket types with `perks`:

```sql
INSERT INTO event_ticket_types (id, event_id, name, price, quantity, sold_count, perks)
VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
```

Parameters include `JSON.stringify(ticketType.perks)`.

If `metadata` is present, insert it:

```sql
INSERT INTO event_metadata (
  event_id,
  category,
  address,
  description,
  lineup,
  hero_image_data_url,
  poster_image_data_url
)
VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7)
```

- [ ] **Step 8: Update draft edit behavior**

In `PUT /events/:eventId`, reject non-draft updates:

```ts
if (existing.status !== "draft") {
  return sendJson(res, 409, {
    success: false,
    error: {
      code: "EVENT_NOT_EDITABLE",
      message: "Only draft events can be edited"
    }
  });
}
```

Update core fields as before, without accepting status from body.

If `body.metadata` is present, upsert `event_metadata`.

If `body.ticketTypes` is present, replace ticket types in the transaction:

```sql
DELETE FROM event_ticket_types WHERE event_id = $1
```

Then insert each provided ticket type with id fallback and perks.

- [ ] **Step 9: Add submit-review and dev-publish handlers**

Add before the GET detail handler:

```ts
const submitReviewMatch = url.pathname.match(/^\/events\/([^/]+)\/submit-review$/);
if (method === "POST" && submitReviewMatch) {
  return transitionOrganizerEvent(pool, req, res, submitReviewMatch[1], "in_review");
}

const devPublishMatch = url.pathname.match(/^\/events\/([^/]+)\/dev-publish$/);
if (method === "POST" && devPublishMatch) {
  return transitionOrganizerEvent(pool, req, res, devPublishMatch[1], "active");
}
```

Add helper above `createEventServer`:

```ts
async function transitionOrganizerEvent(
  pool: Pool,
  req: IncomingMessage,
  res: ServerResponse,
  eventId: string,
  nextStatus: "in_review" | "active"
) {
  const organizerId = extractOrganizerId(req);
  if (!organizerId) {
    return sendJson(res, 401, {
      success: false,
      error: { code: "UNAUTHORIZED_ORGANIZER", message: "Missing x-organizer-id header" }
    });
  }

  const event = await loadEvent(pool, eventId);
  if (!event) {
    return sendJson(res, 404, {
      success: false,
      error: { code: "EVENT_NOT_FOUND", message: "Event not found" }
    });
  }

  if (event.organizerId !== organizerId) {
    return sendJson(res, 403, {
      success: false,
      error: { code: "FORBIDDEN", message: "Only organizer can update event" }
    });
  }

  if (nextStatus === "in_review" && event.status !== "draft") {
    return sendJson(res, 409, {
      success: false,
      error: {
        code: "INVALID_STATUS_TRANSITION",
        message: "Only draft events can be submitted for review"
      }
    });
  }

  if (nextStatus === "active" && event.status !== "draft" && event.status !== "in_review") {
    return sendJson(res, 409, {
      success: false,
      error: {
        code: "INVALID_STATUS_TRANSITION",
        message: "Only draft or in-review events can be dev published"
      }
    });
  }

  const missing = validatePublishReady(event);
  if (missing.length > 0) {
    return sendJson(res, 400, {
      success: false,
      error: {
        code: "EVENT_NOT_READY",
        message: "Event is missing publish-readiness fields",
        fields: missing
      }
    });
  }

  await pool.query(`UPDATE events SET status = $2, updated_at = NOW() WHERE id = $1`, [
    eventId,
    nextStatus
  ]);

  return sendJson(res, 200, {
    success: true,
    data: await loadEvent(pool, eventId)
  });
}
```

- [ ] **Step 10: Run event-service tests**

Run:

```bash
pnpm --filter @ticket-platform/svc-event-service test
pnpm --filter @ticket-platform/svc-event-service typecheck
pnpm --filter @ticket-platform/svc-event-service build
```

Expected: all pass.

- [ ] **Step 11: Commit implementation**

```bash
git add services/event-service/src/server.ts
git commit -m "event-service: support rich draft events"
```

---

## Task 3: SDK Client Event Contract

**Files:**

- Modify: `packages/sdk-client/src/index.ts`
- Create: `packages/sdk-client/src/event-client.test.mjs`
- Modify: `packages/sdk-client/package.json`

- [ ] **Step 1: Add failing SDK tests**

Create `packages/sdk-client/src/event-client.test.mjs`:

```js
import assert from "node:assert/strict";
import test from "node:test";

import { TicketPlatformClient } from "../dist/index.js";

function withMockFetch(assertRequest) {
  const calls = [];
  const fetchImpl = async (url, init = {}) => {
    calls.push({ url: String(url), init });
    assertRequest?.({ url: String(url), init });
    return new Response(
      JSON.stringify({
        success: true,
        data: {
          id: "evt_created",
          organizerId: "org_create",
          title: "Cyber Symphony",
          city: "Ho Chi Minh",
          venue: "Riverside Arena",
          startAt: "2026-08-14T19:00:00.000Z",
          endAt: "2026-08-14T23:00:00.000Z",
          status: "draft",
          metadata: {
            category: "Hòa nhạc",
            address: "Riverside Arena",
            description: "Description",
            lineup: ["Artist"],
            heroImageDataUrl: "data:image/png;base64,aA==",
            posterImageDataUrl: "data:image/png;base64,cA=="
          },
          ticketTypes: [
            {
              id: "tt_ga",
              name: "GA",
              price: 900000,
              quantity: 100,
              soldCount: 0,
              perks: ["Vào cổng"]
            }
          ]
        }
      }),
      { status: 200, headers: { "content-type": "application/json" } }
    );
  };
  return { fetchImpl, calls };
}

const draftPayload = {
  title: "Cyber Symphony",
  city: "Ho Chi Minh",
  venue: "Riverside Arena",
  startAt: "2026-08-14T19:00:00.000Z",
  endAt: "2026-08-14T23:00:00.000Z",
  metadata: {
    category: "Hòa nhạc",
    address: "Riverside Arena",
    description: "Description",
    lineup: ["Artist"],
    heroImageDataUrl: "data:image/png;base64,aA==",
    posterImageDataUrl: "data:image/png;base64,cA=="
  },
  ticketTypes: [{ name: "GA", price: 900000, quantity: 100, perks: ["Vào cổng"] }]
};

test("createEvent posts metadata and organizer header", async () => {
  const { fetchImpl, calls } = withMockFetch();
  const client = new TicketPlatformClient({ baseUrl: "https://api.example.test", fetchImpl });

  const response = await client.createEvent(draftPayload, { organizerId: "org_create" });

  assert.equal(response.data.metadata.category, "Hòa nhạc");
  assert.deepEqual(response.data.ticketTypes[0].perks, ["Vào cổng"]);
  assert.equal(calls[0].url, "https://api.example.test/v1/events");
  assert.equal(calls[0].init.method, "POST");
  assert.equal(calls[0].init.headers["x-organizer-id"], "org_create");
  assert.equal(JSON.parse(calls[0].init.body).metadata.category, "Hòa nhạc");
});

test("submitEventForReview and devPublishEvent call dedicated endpoints", async () => {
  const { fetchImpl, calls } = withMockFetch();
  const client = new TicketPlatformClient({ baseUrl: "https://api.example.test", fetchImpl });

  await client.submitEventForReview("evt_created", { organizerId: "org_create" });
  await client.devPublishEvent("evt_created", { organizerId: "org_create" });

  assert.equal(calls[0].url, "https://api.example.test/v1/events/evt_created/submit-review");
  assert.equal(calls[0].init.method, "POST");
  assert.equal(calls[1].url, "https://api.example.test/v1/events/evt_created/dev-publish");
  assert.equal(calls[1].init.method, "POST");
});
```

- [ ] **Step 2: Add test script**

Modify `packages/sdk-client/package.json`:

```json
{
  "test:events": "pnpm run build && node --test src/event-client.test.mjs"
}
```

- [ ] **Step 3: Run tests to verify they fail**

Run:

```bash
pnpm --filter @ticket-platform/sdk-client test:events
```

Expected: FAIL because event write methods and rich event types are missing.

- [ ] **Step 4: Update SDK types**

In `packages/sdk-client/src/index.ts`, replace event-related types with:

```ts
export type EventStatus = "draft" | "in_review" | "active" | "cancelled";

export interface EventMetadata {
  category: string;
  address: string;
  description: string;
  lineup: string[];
  heroImageDataUrl: string;
  posterImageDataUrl: string;
}

export interface EventSummary {
  id: string;
  organizerId?: string;
  title: string;
  city: string;
  venue: string;
  startAt: string;
  endAt: string;
  status: EventStatus;
  metadata?: EventMetadata | null;
}

export interface TicketType {
  id: string;
  name: string;
  price: number;
  quantity: number;
  soldCount: number;
  perks: string[];
}

export interface EventDetail extends EventSummary {
  metadata: EventMetadata | null;
  ticketTypes: TicketType[];
}

export interface EventWriteTicketType {
  id?: string;
  name: string;
  price: number;
  quantity: number;
  perks: string[];
}

export interface EventWriteInput {
  title: string;
  city: string;
  venue: string;
  startAt: string;
  endAt: string;
  metadata: EventMetadata;
  ticketTypes: EventWriteTicketType[];
}
```

- [ ] **Step 5: Add SDK event methods**

Inside `TicketPlatformClient`, after `getEvent`, add:

```ts
async createEvent(
  input: EventWriteInput,
  ctx: { organizerId: string }
): Promise<ApiSuccessResponse<EventDetail>> {
  return this.request("/v1/events", {
    method: "POST",
    body: input,
    headers: {
      "x-organizer-id": ctx.organizerId
    }
  });
}

async updateEvent(
  eventId: string,
  input: Partial<EventWriteInput>,
  ctx: { organizerId: string }
): Promise<ApiSuccessResponse<EventDetail>> {
  return this.request(`/v1/events/${eventId}`, {
    method: "PUT",
    body: input,
    headers: {
      "x-organizer-id": ctx.organizerId
    }
  });
}

async submitEventForReview(
  eventId: string,
  ctx: { organizerId: string }
): Promise<ApiSuccessResponse<EventDetail>> {
  return this.request(`/v1/events/${eventId}/submit-review`, {
    method: "POST",
    headers: {
      "x-organizer-id": ctx.organizerId
    }
  });
}

async devPublishEvent(
  eventId: string,
  ctx: { organizerId: string }
): Promise<ApiSuccessResponse<EventDetail>> {
  return this.request(`/v1/events/${eventId}/dev-publish`, {
    method: "POST",
    headers: {
      "x-organizer-id": ctx.organizerId
    }
  });
}
```

- [ ] **Step 6: Run SDK checks**

Run:

```bash
pnpm --filter @ticket-platform/sdk-client test:events
pnpm --filter @ticket-platform/sdk-client typecheck
pnpm --filter @ticket-platform/sdk-client build
```

Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add packages/sdk-client/src/index.ts packages/sdk-client/src/event-client.test.mjs packages/sdk-client/package.json
git commit -m "sdk-client: add organizer event writes"
```

---

## Task 4: Shared Types And Web Adapter Tests

**Files:**

- Modify: `packages/shared-types/src/index.ts`
- Create: `apps/web/src/lib/event-adapters.test.ts`
- Modify: `apps/web/package.json`

- [ ] **Step 1: Update shared view types**

In `packages/shared-types/src/index.ts`, update:

```ts
export interface EventCardView {
  id: Uuid;
  name: string;
  date: string;
  location: string;
  category: string;
  image?: string;
  posterImageDataUrl?: string;
  price: string;
}

export interface EventDetailView {
  id: Uuid;
  name: string;
  category: string;
  date: string;
  time: string;
  location: string;
  address: string;
  price: {
    min: number;
    max: number;
  };
  description: string;
  lineup: string[];
  attendees: number;
  heroImageDataUrl?: string;
}
```

- [ ] **Step 2: Add web adapter tests**

Create `apps/web/src/lib/event-adapters.test.ts`:

```ts
import assert from "node:assert/strict";
import test from "node:test";

import { toEventCardView, toEventDetailView, toTicketTierViews } from "./adapters.ts";
import { toPosterEventViews } from "../features/discover/event-posters.ts";
import type { EventDetail } from "@ticket-platform/sdk-client";

const event: EventDetail = {
  id: "evt_created",
  organizerId: "org_create",
  title: "Cyber Symphony 2026",
  city: "Ho Chi Minh",
  venue: "Riverside Arena",
  startAt: "2026-08-14T19:00:00.000Z",
  endAt: "2026-08-14T23:00:00.000Z",
  status: "active",
  metadata: {
    category: "Hòa nhạc",
    address: "Riverside Arena, Thu Duc, Ho Chi Minh",
    description: "A metadata-backed event detail description.",
    lineup: ["Neural Beats", "Quantum Strings"],
    heroImageDataUrl: "data:image/png;base64,aGVybw==",
    posterImageDataUrl: "data:image/png;base64,cG9zdGVy"
  },
  ticketTypes: [
    {
      id: "tt_ga",
      name: "General Admission",
      price: 900000,
      quantity: 5000,
      soldCount: 125,
      perks: ["Vào cổng", "Khu vực đứng"]
    }
  ]
};

test("event detail adapter uses event metadata fields", () => {
  const view = toEventDetailView(event);

  assert.equal(view.category, "Hòa nhạc");
  assert.equal(view.address, "Riverside Arena, Thu Duc, Ho Chi Minh");
  assert.equal(view.description, "A metadata-backed event detail description.");
  assert.deepEqual(view.lineup, ["Neural Beats", "Quantum Strings"]);
  assert.equal(view.heroImageDataUrl, "data:image/png;base64,aGVybw==");
});

test("ticket tier adapter prefers backend perks", () => {
  const [tier] = toTicketTierViews(event);

  assert.equal(tier.name, "General Admission");
  assert.deepEqual(tier.perks, ["Vào cổng", "Khu vực đứng"]);
});

test("discover poster conversion uses poster image metadata", () => {
  const card = toEventCardView(event, event);
  const [poster] = toPosterEventViews([card]);

  assert.equal(card.posterImageDataUrl, "data:image/png;base64,cG9zdGVy");
  assert.equal(poster.imageUrl, "data:image/png;base64,cG9zdGVy");
  assert.equal(poster.heroImageUrl, "data:image/png;base64,cG9zdGVy");
});
```

- [ ] **Step 3: Add test script**

Modify `apps/web/package.json` scripts:

```json
{
  "test:event-adapters": "node --test --experimental-strip-types src/lib/event-adapters.test.ts"
}
```

- [ ] **Step 4: Run tests to verify they fail**

Run:

```bash
pnpm --filter @ticket-platform/app-web test:event-adapters
```

Expected: FAIL because adapters do not yet map metadata/perks/poster data URL.

- [ ] **Step 5: Commit failing tests/types**

```bash
git add packages/shared-types/src/index.ts apps/web/src/lib/event-adapters.test.ts apps/web/package.json
git commit -m "web: add event metadata adapter tests"
```

---

## Task 5: apps/web Metadata Rendering

**Files:**

- Modify: `apps/web/src/lib/adapters.ts`
- Modify: `apps/web/src/features/discover/event-posters.ts`
- Modify: `apps/web/src/pages/EventDetailPage.tsx`

- [ ] **Step 1: Update `toEventCardView`**

In `apps/web/src/lib/adapters.ts`, return metadata poster data URL:

```ts
const metadata = "metadata" in event ? event.metadata : detail?.metadata;

return {
  id: event.id,
  name: event.title,
  date: formatShortEventDate(event.startAt),
  location: event.city,
  category: metadata?.category || categoryForEvent(event.id, event.title),
  image: metadata?.posterImageDataUrl || undefined,
  posterImageDataUrl: metadata?.posterImageDataUrl || undefined,
  price: minPrice > 0 ? formatVnd(minPrice) : "Sắp mở bán"
};
```

- [ ] **Step 2: Update `toEventDetailView`**

Replace fallback-only fields:

```ts
const metadata = event.metadata;

return {
  id: event.id,
  name: event.title,
  category: metadata?.category || categoryForEvent(event.id, event.title),
  date: formatMediumEventDate(event.startAt),
  time: formatTimeRange(event.startAt, event.endAt),
  location: event.venue,
  address: metadata?.address || `${event.venue}, ${event.city}`,
  price: { min, max },
  description:
    metadata?.description ||
    `${event.title} là sự kiện đang mở bán trên core. Thông tin mô tả chi tiết chưa được event-service cung cấp nên giao diện đang hiển thị bản tóm tắt từ dữ liệu runtime.`,
  lineup: metadata?.lineup ?? [],
  attendees: sold,
  heroImageDataUrl: metadata?.heroImageDataUrl || undefined
};
```

- [ ] **Step 3: Update `toTicketTierViews`**

Use backend perks first:

```ts
export function toTicketTierViews(event: EventDetail): TicketTierView[] {
  return event.ticketTypes.map((tier) => ({
    name: tier.name,
    price: formatVnd(tier.price),
    perks:
      tier.perks.length > 0
        ? tier.perks
        : [
            `${Math.max(tier.quantity - tier.soldCount, 0)} vé còn lại`,
            `Đã bán ${tier.soldCount}`,
            `Tổng số lượng ${tier.quantity}`
          ]
  }));
}
```

- [ ] **Step 4: Update poster conversion**

In `apps/web/src/features/discover/event-posters.ts`, set image fields:

```ts
const imageUrl = event.posterImageDataUrl ?? event.image;

return {
  ...event,
  imageUrl,
  heroImageUrl: imageUrl,
  ...
};
```

- [ ] **Step 5: Render hero image in EventDetailPage**

In `apps/web/src/pages/EventDetailPage.tsx`, inside the hero container before the gradient overlay, add:

```tsx
{
  eventData.heroImageDataUrl ? (
    <img
      src={eventData.heroImageDataUrl}
      alt=""
      className="absolute inset-0 h-full w-full object-cover"
    />
  ) : null;
}
```

Keep the existing gradient/title overlay.

- [ ] **Step 6: Run web checks**

Run:

```bash
pnpm --filter @ticket-platform/app-web test:event-adapters
pnpm --filter @ticket-platform/app-web test:ui-home-discover
pnpm --filter @ticket-platform/app-web typecheck
pnpm --filter @ticket-platform/app-web build
```

Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/lib/adapters.ts apps/web/src/features/discover/event-posters.ts apps/web/src/pages/EventDetailPage.tsx
git commit -m "web: render event metadata in detail"
```

---

## Task 6: Organizer Create Domain Model

**Files:**

- Create: `apps/organizer-portal/src/domain/event-create.ts`
- Create: `apps/organizer-portal/src/domain/event-create.test.ts`

- [ ] **Step 1: Write failing domain tests**

Create `apps/organizer-portal/src/domain/event-create.test.ts`:

```ts
import assert from "node:assert/strict";
import test from "node:test";

import {
  buildEventCreatePayload,
  buildEventPreview,
  createEmptyEventDraft,
  validateEventDraft
} from "./event-create.ts";

test("empty draft reports publish readiness errors", () => {
  const draft = createEmptyEventDraft();
  const result = validateEventDraft(draft);

  assert.equal(result.isPublishReady, false);
  assert.deepEqual(result.missingFields.slice(0, 6), [
    "title",
    "category",
    "city",
    "venue",
    "address",
    "startAt"
  ]);
});

test("complete draft builds API payload and preview", () => {
  const draft = {
    ...createEmptyEventDraft(),
    title: "Cyber Symphony 2026",
    category: "Hòa nhạc",
    city: "Ho Chi Minh",
    venue: "Riverside Arena",
    address: "Riverside Arena, Thu Duc",
    startAt: "2026-08-14T19:00:00.000Z",
    endAt: "2026-08-14T23:00:00.000Z",
    description: "A metadata-backed description.",
    lineup: ["Neural Beats"],
    heroImageDataUrl: "data:image/png;base64,aGVybw==",
    posterImageDataUrl: "data:image/png;base64,cG9zdGVy",
    ticketTypes: [
      {
        name: "GA",
        price: 900000,
        quantity: 100,
        perks: ["Vào cổng"]
      }
    ]
  };

  const validation = validateEventDraft(draft);
  assert.equal(validation.isPublishReady, true);

  const payload = buildEventCreatePayload(draft);
  assert.equal(payload.metadata.category, "Hòa nhạc");
  assert.deepEqual(payload.ticketTypes[0].perks, ["Vào cổng"]);

  const preview = buildEventPreview(draft);
  assert.equal(preview.event.name, "Cyber Symphony 2026");
  assert.equal(preview.event.heroImageDataUrl, "data:image/png;base64,aGVybw==");
  assert.equal(preview.tiers[0].price, "900.000 ₫");
});
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
pnpm --filter @ticket-platform/app-organizer-portal test:domain
```

Expected: FAIL because `event-create.ts` does not exist.

- [ ] **Step 3: Implement domain model**

Create `apps/organizer-portal/src/domain/event-create.ts`:

```ts
import { formatDateTime, formatVnd } from "../lib/format.ts";

export interface EventTicketTypeDraft {
  id?: string;
  name: string;
  price: number;
  quantity: number;
  perks: string[];
}

export interface EventCreateDraft {
  title: string;
  category: string;
  city: string;
  venue: string;
  address: string;
  startAt: string;
  endAt: string;
  description: string;
  lineup: string[];
  heroImageDataUrl: string;
  posterImageDataUrl: string;
  ticketTypes: EventTicketTypeDraft[];
}

export interface EventCreateValidation {
  isPublishReady: boolean;
  missingFields: string[];
  warnings: string[];
}

export interface EventCreatePayload {
  title: string;
  city: string;
  venue: string;
  startAt: string;
  endAt: string;
  status: "draft";
  metadata: {
    category: string;
    address: string;
    description: string;
    lineup: string[];
    heroImageDataUrl: string;
    posterImageDataUrl: string;
  };
  ticketTypes: EventTicketTypeDraft[];
}

export function createEmptyEventDraft(): EventCreateDraft {
  return {
    title: "",
    category: "",
    city: "",
    venue: "",
    address: "",
    startAt: "",
    endAt: "",
    description: "",
    lineup: [],
    heroImageDataUrl: "",
    posterImageDataUrl: "",
    ticketTypes: []
  };
}

export function validateEventDraft(draft: EventCreateDraft): EventCreateValidation {
  const missingFields: string[] = [];
  const warnings: string[] = [];

  if (!draft.title.trim()) missingFields.push("title");
  if (!draft.category.trim()) missingFields.push("category");
  if (!draft.city.trim()) missingFields.push("city");
  if (!draft.venue.trim()) missingFields.push("venue");
  if (!draft.address.trim()) missingFields.push("address");
  if (!draft.startAt.trim()) missingFields.push("startAt");
  if (!draft.endAt.trim()) missingFields.push("endAt");
  if (draft.startAt && draft.endAt && new Date(draft.endAt) <= new Date(draft.startAt)) {
    missingFields.push("endAfterStart");
  }
  if (!draft.description.trim()) missingFields.push("description");
  if (!draft.heroImageDataUrl.trim()) missingFields.push("heroImageDataUrl");
  if (!draft.posterImageDataUrl.trim()) missingFields.push("posterImageDataUrl");
  if (draft.ticketTypes.length === 0) missingFields.push("ticketTypes");

  draft.ticketTypes.forEach((tier, index) => {
    if (!tier.name.trim()) missingFields.push(`ticketTypes.${index}.name`);
    if (tier.price < 0) missingFields.push(`ticketTypes.${index}.price`);
    if (tier.quantity <= 0) missingFields.push(`ticketTypes.${index}.quantity`);
    if (tier.perks.length === 0) warnings.push(`ticketTypes.${index}.perks`);
  });

  return {
    isPublishReady: missingFields.length === 0,
    missingFields,
    warnings
  };
}

export function buildEventCreatePayload(draft: EventCreateDraft): EventCreatePayload {
  return {
    title: draft.title.trim(),
    city: draft.city.trim(),
    venue: draft.venue.trim(),
    startAt: draft.startAt,
    endAt: draft.endAt,
    status: "draft",
    metadata: {
      category: draft.category.trim(),
      address: draft.address.trim(),
      description: draft.description.trim(),
      lineup: draft.lineup.map((item) => item.trim()).filter(Boolean),
      heroImageDataUrl: draft.heroImageDataUrl,
      posterImageDataUrl: draft.posterImageDataUrl
    },
    ticketTypes: draft.ticketTypes.map((tier) => ({
      id: tier.id,
      name: tier.name.trim(),
      price: tier.price,
      quantity: tier.quantity,
      perks: tier.perks.map((item) => item.trim()).filter(Boolean)
    }))
  };
}

export function buildEventPreview(draft: EventCreateDraft) {
  const prices = draft.ticketTypes.map((tier) => tier.price);
  const min = prices.length > 0 ? Math.min(...prices) : 0;
  const max = prices.length > 0 ? Math.max(...prices) : 0;

  return {
    event: {
      id: "draft",
      name: draft.title || "Untitled event",
      category: draft.category || "Sự kiện",
      date: draft.startAt ? formatDateTime(draft.startAt) : "Chưa chọn ngày",
      time:
        draft.startAt && draft.endAt
          ? `${formatDateTime(draft.startAt)} - ${formatDateTime(draft.endAt)}`
          : "Chưa chọn giờ",
      location: draft.venue || "Chưa chọn địa điểm",
      address: draft.address || `${draft.venue}, ${draft.city}`,
      price: { min, max },
      description: draft.description || "Chưa có mô tả.",
      lineup: draft.lineup,
      attendees: 0,
      heroImageDataUrl: draft.heroImageDataUrl || undefined
    },
    tiers: draft.ticketTypes.map((tier) => ({
      name: tier.name || "Unnamed tier",
      price: formatVnd(tier.price),
      perks: tier.perks
    }))
  };
}
```

- [ ] **Step 4: Run organizer domain tests**

Run:

```bash
pnpm --filter @ticket-platform/app-organizer-portal test:domain
pnpm --filter @ticket-platform/app-organizer-portal typecheck
```

Expected: both pass.

- [ ] **Step 5: Commit**

```bash
git add apps/organizer-portal/src/domain/event-create.ts apps/organizer-portal/src/domain/event-create.test.ts
git commit -m "organizer-portal: add event create model"
```

---

## Task 7: Organizer API Adapter And Media Helper

**Files:**

- Modify: `apps/organizer-portal/src/lib/organizer-api.ts`
- Create: `apps/organizer-portal/src/lib/media.ts`

- [ ] **Step 1: Extend organizer API types and methods**

Modify `apps/organizer-portal/src/lib/organizer-api.ts`:

```ts
import type { EventCreatePayload } from "../domain/event-create";

export interface OrganizerEventMetadata {
  category: string;
  address: string;
  description: string;
  lineup: string[];
  heroImageDataUrl: string;
  posterImageDataUrl: string;
}

export interface OrganizerTicketType {
  id: string;
  name: string;
  price: number;
  quantity: number;
  soldCount: number;
  perks: string[];
}

export interface OrganizerEventDetail {
  id: string;
  organizerId: string;
  title: string;
  city: string;
  venue: string;
  startAt: string;
  endAt: string;
  status: "draft" | "in_review" | "active" | "cancelled";
  metadata: OrganizerEventMetadata | null;
  ticketTypes: OrganizerTicketType[];
}
```

Extend `OrganizerApi`:

```ts
createEvent(input: EventCreatePayload): Promise<OrganizerEventDetail>;
getEvent(eventId: string): Promise<OrganizerEventDetail>;
updateEvent(eventId: string, input: Partial<EventCreatePayload>): Promise<OrganizerEventDetail>;
submitEventForReview(eventId: string): Promise<OrganizerEventDetail>;
devPublishEvent(eventId: string): Promise<OrganizerEventDetail>;
```

Implement in `DemoOrganizerApi` using in-memory `Map<string, OrganizerEventDetail>`. Keep existing `getSnapshot`.

Add `HttpOrganizerApi`:

```ts
export class HttpOrganizerApi implements OrganizerApi {
  constructor(private readonly organizerId = "org_rockfest") {}

  async getSnapshot(): Promise<OrganizerSnapshot> {
    return demoOrganizerSnapshot;
  }

  async createEvent(input: EventCreatePayload): Promise<OrganizerEventDetail> {
    const body = await requestJson<{ success: true; data: OrganizerEventDetail }>("/v1/events", {
      method: "POST",
      organizerId: this.organizerId,
      body: JSON.stringify(input)
    });
    return body.data;
  }

  async getEvent(eventId: string): Promise<OrganizerEventDetail> {
    const body = await requestJson<{ success: true; data: OrganizerEventDetail }>(
      `/v1/events/${eventId}`
    );
    return body.data;
  }

  async updateEvent(
    eventId: string,
    input: Partial<EventCreatePayload>
  ): Promise<OrganizerEventDetail> {
    const body = await requestJson<{ success: true; data: OrganizerEventDetail }>(
      `/v1/events/${eventId}`,
      {
        method: "PUT",
        organizerId: this.organizerId,
        body: JSON.stringify(input)
      }
    );
    return body.data;
  }

  async submitEventForReview(eventId: string): Promise<OrganizerEventDetail> {
    const body = await requestJson<{ success: true; data: OrganizerEventDetail }>(
      `/v1/events/${eventId}/submit-review`,
      {
        method: "POST",
        organizerId: this.organizerId
      }
    );
    return body.data;
  }

  async devPublishEvent(eventId: string): Promise<OrganizerEventDetail> {
    const body = await requestJson<{ success: true; data: OrganizerEventDetail }>(
      `/v1/events/${eventId}/dev-publish`,
      {
        method: "POST",
        organizerId: this.organizerId
      }
    );
    return body.data;
  }
}
```

Set the default API to `new HttpOrganizerApi()` if `import.meta.env.VITE_USE_DEMO_ORGANIZER_API !== "1"`, otherwise demo:

```ts
export const defaultOrganizerApi: OrganizerApi =
  import.meta.env.VITE_USE_DEMO_ORGANIZER_API === "1"
    ? new DemoOrganizerApi()
    : new HttpOrganizerApi();
```

- [ ] **Step 2: Create media helper**

Create `apps/organizer-portal/src/lib/media.ts`:

```ts
export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
      } else {
        reject(new Error("Unable to read file as data URL"));
      }
    };
    reader.onerror = () => reject(reader.error ?? new Error("Unable to read file"));
    reader.readAsDataURL(file);
  });
}
```

- [ ] **Step 3: Run typecheck**

Run:

```bash
pnpm --filter @ticket-platform/app-organizer-portal typecheck
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/organizer-portal/src/lib/organizer-api.ts apps/organizer-portal/src/lib/media.ts
git commit -m "organizer-portal: add event write adapter"
```

---

## Task 8: Organizer Preview Component

**Files:**

- Create: `apps/organizer-portal/src/components/EventDetailPreview.tsx`

- [ ] **Step 1: Create preview component**

Create `apps/organizer-portal/src/components/EventDetailPreview.tsx`:

```tsx
import { Calendar, Clock, MapPin, Users } from "lucide-react";
import { formatVnd } from "@/lib/format";

interface EventDetailPreviewProps {
  preview: {
    event: {
      name: string;
      category: string;
      date: string;
      time: string;
      location: string;
      address: string;
      price: { min: number; max: number };
      description: string;
      lineup: string[];
      attendees: number;
      heroImageDataUrl?: string;
    };
    tiers: Array<{ name: string; price: string; perks: string[] }>;
  };
}

export function EventDetailPreview({ preview }: EventDetailPreviewProps) {
  const { event, tiers } = preview;
  const selectedTier = tiers[0];

  return (
    <div className="overflow-hidden rounded-lg border border-[--op-border] bg-slate-950 text-white shadow-sm">
      <div className="relative aspect-[4/3] bg-slate-800">
        {event.heroImageDataUrl ? (
          <img
            src={event.heroImageDataUrl}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-4">
          <p className="font-mono text-[10px] uppercase tracking-widest text-white/60">
            {event.category}
          </p>
          <h3 className="mt-1 text-2xl font-semibold tracking-tight">{event.name}</h3>
        </div>
      </div>
      <div className="grid grid-cols-2 border-b border-white/10">
        <div className="border-r border-white/10 p-4">
          <div className="mb-1 flex items-center gap-2 text-white/60">
            <Calendar className="h-3.5 w-3.5" />
            <span className="font-mono text-[10px]">NGÀY</span>
          </div>
          <p className="text-sm font-medium">{event.date}</p>
        </div>
        <div className="p-4">
          <div className="mb-1 flex items-center gap-2 text-white/60">
            <Clock className="h-3.5 w-3.5" />
            <span className="font-mono text-[10px]">GIỜ</span>
          </div>
          <p className="text-sm font-medium">{event.time}</p>
        </div>
      </div>
      <div className="border-b border-white/10 p-4">
        <div className="flex items-start gap-3">
          <MapPin className="mt-1 h-4 w-4 text-white/60" />
          <div>
            <p className="font-medium">{event.location}</p>
            <p className="mt-0.5 font-mono text-xs text-white/50">{event.address}</p>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-3 border-b border-white/10 p-4">
        <Users className="h-4 w-4 text-white/60" />
        <span className="font-mono text-sm">
          {event.attendees.toLocaleString("en")} người tham dự
        </span>
      </div>
      <div className="border-b border-white/10 p-4">
        <p className="mb-3 font-mono text-xs tracking-widest text-white/60">[ GIỚI THIỆU ]</p>
        <p className="text-sm leading-relaxed text-white/80">{event.description}</p>
      </div>
      <div className="border-b border-white/10 p-4">
        <p className="mb-3 font-mono text-xs tracking-widest text-white/60">[ DÀN NGHỆ SĨ ]</p>
        {event.lineup.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {event.lineup.map((artist) => (
              <span key={artist} className="border border-white/20 px-3 py-1.5 font-mono text-xs">
                {artist}
              </span>
            ))}
          </div>
        ) : (
          <p className="font-mono text-xs text-white/40">
            event-service hiện chưa cung cấp lineup chi tiết.
          </p>
        )}
      </div>
      <div className="p-4">
        <p className="mb-4 font-mono text-xs tracking-widest text-white/60">[ CHỌN VÉ ]</p>
        <div className="space-y-3">
          {tiers.map((tier) => (
            <div key={tier.name} className="border border-white/20 p-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="font-medium">{tier.name}</span>
                <span className="font-mono text-lg">{tier.price}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {tier.perks.map((perk) => (
                  <span key={perk} className="font-mono text-[10px] text-white/50">
                    • {perk}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
        <button
          type="button"
          className="mt-4 w-full bg-white py-3 font-mono text-sm tracking-wider text-slate-950"
        >
          MUA {selectedTier?.name.toUpperCase() ?? "VÉ"} —{" "}
          {selectedTier?.price ?? formatVnd(event.price.min)}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Run typecheck**

Run:

```bash
pnpm --filter @ticket-platform/app-organizer-portal typecheck
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/organizer-portal/src/components/EventDetailPreview.tsx
git commit -m "organizer-portal: add event detail preview"
```

---

## Task 9: Organizer Create Wizard Routes

**Files:**

- Create: `apps/organizer-portal/src/pages/EventCreatePage.tsx`
- Modify: `apps/organizer-portal/src/pages/EventsPage.tsx`
- Modify: `apps/organizer-portal/src/App.tsx`

- [ ] **Step 1: Create wizard page**

Create `apps/organizer-portal/src/pages/EventCreatePage.tsx` with:

```tsx
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, ImagePlus, Plus, Save, Trash2 } from "lucide-react";
import { EventDetailPreview } from "@/components/EventDetailPreview";
import {
  buildEventCreatePayload,
  buildEventPreview,
  createEmptyEventDraft,
  validateEventDraft,
  type EventCreateDraft
} from "@/domain/event-create";
import { defaultOrganizerApi } from "@/lib/organizer-api";
import { fileToDataUrl } from "@/lib/media";

const api = defaultOrganizerApi;
const steps = ["Basic info", "Story & media", "Tickets", "Review gates"];

function toIsoFromLocalDateTime(value: string) {
  return value ? new Date(value).toISOString() : "";
}

export function EventCreatePage() {
  const navigate = useNavigate();
  const [stepIndex, setStepIndex] = useState(0);
  const [draft, setDraft] = useState<EventCreateDraft>(() => createEmptyEventDraft());
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const validation = useMemo(() => validateEventDraft(draft), [draft]);
  const preview = useMemo(() => buildEventPreview(draft), [draft]);

  function updateDraft(next: Partial<EventCreateDraft>) {
    setDraft((current) => ({ ...current, ...next }));
  }

  async function saveDraft() {
    setIsSaving(true);
    setError(null);
    try {
      const created = await api.createEvent(buildEventCreatePayload(draft));
      navigate(`/events/${created.id}/review`);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to save draft event");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleImage(field: "heroImageDataUrl" | "posterImageDataUrl", file?: File) {
    if (!file) return;
    updateDraft({ [field]: await fileToDataUrl(file) });
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[220px_1fr_360px]">
      <aside className="rounded-lg border border-[--op-border] bg-white p-4 shadow-sm">
        <p className="text-xs font-semibold uppercase text-[--op-muted]">Create event</p>
        <nav className="mt-4 space-y-2">
          {steps.map((step, index) => (
            <button
              key={step}
              type="button"
              onClick={() => setStepIndex(index)}
              className={`flex min-h-10 w-full items-center rounded-md px-3 text-left text-sm font-semibold ${
                stepIndex === index
                  ? "bg-blue-50 text-blue-700"
                  : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              {index + 1}. {step}
            </button>
          ))}
        </nav>
        <div className="mt-5 rounded-md border border-[--op-border] bg-slate-50 p-3 text-xs text-[--op-muted]">
          <p className="font-semibold text-slate-700">Draft health</p>
          <p>{validation.missingFields.length} missing fields</p>
          <p>{validation.warnings.length} warnings</p>
        </div>
      </aside>

      <section className="rounded-lg border border-[--op-border] bg-white p-5 shadow-sm">
        {error ? (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        {stepIndex === 0 && (
          <div className="grid gap-4">
            <input
              className="min-h-10 rounded-md border border-[--op-border] px-3"
              placeholder="Event title"
              value={draft.title}
              onChange={(event) => updateDraft({ title: event.target.value })}
            />
            <input
              className="min-h-10 rounded-md border border-[--op-border] px-3"
              placeholder="Category"
              value={draft.category}
              onChange={(event) => updateDraft({ category: event.target.value })}
            />
            <div className="grid gap-4 md:grid-cols-2">
              <input
                className="min-h-10 rounded-md border border-[--op-border] px-3"
                placeholder="City"
                value={draft.city}
                onChange={(event) => updateDraft({ city: event.target.value })}
              />
              <input
                className="min-h-10 rounded-md border border-[--op-border] px-3"
                placeholder="Venue"
                value={draft.venue}
                onChange={(event) => updateDraft({ venue: event.target.value })}
              />
            </div>
            <input
              className="min-h-10 rounded-md border border-[--op-border] px-3"
              placeholder="Address"
              value={draft.address}
              onChange={(event) => updateDraft({ address: event.target.value })}
            />
            <div className="grid gap-4 md:grid-cols-2">
              <input
                className="min-h-10 rounded-md border border-[--op-border] px-3"
                type="datetime-local"
                value={draft.startAt.slice(0, 16)}
                onChange={(event) =>
                  updateDraft({ startAt: toIsoFromLocalDateTime(event.target.value) })
                }
              />
              <input
                className="min-h-10 rounded-md border border-[--op-border] px-3"
                type="datetime-local"
                value={draft.endAt.slice(0, 16)}
                onChange={(event) =>
                  updateDraft({ endAt: toIsoFromLocalDateTime(event.target.value) })
                }
              />
            </div>
          </div>
        )}

        {stepIndex === 1 && (
          <div className="grid gap-4">
            <textarea
              className="min-h-32 rounded-md border border-[--op-border] p-3"
              placeholder="Description"
              value={draft.description}
              onChange={(event) => updateDraft({ description: event.target.value })}
            />
            <input
              className="min-h-10 rounded-md border border-[--op-border] px-3"
              placeholder="Lineup, comma separated"
              value={draft.lineup.join(", ")}
              onChange={(event) =>
                updateDraft({
                  lineup: event.target.value
                    .split(",")
                    .map((item) => item.trim())
                    .filter(Boolean)
                })
              }
            />
            <label className="flex min-h-28 cursor-pointer items-center justify-center rounded-md border border-dashed border-blue-200 bg-blue-50 text-sm font-semibold text-blue-700">
              <ImagePlus className="mr-2 h-4 w-4" />
              Upload hero image
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(event) => void handleImage("heroImageDataUrl", event.target.files?.[0])}
              />
            </label>
            <label className="flex min-h-28 cursor-pointer items-center justify-center rounded-md border border-dashed border-blue-200 bg-blue-50 text-sm font-semibold text-blue-700">
              <ImagePlus className="mr-2 h-4 w-4" />
              Upload poster image
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(event) =>
                  void handleImage("posterImageDataUrl", event.target.files?.[0])
                }
              />
            </label>
          </div>
        )}

        {stepIndex === 2 && (
          <div className="space-y-4">
            {draft.ticketTypes.map((tier, index) => (
              <div key={index} className="rounded-lg border border-[--op-border] p-4">
                <div className="grid gap-3 md:grid-cols-3">
                  <input
                    className="min-h-10 rounded-md border border-[--op-border] px-3"
                    placeholder="Tier name"
                    value={tier.name}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        ticketTypes: current.ticketTypes.map((item, itemIndex) =>
                          itemIndex === index ? { ...item, name: event.target.value } : item
                        )
                      }))
                    }
                  />
                  <input
                    className="min-h-10 rounded-md border border-[--op-border] px-3"
                    type="number"
                    placeholder="Price"
                    value={tier.price}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        ticketTypes: current.ticketTypes.map((item, itemIndex) =>
                          itemIndex === index
                            ? { ...item, price: Number(event.target.value) }
                            : item
                        )
                      }))
                    }
                  />
                  <input
                    className="min-h-10 rounded-md border border-[--op-border] px-3"
                    type="number"
                    placeholder="Quantity"
                    value={tier.quantity}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        ticketTypes: current.ticketTypes.map((item, itemIndex) =>
                          itemIndex === index
                            ? { ...item, quantity: Number(event.target.value) }
                            : item
                        )
                      }))
                    }
                  />
                </div>
                <input
                  className="mt-3 min-h-10 w-full rounded-md border border-[--op-border] px-3"
                  placeholder="Perks, comma separated"
                  value={tier.perks.join(", ")}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      ticketTypes: current.ticketTypes.map((item, itemIndex) =>
                        itemIndex === index
                          ? {
                              ...item,
                              perks: event.target.value
                                .split(",")
                                .map((perk) => perk.trim())
                                .filter(Boolean)
                            }
                          : item
                      )
                    }))
                  }
                />
                <button
                  type="button"
                  className="mt-3 inline-flex min-h-9 items-center gap-2 text-sm font-semibold text-red-700"
                  onClick={() =>
                    setDraft((current) => ({
                      ...current,
                      ticketTypes: current.ticketTypes.filter((_, itemIndex) => itemIndex !== index)
                    }))
                  }
                >
                  <Trash2 className="h-4 w-4" />
                  Remove tier
                </button>
              </div>
            ))}
            <button
              type="button"
              className="inline-flex min-h-10 items-center gap-2 rounded-md border border-[--op-border] px-3 text-sm font-semibold"
              onClick={() =>
                setDraft((current) => ({
                  ...current,
                  ticketTypes: [
                    ...current.ticketTypes,
                    { name: "", price: 0, quantity: 1, perks: [] }
                  ]
                }))
              }
            >
              <Plus className="h-4 w-4" />
              Add tier
            </button>
          </div>
        )}

        {stepIndex === 3 && (
          <div>
            <h2 className="text-lg font-semibold">Review gates</h2>
            <div className="mt-4 grid gap-3">
              {validation.missingFields.length === 0 ? (
                <p className="rounded-md border border-green-200 bg-green-50 p-3 text-green-700">
                  Ready to continue to review.
                </p>
              ) : null}
              {validation.missingFields.map((field) => (
                <p
                  key={field}
                  className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800"
                >
                  {field} is required before publish.
                </p>
              ))}
              {validation.warnings.map((field) => (
                <p
                  key={field}
                  className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700"
                >
                  {field} has no perks.
                </p>
              ))}
            </div>
          </div>
        )}

        <div className="mt-6 flex items-center justify-between border-t border-[--op-border] pt-4">
          <button
            type="button"
            className="inline-flex min-h-10 items-center gap-2 rounded-md border border-[--op-border] px-3 text-sm font-semibold"
            onClick={() => void saveDraft()}
            disabled={isSaving}
          >
            <Save className="h-4 w-4" />
            Save draft
          </button>
          <button
            type="button"
            className="inline-flex min-h-10 items-center gap-2 rounded-md bg-blue-600 px-3 text-sm font-semibold text-white"
            onClick={() =>
              stepIndex < steps.length - 1 ? setStepIndex(stepIndex + 1) : void saveDraft()
            }
          >
            {stepIndex < steps.length - 1 ? "Next" : "Continue to review"}
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </section>

      <aside className="xl:sticky xl:top-5 xl:self-start">
        <EventDetailPreview preview={preview} />
      </aside>
    </div>
  );
}
```

When implementing, split repeated form controls into small local helper components if the file exceeds 350 lines after formatting. The behavior and routes must stay identical.

- [ ] **Step 2: Wire routes**

Modify `apps/organizer-portal/src/App.tsx`:

```tsx
import { EventCreatePage } from "@/pages/EventCreatePage";
```

Add metadata:

```ts
"/events/new": {
  title: "Create Event",
  description: "Build a draft event with attendee-facing details and ticket tiers."
}
```

Add route:

```tsx
<Route path="/events/new" element={<EventCreatePage />} />
```

- [ ] **Step 3: Wire Events page button**

Modify the Create event button in `apps/organizer-portal/src/pages/EventsPage.tsx` to use `Link`:

```tsx
import { Link } from "react-router-dom";
```

Replace action button with:

```tsx
<Link
  to="/events/new"
  className="inline-flex min-h-10 items-center gap-2 rounded-md bg-blue-600 px-3 text-sm font-semibold text-white hover:bg-blue-700"
>
  <CalendarPlus className="h-4 w-4" />
  Create event
</Link>
```

- [ ] **Step 4: Run organizer checks**

Run:

```bash
pnpm --filter @ticket-platform/app-organizer-portal test:domain
pnpm --filter @ticket-platform/app-organizer-portal typecheck
pnpm --filter @ticket-platform/app-organizer-portal build
```

Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add apps/organizer-portal/src/pages/EventCreatePage.tsx apps/organizer-portal/src/pages/EventsPage.tsx apps/organizer-portal/src/App.tsx
git commit -m "organizer-portal: add create event wizard"
```

---

## Task 10: Organizer Review Page

**Files:**

- Create: `apps/organizer-portal/src/pages/EventReviewPage.tsx`
- Modify: `apps/organizer-portal/src/App.tsx`

- [ ] **Step 1: Create review page**

Create `apps/organizer-portal/src/pages/EventReviewPage.tsx`:

```tsx
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { CheckCircle2, Rocket, Send } from "lucide-react";
import { DataPanel } from "@/components/DataPanel";
import { EventDetailPreview } from "@/components/EventDetailPreview";
import { StatusBadge } from "@/components/StatusBadge";
import {
  buildEventPreview,
  createEmptyEventDraft,
  validateEventDraft,
  type EventCreateDraft
} from "@/domain/event-create";
import { defaultOrganizerApi, type OrganizerEventDetail } from "@/lib/organizer-api";

const api = defaultOrganizerApi;

function eventToDraft(event: OrganizerEventDetail): EventCreateDraft {
  return {
    ...createEmptyEventDraft(),
    title: event.title,
    city: event.city,
    venue: event.venue,
    startAt: event.startAt,
    endAt: event.endAt,
    category: event.metadata?.category ?? "",
    address: event.metadata?.address ?? "",
    description: event.metadata?.description ?? "",
    lineup: event.metadata?.lineup ?? [],
    heroImageDataUrl: event.metadata?.heroImageDataUrl ?? "",
    posterImageDataUrl: event.metadata?.posterImageDataUrl ?? "",
    ticketTypes: event.ticketTypes.map((tier) => ({
      id: tier.id,
      name: tier.name,
      price: tier.price,
      quantity: tier.quantity,
      perks: tier.perks
    }))
  };
}

export function EventReviewPage() {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const [event, setEvent] = useState<OrganizerEventDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!eventId) return;
    void api
      .getEvent(eventId)
      .then(setEvent)
      .catch((nextError) => {
        setError(nextError instanceof Error ? nextError.message : "Unable to load event");
      });
  }, [eventId]);

  const draft = useMemo(() => (event ? eventToDraft(event) : createEmptyEventDraft()), [event]);
  const preview = useMemo(() => buildEventPreview(draft), [draft]);
  const validation = useMemo(() => validateEventDraft(draft), [draft]);

  async function runAction(action: "submit" | "publish") {
    if (!eventId) return;
    setIsSaving(true);
    setError(null);
    try {
      const next =
        action === "submit"
          ? await api.submitEventForReview(eventId)
          : await api.devPublishEvent(eventId);
      setEvent(next);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to update event");
    } finally {
      setIsSaving(false);
    }
  }

  if (!event && !error) {
    return (
      <div className="rounded-lg border border-[--op-border] bg-white p-6">
        Loading event review...
      </div>
    );
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_380px]">
      <div className="space-y-5">
        {error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">{error}</div>
        ) : null}
        {event ? (
          <DataPanel
            title={event.title}
            description="Review attendee-facing detail before submitting or dev publishing."
            action={<StatusBadge status={event.status} label={event.status} />}
          >
            <div className="grid gap-3">
              {validation.missingFields.length === 0 ? (
                <div className="flex items-center gap-2 rounded-md border border-green-200 bg-green-50 p-3 text-green-700">
                  <CheckCircle2 className="h-4 w-4" />
                  Ready for review or dev publish.
                </div>
              ) : null}
              {validation.missingFields.map((field) => (
                <div
                  key={field}
                  className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800"
                >
                  {field} is required before review.
                </div>
              ))}
            </div>
            <div className="mt-5 flex flex-wrap gap-3">
              <button
                type="button"
                disabled={isSaving || !validation.isPublishReady}
                onClick={() => void runAction("submit")}
                className="inline-flex min-h-10 items-center gap-2 rounded-md border border-[--op-border] px-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Send className="h-4 w-4" />
                Submit for review
              </button>
              <button
                type="button"
                disabled={isSaving || !validation.isPublishReady}
                onClick={() => void runAction("publish")}
                className="inline-flex min-h-10 items-center gap-2 rounded-md bg-blue-600 px-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Rocket className="h-4 w-4" />
                Dev publish
              </button>
              {event.status === "draft" ? (
                <Link
                  to={`/events/${event.id}/edit`}
                  className="inline-flex min-h-10 items-center rounded-md border border-[--op-border] px-3 text-sm font-semibold"
                >
                  Back to edit
                </Link>
              ) : null}
              <button
                type="button"
                onClick={() => navigate("/events")}
                className="inline-flex min-h-10 items-center rounded-md border border-[--op-border] px-3 text-sm font-semibold"
              >
                Back to events
              </button>
            </div>
          </DataPanel>
        ) : null}
      </div>
      <EventDetailPreview preview={preview} />
    </div>
  );
}
```

- [ ] **Step 2: Wire review route**

Modify `apps/organizer-portal/src/App.tsx`:

```tsx
import { EventReviewPage } from "@/pages/EventReviewPage";
```

Add metadata:

```ts
"/events/review": {
  title: "Review Event",
  description: "Validate attendee-facing details before submitting or publishing."
}
```

Because the route contains an id, update meta lookup:

```ts
const meta = location.pathname.match(/^\/events\/[^/]+\/review$/)
  ? {
      title: "Review Event",
      description: "Validate attendee-facing details before submitting or publishing."
    }
  : (pageMeta[location.pathname] ?? {
      title: "Organizer Portal",
      description: "Manage event operations for your organizer account."
    });
```

Add route:

```tsx
<Route path="/events/:eventId/review" element={<EventReviewPage />} />
```

- [ ] **Step 3: Run organizer checks**

Run:

```bash
pnpm --filter @ticket-platform/app-organizer-portal test:domain
pnpm --filter @ticket-platform/app-organizer-portal typecheck
pnpm --filter @ticket-platform/app-organizer-portal build
```

Expected: all pass.

- [ ] **Step 4: Commit**

```bash
git add apps/organizer-portal/src/pages/EventReviewPage.tsx apps/organizer-portal/src/App.tsx
git commit -m "organizer-portal: add event review actions"
```

---

## Task 11: End-To-End Verification And Polish

**Files:**

- Modify only files from earlier tasks if verification reveals defects.

- [ ] **Step 1: Run all targeted checks**

Run:

```bash
pnpm --filter @ticket-platform/svc-event-service test
pnpm --filter @ticket-platform/svc-event-service typecheck
pnpm --filter @ticket-platform/sdk-client test:events
pnpm --filter @ticket-platform/sdk-client typecheck
pnpm --filter @ticket-platform/shared-types typecheck
pnpm --filter @ticket-platform/app-web test:event-adapters
pnpm --filter @ticket-platform/app-web test:ui-home-discover
pnpm --filter @ticket-platform/app-web typecheck
pnpm --filter @ticket-platform/app-web build
pnpm --filter @ticket-platform/app-organizer-portal test:domain
pnpm --filter @ticket-platform/app-organizer-portal typecheck
pnpm --filter @ticket-platform/app-organizer-portal build
```

Expected: all pass.

- [ ] **Step 2: Start organizer portal**

Run:

```bash
pnpm --filter @ticket-platform/app-organizer-portal dev
```

Expected: app is available at `http://localhost:5178`.

- [ ] **Step 3: Manual flow check**

In browser:

1. Open `http://localhost:5178/events`.
2. Click `Create event`.
3. Confirm route changes to `/events/new`.
4. Fill Basic info.
5. Add description, lineup, hero image, and poster image.
6. Add at least one ticket tier with perks.
7. Confirm live preview updates category/title/image/description/lineup/tier perks.
8. Continue to review.
9. Confirm review route shows readiness checklist and preview.
10. Click `Submit for review`; status becomes `in_review`.
11. Create another draft and click `Dev publish`; status becomes `active`.

- [ ] **Step 4: Manual attendee check**

With event-service/api-gateway running:

1. Create and dev-publish an event from organizer portal.
2. Open attendee `apps/web` Discover.
3. Confirm the event appears only after dev publish.
4. Open its Event Detail.
5. Confirm hero image, category, address, description, lineup, and ticket perks match organizer input.

- [ ] **Step 5: Fix visual defects**

If layout issues appear:

- On `375px`, ensure wizard stepper is horizontal and form/preview do not overlap.
- On `768px`, ensure preview moves below or remains readable.
- On `1024px` and `1440px`, ensure three-column layout does not overflow.
- If text overflows buttons or badges, adjust fixed grid widths or wrapping classes.

After each fix, rerun:

```bash
pnpm --filter @ticket-platform/app-organizer-portal typecheck
pnpm --filter @ticket-platform/app-organizer-portal build
```

- [ ] **Step 6: Commit final polish**

If files changed:

```bash
git add services/event-service packages/sdk-client packages/shared-types apps/web apps/organizer-portal
git commit -m "organizer-portal: polish event create flow"
```

If no files changed, do not create an empty commit.

---

## Self-Review

Spec coverage:

- End-to-end backend/schema/API: Tasks 1 and 2.
- SDK and shared types: Tasks 3 and 4.
- apps/web detail/discover rendering: Tasks 4 and 5.
- Wizard layout A with persistent preview: Tasks 6, 8, and 9.
- Draft-first creation: Tasks 1, 2, 6, 7, and 9.
- Review page with Submit for review and Dev publish: Tasks 1, 2, 7, and 10.
- Local/mock upload as data URL: Tasks 6, 7, and 9.
- Ticket perks: Tasks 1 through 6.
- Validation and error handling: Tasks 1, 2, 6, 9, and 10.
- Final verification and manual checks: Task 11.

No production media storage, platform-admin approval UI, seat maps, sale windows, rich text editor, or role-management work is included.
