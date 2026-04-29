# My Tickets Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a reliable My Tickets list and ticket detail flow with backend-issued short-lived QR as the production QR path.

**Architecture:** Keep ticket ownership resolution in focused library modules, then let route components consume those view models. The ticket detail page uses React Query to fetch short-lived QR payloads from ticketing-service and a local timer for countdown; local QR is a clearly labeled degraded fallback only.

**Tech Stack:** React 18, React Router, React Query, TypeScript, Tailwind, lucide-react, `react-qr-code`, node:test.

---

## File Structure

- Modify `packages/sdk-client/src/index.ts`: add QR payload type and `createTicketQr`.
- Modify `apps/web/package.json`: add `react-qr-code`.
- Modify `apps/web/src/lib/synced-tickets.ts`: enrich metadata and merge output source.
- Modify `apps/web/src/lib/ticket-loader.ts`: return richer ticket view models and helper lookup.
- Create `apps/web/src/lib/ticket-qr.ts`: QR payload serialization, local fallback payload builder, TTL helpers.
- Create `apps/web/src/hooks/use-ticket-detail.ts`: resolve a single ticket by token id.
- Create `apps/web/src/hooks/use-ticket-qr.ts`: backend QR fetching, countdown state, local fallback state.
- Modify `apps/web/src/components/mobile/TicketCard.tsx`: add status/source presentation without breaking compact list.
- Create `apps/web/src/components/mobile/TicketQrPanel.tsx`: QR display panel.
- Create `apps/web/src/pages/TicketDetailPage.tsx`: full wallet pass detail screen.
- Modify `apps/web/src/pages/TicketsPage.tsx`: loading, partial, empty, and enriched cards.
- Modify `apps/web/src/App.tsx`: add `/ticket/:id`.
- Add or update tests near touched modules.

---

### Task 1: Install QR Renderer

**Files:**

- Modify: `apps/web/package.json`
- Modify: `pnpm-lock.yaml`

- [ ] **Step 1: Add dependency**

Run:

```bash
pnpm --dir apps/web add react-qr-code
```

Expected: `apps/web/package.json` includes `react-qr-code`, and `pnpm-lock.yaml` updates.

- [ ] **Step 2: Verify dependency resolution**

Run:

```bash
pnpm --dir apps/web typecheck
```

Expected: TypeScript completes with exit code 0 or only fails on missing code that later tasks intentionally add.

- [ ] **Step 3: Commit**

```bash
git add apps/web/package.json pnpm-lock.yaml
git commit -m "web: add QR renderer"
```

---

### Task 2: Add SDK QR API

**Files:**

- Modify: `packages/sdk-client/src/index.ts`
- Test: `packages/sdk-client/src/index.ts` via existing build/typecheck; add test only if this package has nearby client request tests.

- [ ] **Step 1: Write the failing SDK test or type assertion**

If the SDK has a request-path test harness, add a test proving `createTicketQr("42", { userId: "buyer" })` calls:

```text
POST /v1/tickets/42/qr
x-user-id: buyer
```

If no harness exists, continue with the typecheck validation in Step 4 and keep the implementation minimal.

- [ ] **Step 2: Add QR response type**

Add near `TicketRecord`:

```ts
export interface TicketQrData {
  tokenId: string;
  eventId: string;
  timestamp: number;
  nonce: string;
  walletAddress: string;
  signature: string;
}
```

- [ ] **Step 3: Add client method**

Add to `ApiClient`:

```ts
async createTicketQr(
  tokenId: string,
  ctx: { userId: string; idempotencyKey?: string }
): Promise<ApiSuccessResponse<TicketQrData>> {
  return this.request(`/v1/tickets/${encodeURIComponent(tokenId)}/qr`, {
    method: "POST",
    headers: {
      "x-user-id": ctx.userId,
      ...(ctx.idempotencyKey ? { "idempotency-key": ctx.idempotencyKey } : {})
    }
  });
}
```

- [ ] **Step 4: Verify**

Run:

```bash
pnpm --dir apps/web typecheck
```

Expected: no SDK type errors.

- [ ] **Step 5: Commit**

```bash
git add packages/sdk-client/src/index.ts
git commit -m "sdk: add ticket QR API"
```

---

### Task 3: Enrich Ticket Ownership View Models

**Files:**

- Modify: `apps/web/src/lib/synced-tickets.ts`
- Modify: `apps/web/src/lib/ticket-loader.ts`
- Modify: `apps/web/src/lib/adapters.ts` only if needed for mapping
- Test: `apps/web/src/lib/synced-tickets.test.ts`
- Test: `apps/web/src/lib/ticket-loader.test.ts`

- [ ] **Step 1: Write failing tests for ticket source and detail fields**

Add assertions to `apps/web/src/lib/ticket-loader.test.ts`:

```ts
assert.equal(result.tickets[0].source, "local-cache");
assert.equal(result.tickets[0].tokenId, "42");
assert.equal(result.tickets[0].ownerWalletAddress, "0xbuyer");
assert.equal(result.tickets[0].syncStatus, "partial");
```

Expected failure: `tickets` or fields do not exist.

- [ ] **Step 2: Extend local metadata**

In `PurchasedTicketMetadata`, keep existing fields and ensure these optional fields are supported:

```ts
transactionHash?: string;
source?: "primary-purchase" | "resale-purchase";
```

Keep storage backward compatible by accepting records without `source`.

- [ ] **Step 3: Add rich view type**

In `apps/web/src/lib/ticket-loader.ts`, add:

```ts
export type TicketDataSource = "ticketing" | "contract-sync" | "local-cache";
export type TicketSyncStatus = "ready" | "syncing" | "partial";

export interface TicketOwnershipView {
  id: string;
  tokenId: string;
  eventId: string;
  eventName: string;
  date: string;
  time: string;
  location: string;
  ticketType: string;
  qrCode?: string;
  ownerUserId: string;
  ownerWalletAddress: string | null;
  seatInfo: string;
  reservationId: string;
  createdAt: string;
  source: TicketDataSource;
  syncStatus: TicketSyncStatus;
  transactionHash?: string;
}
```

- [ ] **Step 4: Return both cards and rich tickets**

Update `LoadedTicketCards`:

```ts
export interface LoadedTicketCards {
  upcoming: TicketOwnershipView[];
  past: TicketOwnershipView[];
  tickets: TicketOwnershipView[];
  status: "ready" | "partial";
}
```

Build `TicketOwnershipView` from merged records and event map. Use `source` from merge decisions. If event detail is missing, use `"Dang cap nhat"` date, `"--:--"` time, `seatInfo` location, and keep the item upcoming.

- [ ] **Step 5: Verify**

Run:

```bash
node --test --experimental-strip-types apps/web/src/lib/synced-tickets.test.ts apps/web/src/lib/ticket-loader.test.ts
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/lib/synced-tickets.ts apps/web/src/lib/ticket-loader.ts apps/web/src/lib/synced-tickets.test.ts apps/web/src/lib/ticket-loader.test.ts
git commit -m "web: enrich ticket ownership models"
```

---

### Task 4: Add Ticket Detail Lookup Hook

**Files:**

- Create: `apps/web/src/hooks/use-ticket-detail.ts`
- Test: `apps/web/src/lib/ticket-loader.test.ts`

- [ ] **Step 1: Write failing lookup test**

Add a pure helper to `ticket-loader.ts`:

```ts
export function findTicketByTokenId(
  tickets: TicketOwnershipView[],
  tokenId: string
): TicketOwnershipView | null {
  return tickets.find((ticket) => ticket.tokenId === tokenId || ticket.id === tokenId) ?? null;
}
```

Test:

```ts
assert.equal(findTicketByTokenId(result.tickets, "42")?.eventId, "evt_rockfest_2026");
assert.equal(findTicketByTokenId(result.tickets, "missing"), null);
```

Expected failure: helper does not exist.

- [ ] **Step 2: Implement helper**

Add the exact helper above to `apps/web/src/lib/ticket-loader.ts`.

- [ ] **Step 3: Implement hook**

Create `apps/web/src/hooks/use-ticket-detail.ts`:

```ts
import { useMemo } from "react";
import { findTicketByTokenId } from "@/lib/ticket-loader";
import { useMyTickets } from "@/hooks/use-tickets";

export function useTicketDetail(tokenId: string | undefined) {
  const query = useMyTickets();
  const ticket = useMemo(
    () => (tokenId && query.data ? findTicketByTokenId(query.data.tickets, tokenId) : null),
    [query.data, tokenId]
  );

  return {
    ...query,
    ticket
  };
}
```

- [ ] **Step 4: Verify**

Run:

```bash
node --test --experimental-strip-types apps/web/src/lib/ticket-loader.test.ts
pnpm --dir apps/web typecheck
```

Expected: test and typecheck pass.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/ticket-loader.ts apps/web/src/lib/ticket-loader.test.ts apps/web/src/hooks/use-ticket-detail.ts
git commit -m "web: add ticket detail lookup"
```

---

### Task 5: Add QR Payload Helpers

**Files:**

- Create: `apps/web/src/lib/ticket-qr.ts`
- Test: `apps/web/src/lib/ticket-qr.test.ts`

- [ ] **Step 1: Write failing QR helper tests**

Create `apps/web/src/lib/ticket-qr.test.ts`:

```ts
import assert from "node:assert/strict";
import test from "node:test";
import {
  buildLocalTicketQrPayload,
  serializeTicketQrPayload,
  getTicketQrAgeMs,
  getTicketQrRefreshDelayMs
} from "./ticket-qr.ts";

test("serializeTicketQrPayload includes all scanner fields", () => {
  const value = serializeTicketQrPayload({
    tokenId: "42",
    eventId: "evt_1",
    timestamp: 1000,
    nonce: "nonce_1",
    walletAddress: "0xabc",
    signature: "sig",
    source: "backend"
  });
  assert.deepEqual(JSON.parse(value), {
    type: "entr.ticket.qr.v1",
    tokenId: "42",
    eventId: "evt_1",
    timestamp: 1000,
    nonce: "nonce_1",
    walletAddress: "0xabc",
    signature: "sig",
    source: "backend"
  });
});

test("buildLocalTicketQrPayload marks local QR clearly", () => {
  const payload = buildLocalTicketQrPayload({
    tokenId: "42",
    eventId: "evt_1",
    walletAddress: "0xabc",
    nowMs: 1000
  });
  assert.equal(payload.source, "local");
  assert.equal(payload.nonce, "local:42:1000");
  assert.equal(payload.signature.startsWith("local:"), true);
});

test("getTicketQrRefreshDelayMs refreshes before expiry", () => {
  assert.equal(getTicketQrAgeMs({ timestamp: 1000 }, 4000), 3000);
  assert.equal(getTicketQrRefreshDelayMs({ timestamp: 1000 }, 4000, 30000), 22000);
});
```

Expected failure: module missing.

- [ ] **Step 2: Implement helper module**

Create `apps/web/src/lib/ticket-qr.ts`:

```ts
import type { TicketQrData } from "@ticket-platform/sdk-client";

export type TicketQrSource = "backend" | "local";

export interface TicketQrPayload extends TicketQrData {
  source: TicketQrSource;
}

export function serializeTicketQrPayload(payload: TicketQrPayload): string {
  return JSON.stringify({
    type: "entr.ticket.qr.v1",
    tokenId: payload.tokenId,
    eventId: payload.eventId,
    timestamp: payload.timestamp,
    nonce: payload.nonce,
    walletAddress: payload.walletAddress,
    signature: payload.signature,
    source: payload.source
  });
}

export function buildLocalTicketQrPayload(input: {
  tokenId: string;
  eventId: string;
  walletAddress: string;
  nowMs?: number;
}): TicketQrPayload {
  const timestamp = input.nowMs ?? Date.now();
  const nonce = `local:${input.tokenId}:${timestamp}`;
  return {
    tokenId: input.tokenId,
    eventId: input.eventId,
    timestamp,
    nonce,
    walletAddress: input.walletAddress,
    signature: `local:${input.walletAddress}:${nonce}`,
    source: "local"
  };
}

export function getTicketQrAgeMs(
  payload: Pick<TicketQrPayload, "timestamp">,
  nowMs = Date.now()
): number {
  return Math.max(0, nowMs - payload.timestamp);
}

export function getTicketQrRefreshDelayMs(
  payload: Pick<TicketQrPayload, "timestamp">,
  nowMs = Date.now(),
  ttlMs = 30_000
): number {
  const refreshAt = payload.timestamp + ttlMs - 5_000;
  return Math.max(0, refreshAt - nowMs);
}
```

- [ ] **Step 3: Verify**

Run:

```bash
node --test --experimental-strip-types apps/web/src/lib/ticket-qr.test.ts
pnpm --dir apps/web typecheck
```

Expected: tests and typecheck pass.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/lib/ticket-qr.ts apps/web/src/lib/ticket-qr.test.ts
git commit -m "web: add ticket QR helpers"
```

---

### Task 6: Add QR Fetch and Refresh Hook

**Files:**

- Create: `apps/web/src/hooks/use-ticket-qr.ts`
- Test: `apps/web/src/lib/ticket-qr.test.ts` for pure timing only

- [ ] **Step 1: Define hook behavior**

The hook must:

- call `client.createTicketQr(tokenId, { userId })` for backend QR;
- mark returned payload as `source: "backend"`;
- start a local one-second countdown only after a payload exists;
- schedule backend refresh near expiry, not every second;
- use local QR when backend QR fails and ticket ownership metadata exists;
- expose `refresh()` for manual retry.

- [ ] **Step 2: Implement hook**

Create `apps/web/src/hooks/use-ticket-qr.ts`:

```ts
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useApiClient } from "@/providers/AppProviders";
import type { TicketOwnershipView } from "@/lib/ticket-loader";
import {
  buildLocalTicketQrPayload,
  getTicketQrRefreshDelayMs,
  serializeTicketQrPayload,
  type TicketQrPayload
} from "@/lib/ticket-qr";
import { getSessionUserId } from "@/lib/session";

const QR_TTL_MS = 30_000;

export function useTicketQr(ticket: TicketOwnershipView | null) {
  const client = useApiClient();
  const userId = getSessionUserId();
  const [nowMs, setNowMs] = useState(Date.now());

  const query = useQuery({
    queryKey: ["ticket-qr", ticket?.tokenId, userId],
    enabled: Boolean(ticket),
    retry: 1,
    queryFn: async (): Promise<TicketQrPayload> => {
      if (!ticket) {
        throw new Error("Ticket is required");
      }
      const response = await client.createTicketQr(ticket.tokenId, { userId });
      return { ...response.data, source: "backend" };
    }
  });

  const fallbackPayload = useMemo(() => {
    if (!ticket || !query.isError || !ticket.ownerWalletAddress) {
      return null;
    }
    return buildLocalTicketQrPayload({
      tokenId: ticket.tokenId,
      eventId: ticket.eventId,
      walletAddress: ticket.ownerWalletAddress,
      nowMs
    });
  }, [nowMs, query.isError, ticket]);

  const payload = query.data ?? fallbackPayload;
  const qrValue = payload ? serializeTicketQrPayload(payload) : "";
  const ageMs = payload ? Math.max(0, nowMs - payload.timestamp) : 0;
  const secondsRemaining = payload ? Math.max(0, Math.ceil((QR_TTL_MS - ageMs) / 1000)) : 0;

  useEffect(() => {
    if (!payload) return undefined;
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [payload]);

  useEffect(() => {
    if (!payload || payload.source !== "backend") return undefined;
    const delay = getTicketQrRefreshDelayMs(payload, Date.now(), QR_TTL_MS);
    const timer = window.setTimeout(() => {
      void query.refetch();
    }, delay);
    return () => window.clearTimeout(timer);
  }, [payload, query]);

  return {
    payload,
    qrValue,
    secondsRemaining,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isBackendError: query.isError,
    source: payload?.source ?? null,
    refresh: query.refetch
  };
}
```

- [ ] **Step 3: Verify**

Run:

```bash
pnpm --dir apps/web typecheck
```

Expected: typecheck passes.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/hooks/use-ticket-qr.ts
git commit -m "web: add ticket QR refresh hook"
```

---

### Task 7: Build Ticket QR Panel Component

**Files:**

- Create: `apps/web/src/components/mobile/TicketQrPanel.tsx`

- [ ] **Step 1: Implement component**

Create:

```tsx
import QRCode from "react-qr-code";
import { RefreshCw, ShieldCheck, WifiOff } from "lucide-react";

interface TicketQrPanelProps {
  value: string;
  source: "backend" | "local" | null;
  secondsRemaining: number;
  isLoading: boolean;
  isFetching: boolean;
  onRefresh: () => void;
}

export default function TicketQrPanel({
  value,
  source,
  secondsRemaining,
  isLoading,
  isFetching,
  onRefresh
}: TicketQrPanelProps) {
  const isLocal = source === "local";
  const label =
    source === "backend" ? "Backend QR" : source === "local" ? "Local QR" : "QR chua san sang";

  return (
    <section className="px-4 py-5">
      <div className="border border-foreground/20 bg-card p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {isLocal ? (
              <WifiOff className="h-4 w-4 text-yellow-300" />
            ) : (
              <ShieldCheck className="h-4 w-4 text-green-400" />
            )}
            <span className="font-mono text-[10px] uppercase tracking-widest text-foreground/60">
              {label}
            </span>
          </div>
          <button
            type="button"
            onClick={onRefresh}
            className="flex h-9 w-9 items-center justify-center border border-foreground/20 transition-colors hover:bg-foreground/10 disabled:opacity-50"
            disabled={isLoading || isFetching}
            aria-label="Lam moi QR"
          >
            <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
          </button>
        </div>

        <div className="mx-auto flex aspect-square w-full max-w-[280px] items-center justify-center bg-white p-4">
          {value ? (
            <QRCode value={value} size={240} bgColor="#ffffff" fgColor="#000000" />
          ) : (
            <span className="font-mono text-xs text-black/50">Dang tao QR</span>
          )}
        </div>

        <div className="mt-3 flex items-center justify-between gap-3 font-mono text-[10px] text-foreground/50">
          <span>{isLocal ? "Dung tam khi backend QR loi" : "QR ngan han"}</span>
          <span>{secondsRemaining > 0 ? `Lam moi sau ${secondsRemaining}s` : "Dang lam moi"}</span>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Verify**

Run:

```bash
pnpm --dir apps/web typecheck
```

Expected: typecheck passes.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/mobile/TicketQrPanel.tsx
git commit -m "web: add ticket QR panel"
```

---

### Task 8: Build Ticket Detail Page and Route

**Files:**

- Create: `apps/web/src/pages/TicketDetailPage.tsx`
- Modify: `apps/web/src/App.tsx`

- [ ] **Step 1: Implement detail page**

Create `apps/web/src/pages/TicketDetailPage.tsx`:

```tsx
import { ArrowLeft, Copy, ExternalLink } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import MobileLayout from "@/components/mobile/MobileLayout";
import TicketQrPanel from "@/components/mobile/TicketQrPanel";
import { useTicketDetail } from "@/hooks/use-ticket-detail";
import { useTicketQr } from "@/hooks/use-ticket-qr";
import { toast } from "@ticket-platform/shared-ui";

function shortId(value: string): string {
  return value.length > 14 ? `${value.slice(0, 8)}...${value.slice(-4)}` : value;
}

export default function TicketDetailPage() {
  const { id } = useParams();
  const { ticket, isLoading, isError, data } = useTicketDetail(id);
  const qr = useTicketQr(ticket);

  const copyText = async (value: string, label: string) => {
    await navigator.clipboard.writeText(value);
    toast({ title: "Da copy", description: `${label} da duoc copy` });
  };

  if (isLoading) {
    return (
      <MobileLayout>
        <div className="p-4">
          <div className="h-10 w-36 animate-pulse bg-foreground/10" />
          <div className="mt-6 aspect-square animate-pulse bg-foreground/10" />
        </div>
      </MobileLayout>
    );
  }

  if (!ticket) {
    return (
      <MobileLayout>
        <header className="sticky safe-area-sticky-top z-40 border-b border-foreground/10 bg-background/95 p-4 backdrop-blur-sm">
          <Link to="/tickets" className="flex items-center gap-2 text-sm text-foreground/70">
            <ArrowLeft className="h-4 w-4" />
            Ve Cua Toi
          </Link>
        </header>
        <section className="p-4 py-16 text-center">
          <p className="font-mono text-sm text-foreground/50">
            {isError ? "Khong tai duoc du lieu ve" : "Khong tim thay ve nay"}
          </p>
          <Link
            to="/tickets"
            className="mt-4 inline-flex px-5 py-3 border border-foreground font-mono text-xs uppercase tracking-wider"
          >
            Quay lai danh sach
          </Link>
        </section>
      </MobileLayout>
    );
  }

  return (
    <MobileLayout>
      <header className="sticky safe-area-sticky-top z-40 border-b border-foreground/10 bg-background/95 backdrop-blur-sm">
        <div className="flex items-center gap-3 p-4">
          <Link
            to="/tickets"
            className="flex h-10 w-10 items-center justify-center border border-foreground/20"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="min-w-0">
            <h1 className="truncate text-lg font-medium tracking-tight">{ticket.eventName}</h1>
            <p className="font-mono text-[10px] uppercase tracking-wider text-foreground/50">
              Token {shortId(ticket.tokenId)}
            </p>
          </div>
        </div>
      </header>

      {data?.status === "partial" && (
        <div className="border-b border-yellow-500/30 bg-yellow-500/10 px-4 py-3">
          <p className="font-mono text-[10px] text-yellow-200">
            Mot phan du lieu ticketing chua san sang. Dang hien thi du lieu da sync/local.
          </p>
        </div>
      )}

      <TicketQrPanel
        value={qr.qrValue}
        source={qr.source}
        secondsRemaining={qr.secondsRemaining}
        isLoading={qr.isLoading}
        isFetching={qr.isFetching}
        onRefresh={() => void qr.refresh()}
      />

      <section className="px-4 pb-6">
        <div className="border border-foreground/20 divide-y divide-foreground/10">
          {[
            ["Loai ve", ticket.ticketType],
            ["Ngay gio", `${ticket.date} - ${ticket.time}`],
            ["Dia diem", ticket.location],
            ["Nguon du lieu", ticket.source],
            ["Trang thai sync", ticket.syncStatus],
            ["Event ID", ticket.eventId],
            ["Token ID", ticket.tokenId],
            ["Owner wallet", ticket.ownerWalletAddress ?? "Dang cap nhat"],
            ["Reservation", ticket.reservationId],
            ["Tx hash", ticket.transactionHash ?? "Chua co"]
          ].map(([label, value]) => (
            <div key={label} className="flex items-start justify-between gap-4 p-3">
              <span className="font-mono text-[10px] uppercase tracking-wider text-foreground/40">
                {label}
              </span>
              <span className="max-w-[62%] break-all text-right font-mono text-xs text-foreground/80">
                {value}
              </span>
            </div>
          ))}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => void copyText(ticket.tokenId, "Token ID")}
            className="flex items-center justify-center gap-2 border border-foreground/20 px-3 py-3 font-mono text-[10px] uppercase tracking-wider"
          >
            <Copy className="h-4 w-4" />
            Copy token
          </button>
          <Link
            to="/marketplace/sell"
            className="flex items-center justify-center gap-2 border border-foreground/20 px-3 py-3 font-mono text-[10px] uppercase tracking-wider"
          >
            <ExternalLink className="h-4 w-4" />
            Ban lai
          </Link>
        </div>
      </section>
    </MobileLayout>
  );
}
```

- [ ] **Step 2: Add route**

In `apps/web/src/App.tsx`, import and route:

```tsx
import TicketDetailPage from "./pages/TicketDetailPage";
```

Add above marketplace routes:

```tsx
<Route path="/ticket/:id" element={<TicketDetailPage />} />
```

- [ ] **Step 3: Verify**

Run:

```bash
pnpm --dir apps/web typecheck
```

Expected: typecheck passes.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/pages/TicketDetailPage.tsx apps/web/src/App.tsx
git commit -m "web: add ticket detail page"
```

---

### Task 9: Polish Tickets List UI

**Files:**

- Modify: `apps/web/src/components/mobile/TicketCard.tsx`
- Modify: `apps/web/src/pages/TicketsPage.tsx`

- [ ] **Step 1: Update TicketCard props**

Keep `TicketCardView` compatibility, but accept optional fields from `TicketOwnershipView`:

```ts
type TicketCardProps = TicketCardView & {
  tokenId?: string;
  source?: "ticketing" | "contract-sync" | "local-cache";
  syncStatus?: "ready" | "syncing" | "partial";
};
```

- [ ] **Step 2: Add source badge and token short code**

Inside the card header, show:

```tsx
<div className="flex items-center justify-between gap-2">
  <span className="font-mono text-[10px] tracking-widest text-foreground/50 uppercase">
    {ticketType}
  </span>
  {source && (
    <span className="shrink-0 border border-foreground/15 px-2 py-1 font-mono text-[8px] uppercase tracking-wider text-foreground/45">
      {source === "local-cache" ? "local" : source === "contract-sync" ? "synced" : "ticketing"}
    </span>
  )}
</div>
```

Add token text in footer:

```tsx
<span className="font-mono text-[10px] tracking-wider text-foreground/40">
  {tokenId ? `TOKEN ${tokenId}` : "CHAM DE XEM VE DAY DU"}
</span>
```

Truncate with CSS classes so long token ids do not overflow.

- [ ] **Step 3: Add loading state**

In `TicketsPage`, use `isLoading`:

```ts
const { data, isError, isLoading, refetch, isFetching } = useMyTickets();
```

Render three skeleton rows while loading:

```tsx
{isLoading ? (
  Array.from({ length: 3 }).map((_, index) => (
    <div key={index} className="h-36 animate-pulse border border-foreground/10 bg-foreground/5" />
  ))
) : tickets.length > 0 ? (
  tickets.map((ticket) => <TicketCard key={ticket.id} {...ticket} />)
) : (
  ...
)}
```

- [ ] **Step 4: Add manual refresh**

In header, add a compact refresh button using lucide `RefreshCw`.

- [ ] **Step 5: Verify**

Run:

```bash
pnpm --dir apps/web typecheck
```

Expected: typecheck passes and no JSX prop errors.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/mobile/TicketCard.tsx apps/web/src/pages/TicketsPage.tsx
git commit -m "web: polish my tickets list"
```

---

### Task 10: Purchase Flow Metadata Completion

**Files:**

- Modify: `apps/web/src/pages/PrimaryPurchasePage.tsx`
- Modify: `apps/web/src/lib/synced-tickets.ts`
- Test: `apps/web/src/lib/synced-tickets.test.ts`

- [ ] **Step 1: Write failing metadata test**

Add to `synced-tickets.test.ts`:

```ts
assert.equal(loadPurchasedTicketMetadata(localStorage)[0].transactionHash, "0xabc");
assert.equal(loadPurchasedTicketMetadata(localStorage)[0].source, "primary-purchase");
```

Expected failure: source missing if not yet added.

- [ ] **Step 2: Save richer metadata after purchase**

In `PrimaryPurchasePage.tsx`, update `savePurchasedTicketMetadata` payload:

```ts
savePurchasedTicketMetadata({
  tokenId: result.tokenId,
  eventId: id,
  ticketTypeId: selectedTier.id,
  ownerUserId: getSessionUserId(),
  ownerWalletAddress: getSessionWalletAddress(),
  transactionHash: result.transactionHash,
  source: "primary-purchase",
  createdAt: result.syncedToken?.updatedAt ?? now
});
```

- [ ] **Step 3: Verify**

Run:

```bash
node --test --experimental-strip-types apps/web/src/lib/synced-tickets.test.ts
pnpm --dir apps/web typecheck
```

Expected: tests and typecheck pass.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/pages/PrimaryPurchasePage.tsx apps/web/src/lib/synced-tickets.ts apps/web/src/lib/synced-tickets.test.ts
git commit -m "web: persist ticket purchase metadata for detail"
```

---

### Task 11: End-to-End Verification

**Files:**

- No source edits expected unless verification finds a bug.

- [ ] **Step 1: Run focused unit tests**

```bash
node --test --experimental-strip-types \
  apps/web/src/lib/synced-tickets.test.ts \
  apps/web/src/lib/ticket-loader.test.ts \
  apps/web/src/lib/ticket-qr.test.ts \
  apps/web/src/lib/localchain.test.ts
```

Expected: all tests pass.

- [ ] **Step 2: Run web typecheck**

```bash
pnpm --dir apps/web typecheck
```

Expected: exit code 0.

- [ ] **Step 3: Run web build**

```bash
pnpm --dir apps/web build
```

Expected: Vite build completes.

- [ ] **Step 4: Manual smoke test**

Start the app with the same localchain/iOS environment the project uses. Verify:

- Open `/tickets`.
- Real/local ticket appears after primary purchase.
- Tap ticket card.
- `/ticket/:tokenId` opens.
- QR is visible.
- Countdown decreases locally.
- Refresh button requests a new QR.
- If backend QR returns 404, UI shows `Local QR`.
- Back button returns to `/tickets`.

- [ ] **Step 5: Commit verification fixes**

If fixes were needed:

```bash
git add <fixed-files>
git commit -m "web: fix ticket detail verification issues"
```

If no fixes were needed, do not create an empty commit.

---

## Spec Coverage Self-Review

- List view states: covered by Task 9.
- Detail route and wallet-pass UI: covered by Task 8.
- Backend-issued QR production path: covered by Tasks 2, 6, 7.
- Local QR fallback labeling: covered by Tasks 5, 6, 7.
- Purchase metadata bridge: covered by Task 10.
- Tests and verification: covered by Tasks 3, 4, 5, 11.

No unresolved placeholders remain. TOTP/offline-verifiable QR is intentionally excluded from this milestone.
