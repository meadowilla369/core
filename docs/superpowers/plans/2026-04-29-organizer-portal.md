# Organizer Portal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `apps/organizer-portal` as a dedicated React operations website for BTC users, matching the approved Clean Blue SaaS design.

**Architecture:** Convert the existing package from a TypeScript-only skeleton into a Vite React app while preserving the current domain functions under `src/domain`. Keep UI state separate from service access through typed adapters and view-model builders. Start with deterministic demo data and adapter seams so backend endpoints can replace mocks without redesign.

**Tech Stack:** React 18, Vite, TypeScript, Tailwind CSS, React Router, lucide-react, node:test with `--experimental-strip-types`, existing workspace TypeScript/Tailwind patterns.

---

## File Structure

Create or modify these files:

- Modify `apps/organizer-portal/package.json`: add Vite/React scripts and dependencies aligned with `apps/web`.
- Modify `apps/organizer-portal/tsconfig.json`: point app compilation at React source files.
- Create `apps/organizer-portal/tsconfig.app.json`: Vite React app typecheck config.
- Create `apps/organizer-portal/vite.config.ts`: Vite React config with `@` alias and `/v1` proxy.
- Create `apps/organizer-portal/tailwind.config.ts`: Tailwind config using shared preset.
- Create `apps/organizer-portal/postcss.config.js`: Tailwind/PostCSS entry.
- Create `apps/organizer-portal/index.html`: Vite root document.
- Create `apps/organizer-portal/src/main.tsx`: React root bootstrap.
- Create `apps/organizer-portal/src/App.tsx`: route definitions.
- Create `apps/organizer-portal/src/index.css`: Clean Blue SaaS tokens and base styles.
- Move existing `apps/organizer-portal/src/features/events.ts` to `apps/organizer-portal/src/domain/events.ts`.
- Move existing `apps/organizer-portal/src/features/analytics.ts` to `apps/organizer-portal/src/domain/analytics.ts`.
- Modify `apps/organizer-portal/src/index.ts`: keep package exports for domain compatibility.
- Create `apps/organizer-portal/src/domain/status.ts`: status taxonomy, colors, and mapping helpers.
- Create `apps/organizer-portal/src/domain/status.test.ts`: status mapping tests.
- Create `apps/organizer-portal/src/domain/overview.ts`: dashboard view-model aggregation.
- Create `apps/organizer-portal/src/domain/overview.test.ts`: KPI and risk queue tests.
- Create `apps/organizer-portal/src/lib/demo-data.ts`: deterministic organizer portal demo data.
- Create `apps/organizer-portal/src/lib/organizer-api.ts`: typed adapter interface and demo adapter.
- Create `apps/organizer-portal/src/lib/format.ts`: VND, date, percent, short id helpers.
- Create `apps/organizer-portal/src/components/AppShell.tsx`: sidebar/topbar shell.
- Create `apps/organizer-portal/src/components/StatusBadge.tsx`: status badge component.
- Create `apps/organizer-portal/src/components/MetricCard.tsx`: reusable KPI card.
- Create `apps/organizer-portal/src/components/DataPanel.tsx`: reusable section container.
- Create `apps/organizer-portal/src/pages/OverviewPage.tsx`: command center.
- Create `apps/organizer-portal/src/pages/EventsPage.tsx`: event and ticket type operations.
- Create `apps/organizer-portal/src/pages/InventoryPage.tsx`: inventory table.
- Create `apps/organizer-portal/src/pages/CheckinPage.tsx`: gate stats and mark-as-used jobs.
- Create `apps/organizer-portal/src/pages/RefundsPage.tsx`: refund queue.
- Create `apps/organizer-portal/src/pages/DisputesPage.tsx`: dispute queue.
- Create `apps/organizer-portal/src/pages/SettlementPage.tsx`: settlement/reconciliation view.
- Create `apps/organizer-portal/src/pages/SystemHealthPage.tsx`: service health view.
- Create `apps/organizer-portal/src/pages/NotFoundPage.tsx`: route fallback.

---

## Task 1: React App Scaffold

**Files:**

- Modify: `apps/organizer-portal/package.json`
- Modify: `apps/organizer-portal/tsconfig.json`
- Create: `apps/organizer-portal/tsconfig.app.json`
- Create: `apps/organizer-portal/vite.config.ts`
- Create: `apps/organizer-portal/tailwind.config.ts`
- Create: `apps/organizer-portal/postcss.config.js`
- Create: `apps/organizer-portal/index.html`
- Create: `apps/organizer-portal/src/main.tsx`
- Create: `apps/organizer-portal/src/App.tsx`
- Create: `apps/organizer-portal/src/index.css`

- [ ] **Step 1: Update package scripts and dependencies**

Replace `apps/organizer-portal/package.json` with:

```json
{
  "name": "@ticket-platform/app-organizer-portal",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "description": "Organizer operations portal",
  "scripts": {
    "dev": "vite --host 0.0.0.0 --port 5178",
    "build": "vite build",
    "preview": "vite preview --host 0.0.0.0 --port 4178",
    "test:domain": "node --test --experimental-strip-types src/domain/*.test.ts",
    "typecheck": "tsc -p tsconfig.app.json --noEmit",
    "lint": "echo 'lint not configured for app-organizer-portal'",
    "format": "echo 'format handled by root prettier'"
  },
  "dependencies": {
    "@ticket-platform/tailwind-config": "workspace:*",
    "clsx": "^2.1.1",
    "lucide-react": "^0.462.0",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-router-dom": "^6.30.1",
    "tailwind-merge": "^2.6.0"
  },
  "devDependencies": {
    "@types/node": "^22.16.5",
    "@types/react": "^18.3.23",
    "@types/react-dom": "^18.3.7",
    "@vitejs/plugin-react-swc": "^3.11.0",
    "autoprefixer": "^10.4.21",
    "postcss": "^8.5.6",
    "tailwindcss": "^3.4.17",
    "typescript": "^5.8.3",
    "vite": "^5.4.19"
  }
}
```

- [ ] **Step 2: Replace TypeScript configs**

Replace `apps/organizer-portal/tsconfig.json` with:

```json
{
  "extends": "./tsconfig.app.json"
}
```

Create `apps/organizer-portal/tsconfig.app.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "allowJs": false,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "forceConsistentCasingInFileNames": true,
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  },
  "include": ["src", "vite.config.ts", "tailwind.config.ts"]
}
```

- [ ] **Step 3: Create Vite and Tailwind config**

Create `apps/organizer-portal/vite.config.ts`:

```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "node:path";

const devApiProxyTarget = process.env.VITE_DEV_API_PROXY_TARGET ?? "http://127.0.0.1:3000";

export default defineConfig({
  server: {
    host: "0.0.0.0",
    port: 5178,
    proxy: {
      "/v1": {
        target: devApiProxyTarget,
        changeOrigin: true
      }
    }
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src")
    }
  }
});
```

Create `apps/organizer-portal/tailwind.config.ts`:

```ts
import type { Config } from "tailwindcss";
import sharedPreset from "../../packages/tailwind-config/preset.js";

export default {
  presets: [sharedPreset],
  content: ["./index.html", "./src/**/*.{ts,tsx}"]
} satisfies Config;
```

Create `apps/organizer-portal/postcss.config.js`:

```js
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {}
  }
};
```

- [ ] **Step 4: Create HTML and React root**

Create `apps/organizer-portal/index.html`:

```html
<!doctype html>
<html lang="vi">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Entr BTC Portal</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

Create `apps/organizer-portal/src/main.tsx`:

```tsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

Create `apps/organizer-portal/src/App.tsx`:

```tsx
const App = () => (
  <main className="min-h-screen bg-[--op-bg] p-6 text-[--op-text]">
    <h1 className="text-2xl font-semibold">Entr BTC Portal</h1>
    <p className="mt-2 text-sm text-[--op-muted]">Organizer operations portal scaffold.</p>
  </main>
);

export default App;
```

Create `apps/organizer-portal/src/index.css`:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --op-bg: #f8fafc;
  --op-surface: #ffffff;
  --op-text: #162033;
  --op-muted: #64748b;
  --op-border: #e2e8f0;
  --op-primary: #2563eb;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  min-width: 320px;
  background: var(--op-bg);
  color: var(--op-text);
  font-family:
    Inter,
    ui-sans-serif,
    system-ui,
    -apple-system,
    BlinkMacSystemFont,
    "Segoe UI",
    sans-serif;
}
```

- [ ] **Step 5: Run typecheck**

Run:

```bash
pnpm --filter @ticket-platform/app-organizer-portal typecheck
```

Expected: PASS with no TypeScript errors.

- [ ] **Step 6: Run build**

Run:

```bash
pnpm --filter @ticket-platform/app-organizer-portal build
```

Expected: Vite build completes and writes `apps/organizer-portal/dist`.

- [ ] **Step 7: Commit**

```bash
git add apps/organizer-portal/package.json apps/organizer-portal/tsconfig.json apps/organizer-portal/tsconfig.app.json apps/organizer-portal/vite.config.ts apps/organizer-portal/tailwind.config.ts apps/organizer-portal/postcss.config.js apps/organizer-portal/index.html apps/organizer-portal/src/main.tsx apps/organizer-portal/src/App.tsx apps/organizer-portal/src/index.css
git commit -m "organizer-portal: scaffold react app"
```

---

## Task 2: Preserve Domain Exports And Add Status System

**Files:**

- Move: `apps/organizer-portal/src/features/events.ts` to `apps/organizer-portal/src/domain/events.ts`
- Move: `apps/organizer-portal/src/features/analytics.ts` to `apps/organizer-portal/src/domain/analytics.ts`
- Modify: `apps/organizer-portal/src/index.ts`
- Create: `apps/organizer-portal/src/domain/status.ts`
- Create: `apps/organizer-portal/src/domain/status.test.ts`
- Modify: `apps/organizer-portal/package.json`

- [ ] **Step 1: Move existing domain files**

Run:

```bash
mkdir -p apps/organizer-portal/src/domain
git mv apps/organizer-portal/src/features/events.ts apps/organizer-portal/src/domain/events.ts
git mv apps/organizer-portal/src/features/analytics.ts apps/organizer-portal/src/domain/analytics.ts
rmdir apps/organizer-portal/src/features
```

Expected: files now live under `src/domain`.

- [ ] **Step 2: Update package exports**

Replace `apps/organizer-portal/src/index.ts` with:

```ts
export {
  cancelEvent,
  createOrganizerEvent,
  setTicketTypes,
  type OrganizerEvent,
  type OrganizerEventInput,
  type OrganizerTicketTypeInput
} from "./domain/events";
export {
  summarizeAnalytics,
  type EventSalesSnapshot,
  type OrganizerAnalytics
} from "./domain/analytics";
```

- [ ] **Step 3: Write failing status tests**

Create `apps/organizer-portal/src/domain/status.test.ts`:

```ts
import assert from "node:assert/strict";
import test from "node:test";

import {
  getEventStatusTone,
  getStatusTone,
  statusTones,
  type EventLifecycleStatus
} from "./status.ts";

test("newly created and upcoming events use blue informational tone", () => {
  const statuses: EventLifecycleStatus[] = ["draft", "scheduled", "upcoming"];

  for (const status of statuses) {
    assert.equal(getEventStatusTone(status).name, "info");
    assert.equal(getEventStatusTone(status).accent, "#2563EB");
  }
});

test("active/live success states use green tone", () => {
  assert.equal(getEventStatusTone("active").name, "success");
  assert.equal(getStatusTone("valid").name, "success");
  assert.equal(getStatusTone("resolved").accent, "#16A34A");
});

test("failed and cancelled states use critical red tone", () => {
  assert.equal(getEventStatusTone("cancelled").name, "critical");
  assert.equal(getStatusTone("invalid").accent, "#DC2626");
  assert.equal(getStatusTone("failed").name, "critical");
});

test("all tones include accessible label and badge classes", () => {
  for (const tone of Object.values(statusTones)) {
    assert.ok(tone.label.length > 0);
    assert.ok(tone.badgeClass.includes("border"));
    assert.ok(tone.badgeClass.includes("text-"));
  }
});
```

- [ ] **Step 4: Run test to verify it fails**

Run:

```bash
pnpm --filter @ticket-platform/app-organizer-portal test:domain
```

Expected: FAIL because `src/domain/status.ts` does not exist.

- [ ] **Step 5: Implement status system**

Create `apps/organizer-portal/src/domain/status.ts`:

```ts
export type StatusToneName = "info" | "success" | "attention" | "critical" | "neutral" | "review";

export interface StatusTone {
  name: StatusToneName;
  label: string;
  accent: string;
  soft: string;
  border: string;
  text: string;
  badgeClass: string;
}

export type EventLifecycleStatus =
  | "draft"
  | "scheduled"
  | "upcoming"
  | "active"
  | "live"
  | "postponed"
  | "cancelled"
  | "ended"
  | "archived";

export type OperationalStatus =
  | EventLifecycleStatus
  | "valid"
  | "duplicate"
  | "already_used"
  | "qr_expired"
  | "invalid"
  | "wrong_event"
  | "sync_retry"
  | "mark_as_used_failed"
  | "open"
  | "pending"
  | "processing"
  | "completed"
  | "failed"
  | "manual_review"
  | "in_review"
  | "awaiting_evidence"
  | "escalated"
  | "resolved"
  | "rejected"
  | "ready"
  | "reconciling"
  | "paid"
  | "blocked"
  | "no_data";

export const statusTones: Record<StatusToneName, StatusTone> = {
  info: {
    name: "info",
    label: "Info",
    accent: "#2563EB",
    soft: "#DBEAFE",
    border: "#BFDBFE",
    text: "#1D4ED8",
    badgeClass: "border border-blue-200 bg-blue-100 text-blue-700"
  },
  success: {
    name: "success",
    label: "Success",
    accent: "#16A34A",
    soft: "#DCFCE7",
    border: "#BBF7D0",
    text: "#166534",
    badgeClass: "border border-green-200 bg-green-100 text-green-700"
  },
  attention: {
    name: "attention",
    label: "Attention",
    accent: "#D97706",
    soft: "#FEF3C7",
    border: "#FDE68A",
    text: "#92400E",
    badgeClass: "border border-amber-200 bg-amber-100 text-amber-800"
  },
  critical: {
    name: "critical",
    label: "Critical",
    accent: "#DC2626",
    soft: "#FEE2E2",
    border: "#FECACA",
    text: "#B91C1C",
    badgeClass: "border border-red-200 bg-red-100 text-red-700"
  },
  neutral: {
    name: "neutral",
    label: "Neutral",
    accent: "#64748B",
    soft: "#F1F5F9",
    border: "#CBD5E1",
    text: "#475569",
    badgeClass: "border border-slate-300 bg-slate-100 text-slate-600"
  },
  review: {
    name: "review",
    label: "Review",
    accent: "#9333EA",
    soft: "#F3E8FF",
    border: "#E9D5FF",
    text: "#7E22CE",
    badgeClass: "border border-purple-200 bg-purple-100 text-purple-700"
  }
};

const statusToneMap: Record<OperationalStatus, StatusToneName> = {
  draft: "info",
  scheduled: "info",
  upcoming: "info",
  active: "success",
  live: "success",
  postponed: "attention",
  cancelled: "critical",
  ended: "neutral",
  archived: "neutral",
  valid: "success",
  duplicate: "attention",
  already_used: "attention",
  qr_expired: "attention",
  invalid: "critical",
  wrong_event: "critical",
  sync_retry: "review",
  mark_as_used_failed: "critical",
  open: "info",
  pending: "attention",
  processing: "info",
  completed: "success",
  failed: "critical",
  manual_review: "review",
  in_review: "review",
  awaiting_evidence: "attention",
  escalated: "review",
  resolved: "success",
  rejected: "critical",
  ready: "info",
  reconciling: "review",
  paid: "success",
  blocked: "critical",
  no_data: "neutral"
};

export function getStatusTone(status: OperationalStatus): StatusTone {
  return statusTones[statusToneMap[status]];
}

export function getEventStatusTone(status: EventLifecycleStatus): StatusTone {
  return getStatusTone(status);
}
```

- [ ] **Step 6: Run tests and typecheck**

Run:

```bash
pnpm --filter @ticket-platform/app-organizer-portal test:domain
pnpm --filter @ticket-platform/app-organizer-portal typecheck
```

Expected: both commands PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/organizer-portal/package.json apps/organizer-portal/src/index.ts apps/organizer-portal/src/domain/events.ts apps/organizer-portal/src/domain/analytics.ts apps/organizer-portal/src/domain/status.ts apps/organizer-portal/src/domain/status.test.ts
git commit -m "organizer-portal: add status taxonomy"
```

---

## Task 3: Demo Data, Formatting, And Overview View Model

**Files:**

- Create: `apps/organizer-portal/src/lib/format.ts`
- Create: `apps/organizer-portal/src/lib/demo-data.ts`
- Create: `apps/organizer-portal/src/domain/overview.ts`
- Create: `apps/organizer-portal/src/domain/overview.test.ts`

- [ ] **Step 1: Write failing overview tests**

Create `apps/organizer-portal/src/domain/overview.test.ts`:

```ts
import assert from "node:assert/strict";
import test from "node:test";

import { buildOverviewModel } from "./overview.ts";
import { demoOrganizerSnapshot } from "../lib/demo-data.ts";

test("overview summarizes sales, tickets, check-in rate, and risk items", () => {
  const overview = buildOverviewModel(demoOrganizerSnapshot);

  assert.equal(overview.kpis.grossSalesVnd, 1_820_000_000);
  assert.equal(overview.kpis.ticketsSold, 7430);
  assert.equal(overview.kpis.checkinRate, 0.68);
  assert.equal(overview.kpis.openRiskItems, 12);
});

test("overview keeps newly created scheduled event informational", () => {
  const overview = buildOverviewModel(demoOrganizerSnapshot);
  const productLaunch = overview.events.find((event) => event.id === "evt_product_launch_2026");

  assert.equal(productLaunch?.status, "scheduled");
  assert.equal(productLaunch?.statusTone.name, "info");
});

test("overview exposes risk queues in priority order", () => {
  const overview = buildOverviewModel(demoOrganizerSnapshot);

  assert.deepEqual(
    overview.riskQueues.map((queue) => queue.id),
    ["refunds", "disputes", "settlement", "sync"]
  );
  assert.equal(overview.riskQueues[0].tone.name, "attention");
  assert.equal(overview.riskQueues[1].tone.name, "review");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
pnpm --filter @ticket-platform/app-organizer-portal test:domain
```

Expected: FAIL because `overview.ts` and `demo-data.ts` do not exist.

- [ ] **Step 3: Add formatting helpers**

Create `apps/organizer-portal/src/lib/format.ts`:

```ts
const vndFormatter = new Intl.NumberFormat("vi-VN", {
  style: "currency",
  currency: "VND",
  maximumFractionDigits: 0
});

const compactNumberFormatter = new Intl.NumberFormat("en", {
  notation: "compact",
  maximumFractionDigits: 1
});

export function formatVnd(value: number): string {
  return vndFormatter.format(value);
}

export function formatCompactNumber(value: number): string {
  return compactNumberFormatter.format(value);
}

export function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

export function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

export function shortId(value: string): string {
  if (value.length <= 12) {
    return value;
  }

  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}
```

- [ ] **Step 4: Add deterministic demo data**

Create `apps/organizer-portal/src/lib/demo-data.ts`:

```ts
import type { EventLifecycleStatus, OperationalStatus } from "../domain/status";

export interface OrganizerEventSummary {
  id: string;
  title: string;
  city: string;
  venue: string;
  startAt: string;
  endAt: string;
  status: EventLifecycleStatus;
  grossSalesVnd: number;
  ticketsSold: number;
  ticketsLocked: number;
  ticketCapacity: number;
  checkinRate: number;
}

export interface GateSnapshot {
  gateId: string;
  checkedInCount: number;
  duplicateCount: number;
  invalidCount: number;
}

export interface QueueSnapshot {
  id: "refunds" | "disputes" | "settlement" | "sync";
  label: string;
  count: number;
  description: string;
  status: OperationalStatus;
}

export interface OrganizerSnapshot {
  organizerId: string;
  generatedAt: string;
  events: OrganizerEventSummary[];
  gates: GateSnapshot[];
  queues: QueueSnapshot[];
}

export const demoOrganizerSnapshot: OrganizerSnapshot = {
  organizerId: "org_rockfest",
  generatedAt: "2026-04-29T10:00:00.000Z",
  events: [
    {
      id: "evt_rockfest_2026",
      title: "Rock Fest 2026",
      city: "Ho Chi Minh",
      venue: "Riverside Arena",
      startAt: "2026-05-10T19:00:00.000Z",
      endAt: "2026-05-10T23:00:00.000Z",
      status: "active",
      grossSalesVnd: 1_250_000_000,
      ticketsSold: 5550,
      ticketsLocked: 210,
      ticketCapacity: 7300,
      checkinRate: 0.68
    },
    {
      id: "evt_jazz_night_2026",
      title: "Jazz Night 2026",
      city: "Ha Noi",
      venue: "Opera Hall",
      startAt: "2026-06-01T12:30:00.000Z",
      endAt: "2026-06-01T16:00:00.000Z",
      status: "upcoming",
      grossSalesVnd: 570_000_000,
      ticketsSold: 1880,
      ticketsLocked: 64,
      ticketCapacity: 2500,
      checkinRate: 0
    },
    {
      id: "evt_product_launch_2026",
      title: "Creator Product Launch",
      city: "Da Nang",
      venue: "Han River Hall",
      startAt: "2026-07-12T13:00:00.000Z",
      endAt: "2026-07-12T16:00:00.000Z",
      status: "scheduled",
      grossSalesVnd: 0,
      ticketsSold: 0,
      ticketsLocked: 0,
      ticketCapacity: 900,
      checkinRate: 0
    }
  ],
  gates: [
    { gateId: "Gate A", checkedInCount: 1240, duplicateCount: 2, invalidCount: 1 },
    { gateId: "Gate B", checkedInCount: 1010, duplicateCount: 1, invalidCount: 0 },
    { gateId: "VIP", checkedInCount: 320, duplicateCount: 0, invalidCount: 0 }
  ],
  queues: [
    {
      id: "refunds",
      label: "Refund queue",
      count: 6,
      description: "1 failed payout and 5 pending refunds",
      status: "pending"
    },
    {
      id: "disputes",
      label: "Dispute SLA",
      count: 4,
      description: "1 case nearing SLA deadline",
      status: "in_review"
    },
    {
      id: "settlement",
      label: "Settlement",
      count: 1,
      description: "318M VND ready for final review",
      status: "ready"
    },
    {
      id: "sync",
      label: "Sync jobs",
      count: 1,
      description: "1 mark-as-used job retrying",
      status: "sync_retry"
    }
  ]
};
```

- [ ] **Step 5: Implement overview model**

Create `apps/organizer-portal/src/domain/overview.ts`:

```ts
import { getEventStatusTone, getStatusTone, type StatusTone } from "./status";
import type { OrganizerEventSummary, OrganizerSnapshot, QueueSnapshot } from "../lib/demo-data";

export interface OverviewEvent extends OrganizerEventSummary {
  statusTone: StatusTone;
  availableTickets: number;
  sellThroughRate: number;
}

export interface OverviewRiskQueue extends QueueSnapshot {
  tone: StatusTone;
}

export interface OverviewModel {
  organizerId: string;
  generatedAt: string;
  kpis: {
    grossSalesVnd: number;
    ticketsSold: number;
    checkinRate: number;
    openRiskItems: number;
  };
  events: OverviewEvent[];
  gates: OrganizerSnapshot["gates"];
  riskQueues: OverviewRiskQueue[];
}

export function buildOverviewModel(snapshot: OrganizerSnapshot): OverviewModel {
  const ticketsSold = snapshot.events.reduce((sum, event) => sum + event.ticketsSold, 0);
  const grossSalesVnd = snapshot.events.reduce((sum, event) => sum + event.grossSalesVnd, 0);
  const checkedInTickets = snapshot.events.reduce(
    (sum, event) => sum + Math.round(event.ticketsSold * event.checkinRate),
    0
  );
  const openRiskItems = snapshot.queues.reduce((sum, queue) => sum + queue.count, 0);

  return {
    organizerId: snapshot.organizerId,
    generatedAt: snapshot.generatedAt,
    kpis: {
      grossSalesVnd,
      ticketsSold,
      checkinRate: ticketsSold === 0 ? 0 : Number((checkedInTickets / ticketsSold).toFixed(2)),
      openRiskItems
    },
    events: snapshot.events.map((event) => ({
      ...event,
      statusTone: getEventStatusTone(event.status),
      availableTickets: Math.max(event.ticketCapacity - event.ticketsSold - event.ticketsLocked, 0),
      sellThroughRate:
        event.ticketCapacity === 0
          ? 0
          : Number((event.ticketsSold / event.ticketCapacity).toFixed(2))
    })),
    gates: snapshot.gates,
    riskQueues: snapshot.queues.map((queue) => ({
      ...queue,
      tone: getStatusTone(queue.status)
    }))
  };
}
```

- [ ] **Step 6: Run tests and typecheck**

Run:

```bash
pnpm --filter @ticket-platform/app-organizer-portal test:domain
pnpm --filter @ticket-platform/app-organizer-portal typecheck
```

Expected: both commands PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/organizer-portal/src/lib/format.ts apps/organizer-portal/src/lib/demo-data.ts apps/organizer-portal/src/domain/overview.ts apps/organizer-portal/src/domain/overview.test.ts
git commit -m "organizer-portal: add overview model"
```

---

## Task 4: API Adapter Seam

**Files:**

- Create: `apps/organizer-portal/src/lib/organizer-api.ts`
- Create: `apps/organizer-portal/src/lib/use-organizer-data.ts`

- [ ] **Step 1: Create typed adapter**

Create `apps/organizer-portal/src/lib/organizer-api.ts`:

```ts
import { demoOrganizerSnapshot, type OrganizerSnapshot } from "./demo-data";

export interface OrganizerApi {
  getSnapshot(): Promise<OrganizerSnapshot>;
}

export class DemoOrganizerApi implements OrganizerApi {
  async getSnapshot(): Promise<OrganizerSnapshot> {
    return demoOrganizerSnapshot;
  }
}

export async function requestJson<T>(
  path: string,
  options: RequestInit & { organizerId?: string } = {}
): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set("accept", "application/json");

  if (options.body && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }

  if (options.organizerId) {
    headers.set("x-organizer-id", options.organizerId);
  }

  const response = await fetch(path, {
    ...options,
    headers
  });

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status} ${response.statusText}`);
  }

  return (await response.json()) as T;
}
```

- [ ] **Step 2: Create hook with loading and error states**

Create `apps/organizer-portal/src/lib/use-organizer-data.ts`:

```ts
import { useEffect, useState } from "react";
import { DemoOrganizerApi, type OrganizerApi } from "./organizer-api";
import type { OrganizerSnapshot } from "./demo-data";

const defaultApi = new DemoOrganizerApi();

export interface OrganizerDataState {
  data: OrganizerSnapshot | null;
  isLoading: boolean;
  error: string | null;
  refresh(): Promise<void>;
}

export function useOrganizerSnapshot(api: OrganizerApi = defaultApi): OrganizerDataState {
  const [data, setData] = useState<OrganizerSnapshot | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    setIsLoading(true);
    setError(null);

    try {
      setData(await api.getSnapshot());
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to load organizer data");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  return { data, isLoading, error, refresh };
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
git add apps/organizer-portal/src/lib/organizer-api.ts apps/organizer-portal/src/lib/use-organizer-data.ts
git commit -m "organizer-portal: add organizer data adapter"
```

---

## Task 5: Shell And Shared UI Components

**Files:**

- Create: `apps/organizer-portal/src/components/AppShell.tsx`
- Create: `apps/organizer-portal/src/components/StatusBadge.tsx`
- Create: `apps/organizer-portal/src/components/MetricCard.tsx`
- Create: `apps/organizer-portal/src/components/DataPanel.tsx`

- [ ] **Step 1: Create status badge**

Create `apps/organizer-portal/src/components/StatusBadge.tsx`:

```tsx
import { getStatusTone, type OperationalStatus } from "@/domain/status";

interface StatusBadgeProps {
  status: OperationalStatus;
  label: string;
}

export function StatusBadge({ status, label }: StatusBadgeProps) {
  const tone = getStatusTone(status);

  return (
    <span
      className={`inline-flex min-h-7 items-center rounded-full px-2.5 text-xs font-semibold ${tone.badgeClass}`}
    >
      {label}
    </span>
  );
}
```

- [ ] **Step 2: Create metric and panel components**

Create `apps/organizer-portal/src/components/MetricCard.tsx`:

```tsx
import type { ReactNode } from "react";

interface MetricCardProps {
  label: string;
  value: string;
  detail: string;
  icon: ReactNode;
  tone?: "default" | "success" | "attention" | "critical";
}

const toneClass = {
  default: "text-slate-900",
  success: "text-green-700",
  attention: "text-amber-700",
  critical: "text-red-700"
};

export function MetricCard({ label, value, detail, icon, tone = "default" }: MetricCardProps) {
  return (
    <section className="rounded-lg border border-[--op-border] bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-[--op-muted]">{label}</p>
          <p className={`mt-2 text-2xl font-semibold ${toneClass[tone]}`}>{value}</p>
          <p className="mt-1 text-xs text-[--op-muted]">{detail}</p>
        </div>
        <div className="rounded-md border border-blue-100 bg-blue-50 p-2 text-blue-700">{icon}</div>
      </div>
    </section>
  );
}
```

Create `apps/organizer-portal/src/components/DataPanel.tsx`:

```tsx
import type { ReactNode } from "react";

interface DataPanelProps {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
}

export function DataPanel({ title, description, action, children }: DataPanelProps) {
  return (
    <section className="rounded-lg border border-[--op-border] bg-white p-4 shadow-sm">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-slate-950">{title}</h2>
          {description ? <p className="mt-1 text-sm text-[--op-muted]">{description}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
```

- [ ] **Step 3: Create app shell**

Create `apps/organizer-portal/src/components/AppShell.tsx`:

```tsx
import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";
import {
  Activity,
  Banknote,
  Gauge,
  HeartPulse,
  LifeBuoy,
  QrCode,
  Ticket,
  WalletCards
} from "lucide-react";

const navItems = [
  { to: "/", label: "Overview", icon: Gauge },
  { to: "/events", label: "Events", icon: Ticket },
  { to: "/inventory", label: "Ticket inventory", icon: WalletCards },
  { to: "/check-in", label: "Live check-in", icon: QrCode },
  { to: "/refunds", label: "Refunds", icon: Banknote },
  { to: "/disputes", label: "Disputes", icon: LifeBuoy },
  { to: "/settlement", label: "Settlement", icon: Activity },
  { to: "/health", label: "System health", icon: HeartPulse }
];

interface AppShellProps {
  title: string;
  description: string;
  action?: ReactNode;
  children: ReactNode;
}

export function AppShell({ title, description, action, children }: AppShellProps) {
  return (
    <div className="min-h-screen bg-[--op-bg] text-[--op-text]">
      <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[240px_1fr]">
        <aside className="border-r border-[--op-border] bg-white px-4 py-5">
          <div className="mb-6">
            <p className="text-lg font-bold text-blue-700">ENTR BTC</p>
            <p className="text-xs text-[--op-muted]">Organizer Admin</p>
          </div>
          <nav className="space-y-1">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/"}
                className={({ isActive }) =>
                  `flex min-h-10 items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-blue-50 text-blue-700"
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-950"
                  }`
                }
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </NavLink>
            ))}
          </nav>
          <div className="mt-8 rounded-lg border border-[--op-border] bg-slate-50 p-3 text-xs text-[--op-muted]">
            <p className="font-semibold text-slate-700">org_rockfest</p>
            <p>Admin session</p>
          </div>
        </aside>
        <main className="min-w-0 px-4 py-5 sm:px-6 lg:px-8">
          <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-slate-950">{title}</h1>
              <p className="mt-1 text-sm text-[--op-muted]">{description}</p>
            </div>
            {action}
          </header>
          {children}
        </main>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run typecheck**

Run:

```bash
pnpm --filter @ticket-platform/app-organizer-portal typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/organizer-portal/src/components/AppShell.tsx apps/organizer-portal/src/components/StatusBadge.tsx apps/organizer-portal/src/components/MetricCard.tsx apps/organizer-portal/src/components/DataPanel.tsx
git commit -m "organizer-portal: add admin shell components"
```

---

## Task 6: Overview And Routing

**Files:**

- Modify: `apps/organizer-portal/src/App.tsx`
- Create: `apps/organizer-portal/src/pages/OverviewPage.tsx`
- Create: `apps/organizer-portal/src/pages/NotFoundPage.tsx`

- [ ] **Step 1: Create overview page**

Create `apps/organizer-portal/src/pages/OverviewPage.tsx`:

```tsx
import { AlertTriangle, Banknote, CheckCircle2, RefreshCw, Ticket } from "lucide-react";
import { DataPanel } from "@/components/DataPanel";
import { MetricCard } from "@/components/MetricCard";
import { StatusBadge } from "@/components/StatusBadge";
import { buildOverviewModel } from "@/domain/overview";
import { formatDateTime, formatPercent, formatVnd } from "@/lib/format";
import { useOrganizerSnapshot } from "@/lib/use-organizer-data";

export function OverviewPage() {
  const { data, isLoading, error, refresh } = useOrganizerSnapshot();
  const overview = data ? buildOverviewModel(data) : null;

  if (isLoading && !overview) {
    return (
      <div className="rounded-lg border border-[--op-border] bg-white p-6">
        Loading dashboard...
      </div>
    );
  }

  if (error && !overview) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-red-700">
        Unable to load organizer dashboard: {error}
      </div>
    );
  }

  if (!overview) {
    return null;
  }

  return (
    <div className="space-y-5">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => void refresh()}
          className="inline-flex min-h-10 items-center gap-2 rounded-md border border-[--op-border] bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      </div>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Gross sales"
          value={formatVnd(overview.kpis.grossSalesVnd)}
          detail={`Updated ${formatDateTime(overview.generatedAt)}`}
          icon={<Banknote className="h-4 w-4" />}
        />
        <MetricCard
          label="Tickets sold"
          value={overview.kpis.ticketsSold.toLocaleString("en")}
          detail="Across active organizer events"
          icon={<Ticket className="h-4 w-4" />}
        />
        <MetricCard
          label="Check-in rate"
          value={formatPercent(overview.kpis.checkinRate)}
          detail={`${overview.gates.length} active gate groups`}
          icon={<CheckCircle2 className="h-4 w-4" />}
          tone="success"
        />
        <MetricCard
          label="Open risk items"
          value={overview.kpis.openRiskItems.toString()}
          detail="Refunds, disputes, settlement, sync"
          icon={<AlertTriangle className="h-4 w-4" />}
          tone="attention"
        />
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.4fr_0.8fr]">
        <DataPanel title="Event operations" description="Active and upcoming organizer events">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-b border-[--op-border] text-xs uppercase text-[--op-muted]">
                <tr>
                  <th className="py-2 pr-3">Event</th>
                  <th className="py-2 pr-3">Sales</th>
                  <th className="py-2 pr-3">Inventory</th>
                  <th className="py-2 pr-3">Check-in</th>
                  <th className="py-2 pr-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {overview.events.map((event) => (
                  <tr key={event.id} className="border-b border-slate-100 last:border-0">
                    <td className="py-3 pr-3">
                      <p className="font-semibold text-slate-950">{event.title}</p>
                      <p className="text-xs text-[--op-muted]">
                        {event.venue} · {event.city}
                      </p>
                    </td>
                    <td className="py-3 pr-3">{formatVnd(event.grossSalesVnd)}</td>
                    <td className="py-3 pr-3">
                      {event.availableTickets.toLocaleString("en")} available
                    </td>
                    <td className="py-3 pr-3">{formatPercent(event.checkinRate)}</td>
                    <td className="py-3 pr-3">
                      <StatusBadge status={event.status} label={event.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DataPanel>

        <DataPanel title="Live check-in" description="Gate-level scan health">
          <div className="space-y-4">
            {overview.gates.map((gate) => (
              <div key={gate.gateId}>
                <div className="mb-2 flex justify-between text-sm">
                  <span className="font-medium">{gate.gateId}</span>
                  <span className="text-green-700">
                    {gate.checkedInCount.toLocaleString("en")} valid
                  </span>
                </div>
                <div className="h-2 rounded-full bg-slate-100">
                  <div
                    className="h-2 rounded-full bg-blue-600"
                    style={{ width: `${Math.min(gate.checkedInCount / 18, 100)}%` }}
                  />
                </div>
                {(gate.duplicateCount > 0 || gate.invalidCount > 0) && (
                  <p className="mt-1 text-xs text-amber-700">
                    {gate.duplicateCount} duplicate · {gate.invalidCount} invalid
                  </p>
                )}
              </div>
            ))}
          </div>
        </DataPanel>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {overview.riskQueues.map((queue) => (
          <DataPanel key={queue.id} title={queue.label}>
            <p className="text-2xl font-semibold text-slate-950">{queue.count}</p>
            <p className="mt-1 text-sm text-[--op-muted]">{queue.description}</p>
            <div className="mt-3">
              <StatusBadge status={queue.status} label={queue.status.replaceAll("_", " ")} />
            </div>
          </DataPanel>
        ))}
      </section>
    </div>
  );
}
```

- [ ] **Step 2: Create not found page**

Create `apps/organizer-portal/src/pages/NotFoundPage.tsx`:

```tsx
import { Link } from "react-router-dom";

export function NotFoundPage() {
  return (
    <div className="rounded-lg border border-[--op-border] bg-white p-8 text-center">
      <h2 className="text-lg font-semibold">Page not found</h2>
      <p className="mt-2 text-sm text-[--op-muted]">This organizer portal route does not exist.</p>
      <Link
        to="/"
        className="mt-5 inline-flex min-h-10 items-center rounded-md bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700"
      >
        Back to overview
      </Link>
    </div>
  );
}
```

- [ ] **Step 3: Wire routes and shell**

Replace `apps/organizer-portal/src/App.tsx` with:

```tsx
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { AppShell } from "@/components/AppShell";
import { OverviewPage } from "@/pages/OverviewPage";
import { NotFoundPage } from "@/pages/NotFoundPage";

const pageMeta: Record<string, { title: string; description: string }> = {
  "/": {
    title: "Operations Overview",
    description: "All organizer events, risk queues, and live operational health."
  }
};

function RoutedApp() {
  const meta = pageMeta[window.location.pathname] ?? {
    title: "Organizer Portal",
    description: "Manage event operations for your organizer account."
  };

  return (
    <AppShell title={meta.title} description={meta.description}>
      <Routes>
        <Route path="/" element={<OverviewPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </AppShell>
  );
}

const App = () => (
  <BrowserRouter>
    <RoutedApp />
  </BrowserRouter>
);

export default App;
```

- [ ] **Step 4: Run typecheck and build**

Run:

```bash
pnpm --filter @ticket-platform/app-organizer-portal typecheck
pnpm --filter @ticket-platform/app-organizer-portal build
```

Expected: both commands PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/organizer-portal/src/App.tsx apps/organizer-portal/src/pages/OverviewPage.tsx apps/organizer-portal/src/pages/NotFoundPage.tsx
git commit -m "organizer-portal: build overview dashboard"
```

---

## Task 7: Secondary Operational Pages

**Files:**

- Modify: `apps/organizer-portal/src/App.tsx`
- Create: `apps/organizer-portal/src/pages/EventsPage.tsx`
- Create: `apps/organizer-portal/src/pages/InventoryPage.tsx`
- Create: `apps/organizer-portal/src/pages/CheckinPage.tsx`
- Create: `apps/organizer-portal/src/pages/RefundsPage.tsx`
- Create: `apps/organizer-portal/src/pages/DisputesPage.tsx`
- Create: `apps/organizer-portal/src/pages/SettlementPage.tsx`
- Create: `apps/organizer-portal/src/pages/SystemHealthPage.tsx`

- [ ] **Step 1: Create Events page**

Create `apps/organizer-portal/src/pages/EventsPage.tsx`:

```tsx
import { CalendarPlus } from "lucide-react";
import { DataPanel } from "@/components/DataPanel";
import { StatusBadge } from "@/components/StatusBadge";
import { buildOverviewModel } from "@/domain/overview";
import { formatDateTime, formatPercent, formatVnd } from "@/lib/format";
import { useOrganizerSnapshot } from "@/lib/use-organizer-data";

export function EventsPage() {
  const { data } = useOrganizerSnapshot();
  const overview = data ? buildOverviewModel(data) : null;

  return (
    <DataPanel
      title="Events"
      description="Create, edit, cancel, and monitor organizer-owned events."
      action={
        <button className="inline-flex min-h-10 items-center gap-2 rounded-md bg-blue-600 px-3 text-sm font-semibold text-white hover:bg-blue-700">
          <CalendarPlus className="h-4 w-4" />
          Create event
        </button>
      }
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[820px] text-left text-sm">
          <thead className="border-b border-[--op-border] text-xs uppercase text-[--op-muted]">
            <tr>
              <th className="py-2 pr-3">Event</th>
              <th className="py-2 pr-3">Schedule</th>
              <th className="py-2 pr-3">Sales</th>
              <th className="py-2 pr-3">Sell-through</th>
              <th className="py-2 pr-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {overview?.events.map((event) => (
              <tr key={event.id} className="border-b border-slate-100 last:border-0">
                <td className="py-3 pr-3">
                  <p className="font-semibold">{event.title}</p>
                  <p className="text-xs text-[--op-muted]">{event.venue}</p>
                </td>
                <td className="py-3 pr-3">{formatDateTime(event.startAt)}</td>
                <td className="py-3 pr-3">{formatVnd(event.grossSalesVnd)}</td>
                <td className="py-3 pr-3">{formatPercent(event.sellThroughRate)}</td>
                <td className="py-3 pr-3">
                  <StatusBadge status={event.status} label={event.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </DataPanel>
  );
}
```

- [ ] **Step 2: Create Inventory page**

Create `apps/organizer-portal/src/pages/InventoryPage.tsx`:

```tsx
import { DataPanel } from "@/components/DataPanel";
import { StatusBadge } from "@/components/StatusBadge";
import { buildOverviewModel } from "@/domain/overview";
import { formatPercent } from "@/lib/format";
import { useOrganizerSnapshot } from "@/lib/use-organizer-data";

export function InventoryPage() {
  const { data } = useOrganizerSnapshot();
  const overview = data ? buildOverviewModel(data) : null;

  return (
    <DataPanel
      title="Ticket inventory"
      description="Sold, locked, and available capacity by event."
    >
      <div className="grid gap-3">
        {overview?.events.map((event) => {
          const lowInventory = event.availableTickets / event.ticketCapacity < 0.15;
          return (
            <div
              key={event.id}
              className="grid gap-3 rounded-lg border border-[--op-border] p-4 md:grid-cols-[1fr_140px_140px_140px_120px]"
            >
              <div>
                <p className="font-semibold">{event.title}</p>
                <p className="text-sm text-[--op-muted]">
                  {event.ticketCapacity.toLocaleString("en")} total capacity
                </p>
              </div>
              <div>
                <p className="text-xs text-[--op-muted]">Sold</p>
                <p className="font-semibold">{event.ticketsSold.toLocaleString("en")}</p>
              </div>
              <div>
                <p className="text-xs text-[--op-muted]">Locked</p>
                <p className="font-semibold">{event.ticketsLocked.toLocaleString("en")}</p>
              </div>
              <div>
                <p className="text-xs text-[--op-muted]">Available</p>
                <p className="font-semibold">{event.availableTickets.toLocaleString("en")}</p>
              </div>
              <div>
                <p className="text-xs text-[--op-muted]">Health</p>
                <StatusBadge
                  status={lowInventory ? "pending" : "active"}
                  label={lowInventory ? "Low inventory" : formatPercent(event.sellThroughRate)}
                />
              </div>
            </div>
          );
        })}
      </div>
    </DataPanel>
  );
}
```

- [ ] **Step 3: Create Check-in page**

Create `apps/organizer-portal/src/pages/CheckinPage.tsx`:

```tsx
import { DataPanel } from "@/components/DataPanel";
import { StatusBadge } from "@/components/StatusBadge";
import { useOrganizerSnapshot } from "@/lib/use-organizer-data";

export function CheckinPage() {
  const { data } = useOrganizerSnapshot();

  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_0.8fr]">
      <DataPanel title="Gate metrics" description="Valid, duplicate, and invalid scans by gate.">
        <div className="space-y-3">
          {data?.gates.map((gate) => (
            <div key={gate.gateId} className="rounded-lg border border-[--op-border] p-4">
              <div className="flex items-center justify-between">
                <p className="font-semibold">{gate.gateId}</p>
                <StatusBadge
                  status={gate.invalidCount > 0 ? "pending" : "valid"}
                  label={gate.invalidCount > 0 ? "Attention" : "Healthy"}
                />
              </div>
              <div className="mt-3 grid grid-cols-3 gap-3 text-sm">
                <div>
                  <p className="text-xs text-[--op-muted]">Valid</p>
                  <p className="font-semibold text-green-700">{gate.checkedInCount}</p>
                </div>
                <div>
                  <p className="text-xs text-[--op-muted]">Duplicate</p>
                  <p className="font-semibold text-amber-700">{gate.duplicateCount}</p>
                </div>
                <div>
                  <p className="text-xs text-[--op-muted]">Invalid</p>
                  <p className="font-semibold text-red-700">{gate.invalidCount}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </DataPanel>
      <DataPanel title="Mark-as-used jobs" description="Async chain sync visibility.">
        <div className="space-y-3 text-sm">
          <div className="rounded-lg border border-purple-200 bg-purple-50 p-3 text-purple-800">
            1 sync retry is waiting for the next attempt.
          </div>
          <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-green-800">
            Processed jobs remain available through service logs.
          </div>
        </div>
      </DataPanel>
    </div>
  );
}
```

- [ ] **Step 4: Create queue pages**

Create `apps/organizer-portal/src/pages/RefundsPage.tsx`:

```tsx
import { DataPanel } from "@/components/DataPanel";
import { StatusBadge } from "@/components/StatusBadge";

const refunds = [
  {
    id: "ref_1024",
    event: "Rock Fest 2026",
    amount: "900,000 VND",
    status: "pending" as const,
    note: "Pending payout"
  },
  {
    id: "ref_1025",
    event: "Rock Fest 2026",
    amount: "2,200,000 VND",
    status: "failed" as const,
    note: "Gateway retry required"
  },
  {
    id: "ref_1026",
    event: "Jazz Night 2026",
    amount: "650,000 VND",
    status: "completed" as const,
    note: "Paid through original method"
  }
];

export function RefundsPage() {
  return (
    <DataPanel
      title="Refunds"
      description="Refund requests, payout retries, and cancellation impact."
    >
      <div className="space-y-3">
        {refunds.map((refund) => (
          <div
            key={refund.id}
            className="grid gap-3 rounded-lg border border-[--op-border] p-4 md:grid-cols-[140px_1fr_140px_140px]"
          >
            <p className="font-mono text-sm">{refund.id}</p>
            <div>
              <p className="font-semibold">{refund.event}</p>
              <p className="text-sm text-[--op-muted]">{refund.note}</p>
            </div>
            <p className="font-semibold">{refund.amount}</p>
            <StatusBadge status={refund.status} label={refund.status} />
          </div>
        ))}
      </div>
    </DataPanel>
  );
}
```

Create `apps/organizer-portal/src/pages/DisputesPage.tsx`:

```tsx
import { DataPanel } from "@/components/DataPanel";
import { StatusBadge } from "@/components/StatusBadge";

const disputes = [
  {
    id: "dsp_2040",
    category: "check-in",
    event: "Rock Fest 2026",
    sla: "2h left",
    status: "in_review" as const
  },
  {
    id: "dsp_2041",
    category: "refund",
    event: "Jazz Night 2026",
    sla: "1d left",
    status: "awaiting_evidence" as const
  },
  {
    id: "dsp_2042",
    category: "resale",
    event: "Rock Fest 2026",
    sla: "resolved",
    status: "resolved" as const
  }
];

export function DisputesPage() {
  return (
    <DataPanel title="Disputes" description="SLA-oriented moderation and support queue.">
      <div className="space-y-3">
        {disputes.map((dispute) => (
          <div
            key={dispute.id}
            className="grid gap-3 rounded-lg border border-[--op-border] p-4 md:grid-cols-[140px_1fr_120px_160px]"
          >
            <p className="font-mono text-sm">{dispute.id}</p>
            <div>
              <p className="font-semibold">{dispute.event}</p>
              <p className="text-sm text-[--op-muted]">{dispute.category}</p>
            </div>
            <p>{dispute.sla}</p>
            <StatusBadge status={dispute.status} label={dispute.status.replaceAll("_", " ")} />
          </div>
        ))}
      </div>
    </DataPanel>
  );
}
```

Create `apps/organizer-portal/src/pages/SettlementPage.tsx`:

```tsx
import { DataPanel } from "@/components/DataPanel";
import { StatusBadge } from "@/components/StatusBadge";

export function SettlementPage() {
  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_0.75fr]">
      <DataPanel
        title="Settlement"
        description="Primary sales, resale royalties, and payout readiness."
      >
        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-lg border border-[--op-border] p-4">
            <p className="text-sm text-[--op-muted]">Primary sales</p>
            <p className="text-xl font-semibold">1.82B VND</p>
          </div>
          <div className="rounded-lg border border-[--op-border] p-4">
            <p className="text-sm text-[--op-muted]">Resale royalty</p>
            <p className="text-xl font-semibold">42M VND</p>
          </div>
          <div className="rounded-lg border border-[--op-border] p-4">
            <p className="text-sm text-[--op-muted]">Ready payout</p>
            <p className="text-xl font-semibold">318M VND</p>
          </div>
        </div>
      </DataPanel>
      <DataPanel title="Reconciliation state">
        <StatusBadge status="reconciling" label="Reconciling" />
        <p className="mt-3 text-sm text-[--op-muted]">
          Finalization stays disabled until payment and ticket ledgers match.
        </p>
      </DataPanel>
    </div>
  );
}
```

- [ ] **Step 5: Create System Health page**

Create `apps/organizer-portal/src/pages/SystemHealthPage.tsx`:

```tsx
import { DataPanel } from "@/components/DataPanel";
import { StatusBadge } from "@/components/StatusBadge";

const services = [
  { name: "event-service", status: "active" as const, note: "Postgres ready" },
  { name: "ticketing-service", status: "active" as const, note: "Inventory sync available" },
  { name: "checkin-service", status: "pending" as const, note: "1 mark-as-used retry" },
  { name: "refund-service", status: "failed" as const, note: "1 payout retry failed" },
  { name: "dispute-service", status: "active" as const, note: "Moderation reachable" },
  { name: "marketplace-service", status: "reconciling" as const, note: "Settlement review pending" }
];

export function SystemHealthPage() {
  return (
    <DataPanel
      title="System health"
      description="Product-level service readiness for organizer operations."
    >
      <div className="grid gap-3 md:grid-cols-2">
        {services.map((service) => (
          <div
            key={service.name}
            className="flex items-center justify-between gap-4 rounded-lg border border-[--op-border] p-4"
          >
            <div>
              <p className="font-semibold">{service.name}</p>
              <p className="text-sm text-[--op-muted]">{service.note}</p>
            </div>
            <StatusBadge status={service.status} label={service.status} />
          </div>
        ))}
      </div>
    </DataPanel>
  );
}
```

- [ ] **Step 6: Wire all routes**

Modify `apps/organizer-portal/src/App.tsx` imports:

```tsx
import { BrowserRouter, Route, Routes, useLocation } from "react-router-dom";
import { AppShell } from "@/components/AppShell";
import { CheckinPage } from "@/pages/CheckinPage";
import { DisputesPage } from "@/pages/DisputesPage";
import { EventsPage } from "@/pages/EventsPage";
import { InventoryPage } from "@/pages/InventoryPage";
import { NotFoundPage } from "@/pages/NotFoundPage";
import { OverviewPage } from "@/pages/OverviewPage";
import { RefundsPage } from "@/pages/RefundsPage";
import { SettlementPage } from "@/pages/SettlementPage";
import { SystemHealthPage } from "@/pages/SystemHealthPage";
```

Replace `pageMeta` and `RoutedApp` in `apps/organizer-portal/src/App.tsx`:

```tsx
const pageMeta: Record<string, { title: string; description: string }> = {
  "/": {
    title: "Operations Overview",
    description: "All organizer events, risk queues, and live operational health."
  },
  "/events": {
    title: "Events",
    description: "Create, edit, cancel, and monitor organizer-owned events."
  },
  "/inventory": {
    title: "Ticket Inventory",
    description: "Track sold, locked, and available inventory by event."
  },
  "/check-in": {
    title: "Live Check-In",
    description: "Watch gate health, duplicate scans, invalid scans, and sync jobs."
  },
  "/refunds": {
    title: "Refunds",
    description: "Monitor refund requests, payout retries, and cancellation impact."
  },
  "/disputes": {
    title: "Disputes",
    description: "Review SLA-driven support and moderation cases."
  },
  "/settlement": {
    title: "Settlement",
    description: "Review revenue, resale royalties, reconciliation, and payout readiness."
  },
  "/health": {
    title: "System Health",
    description: "Check product-level readiness across operational services."
  }
};

function RoutedApp() {
  const location = useLocation();
  const meta = pageMeta[location.pathname] ?? {
    title: "Organizer Portal",
    description: "Manage event operations for your organizer account."
  };

  return (
    <AppShell title={meta.title} description={meta.description}>
      <Routes>
        <Route path="/" element={<OverviewPage />} />
        <Route path="/events" element={<EventsPage />} />
        <Route path="/inventory" element={<InventoryPage />} />
        <Route path="/check-in" element={<CheckinPage />} />
        <Route path="/refunds" element={<RefundsPage />} />
        <Route path="/disputes" element={<DisputesPage />} />
        <Route path="/settlement" element={<SettlementPage />} />
        <Route path="/health" element={<SystemHealthPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </AppShell>
  );
}
```

- [ ] **Step 7: Run tests, typecheck, and build**

Run:

```bash
pnpm --filter @ticket-platform/app-organizer-portal test:domain
pnpm --filter @ticket-platform/app-organizer-portal typecheck
pnpm --filter @ticket-platform/app-organizer-portal build
```

Expected: all commands PASS.

- [ ] **Step 8: Commit**

```bash
git add apps/organizer-portal/src/App.tsx apps/organizer-portal/src/pages/EventsPage.tsx apps/organizer-portal/src/pages/InventoryPage.tsx apps/organizer-portal/src/pages/CheckinPage.tsx apps/organizer-portal/src/pages/RefundsPage.tsx apps/organizer-portal/src/pages/DisputesPage.tsx apps/organizer-portal/src/pages/SettlementPage.tsx apps/organizer-portal/src/pages/SystemHealthPage.tsx
git commit -m "organizer-portal: add operational sections"
```

---

## Task 8: Visual Verification And Dev Server

**Files:**

- Modify only if verification reveals layout defects in files created by earlier tasks.

- [ ] **Step 1: Run final verification commands**

Run:

```bash
pnpm --filter @ticket-platform/app-organizer-portal test:domain
pnpm --filter @ticket-platform/app-organizer-portal typecheck
pnpm --filter @ticket-platform/app-organizer-portal build
```

Expected: all commands PASS.

- [ ] **Step 2: Start the organizer portal dev server**

Run:

```bash
pnpm --filter @ticket-platform/app-organizer-portal dev
```

Expected: Vite serves the app at `http://localhost:5178` or another available port if `5178` is occupied.

- [ ] **Step 3: Manual browser checks**

Open `http://localhost:5178` and check:

- Overview renders with light background, white cards, blue action styling.
- Sidebar navigation works for all sections.
- `Draft`, `Scheduled`, and `Upcoming` event statuses are blue, not green.
- `Active` and valid/success states are green.
- Amber states appear for pending, duplicate, and low inventory warnings.
- Red states appear only for failed, invalid, cancelled, blocked, or expired states.
- Purple states appear for review/reconciliation.
- At 375px width, tables scroll horizontally without text overlap.
- At 768px width, cards stack cleanly and sidebar remains usable.
- At 1024px and 1440px widths, dashboard cards and tables do not overlap.

- [ ] **Step 4: Fix any visual defects**

If text overlaps in tables, add or adjust `min-w-[...]`, `overflow-x-auto`, or responsive grid classes in the affected page. If badge contrast is weak, adjust `statusTones` Tailwind classes in `src/domain/status.ts` and rerun:

```bash
pnpm --filter @ticket-platform/app-organizer-portal test:domain
pnpm --filter @ticket-platform/app-organizer-portal typecheck
pnpm --filter @ticket-platform/app-organizer-portal build
```

Expected: all commands PASS after each fix.

- [ ] **Step 5: Commit final verification fixes**

If files changed:

```bash
git add apps/organizer-portal
git commit -m "organizer-portal: polish responsive admin UI"
```

If no files changed, do not create an empty commit.

---

## Self-Review

Spec coverage:

- Dedicated `apps/organizer-portal` React app: Task 1.
- Clean Blue SaaS visual system: Tasks 1, 5, 6, 8.
- Single Organizer Admin role: Task 5 shell.
- Overview dashboard: Tasks 3 and 6.
- Event creation/edit/cancel surface: Task 7 creates the Events section and CTA; backend action wiring is intentionally left for a later implementation milestone.
- Ticket inventory: Task 7 Inventory page.
- Live check-in: Task 7 Check-in page.
- Refunds, Disputes, Settlement, System Health: Task 7.
- Status color system: Task 2 and Task 8 visual checks.
- Adapter seam and partial backend readiness: Task 4.
- Testing: Tasks 2, 3, 6, 7, 8.

No deferred-code markers remain in implementation snippets. The only intentionally non-functional backend items are represented as visible UI sections and typed adapter seams, matching the approved UI-first milestone.
