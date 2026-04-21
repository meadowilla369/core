# Home/Discover Poster-First Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refresh `apps/web` Home and Discover into a poster-first, trust-aware browsing surface without changing routes or backend contracts.

**Architecture:** Keep the existing `useEventCatalog()` data source and `MobileLayout`, add a local poster/discovery view-model layer, then compose new hero/card/modal/sheet components on top of that layer. Retrofit `HomePage` and `DiscoverPage` incrementally so fallback data still renders a complete experience.

**Tech Stack:** React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui, TanStack Query, Node built-in test runner

---

### Task 1: Add poster/discovery view-model helpers

**Files:**

- Create: `apps/web/src/features/discover/event-posters.ts`
- Create: `apps/web/src/features/discover/event-posters.test.ts`
- Modify: `apps/web/package.json`

- [ ] **Step 1: Write the failing test**

```ts
import test from "node:test";
import assert from "node:assert/strict";

import { buildHomeSections, filterPosterEvents, toPosterEventViews } from "./event-posters";
import { discoverFallback } from "./fallback-data";

test("toPosterEventViews adds trust and mood metadata", () => {
  const [event] = toPosterEventViews(discoverFallback.slice(0, 1));
  assert.equal(typeof event.mood, "string");
  assert.equal(event.trustBadges.length > 0, true);
  assert.equal(typeof event.startingPriceLabel, "string");
});

test("buildHomeSections produces a hero and curated buckets", () => {
  const sections = buildHomeSections(toPosterEventViews(discoverFallback));
  assert.equal(Boolean(sections.hero), true);
  assert.equal(sections.editorPicks.length > 0, true);
  assert.equal(sections.hotNow.length > 0, true);
});

test("filterPosterEvents respects query and toggles", () => {
  const posters = toPosterEventViews(discoverFallback);
  const results = filterPosterEvents(posters, {
    query: "Jazz",
    category: "Tất cả",
    mood: "Tất cả",
    verifiedOnly: false,
    budgetOnly: false
  });
  assert.equal(
    results.some((event) => event.name.includes("Jazz")),
    true
  );
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test --experimental-strip-types apps/web/src/features/discover/event-posters.test.ts`
Expected: FAIL with module or export errors because `event-posters.ts` does not exist yet.

- [ ] **Step 3: Write minimal implementation**

```ts
export interface PosterEventView extends EventCardView {
  mood: string;
  highlight: string;
  trustBadges: string[];
  startingPriceLabel: string;
}

export function toPosterEventViews(events: EventCardView[]): PosterEventView[] {
  return events.map((event, index) => ({
    ...event,
    mood: index % 2 === 0 ? "Night out" : "Weekend",
    highlight: "Verified listing",
    trustBadges: ["Verified"],
    startingPriceLabel: `Từ ${event.price}`
  }));
}
```

Then expand that file to include:

- `buildHomeSections(...)`
- `filterPosterEvents(...)`
- stable poster palette selection and derived metadata fields used by UI

Also add a package script:

```json
"test:ui-home-discover": "node --test --experimental-strip-types src/features/discover/event-posters.test.ts"
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && pnpm test:ui-home-discover`
Expected: PASS with all tests green.

- [ ] **Step 5: Commit**

```bash
git add apps/web/package.json apps/web/src/features/discover/event-posters.ts apps/web/src/features/discover/event-posters.test.ts
git commit -m "feat(web): add poster discovery view models"
```

### Task 2: Add poster-first mobile UI building blocks

**Files:**

- Create: `apps/web/src/components/mobile/EventPosterCard.tsx`
- Create: `apps/web/src/components/mobile/PosterSpotlightHero.tsx`
- Create: `apps/web/src/components/mobile/EditorialSectionBlock.tsx`
- Create: `apps/web/src/components/mobile/TrustInfoModal.tsx`
- Create: `apps/web/src/components/mobile/QuickPreviewModal.tsx`
- Create: `apps/web/src/components/mobile/DiscoverFilterSheet.tsx`

- [ ] **Step 1: Write the failing test**

Use the existing helper tests as the behavioral guardrail and add one rendering-focused assertion around card metadata derivation if needed:

```ts
test("filtered poster events expose badge-ready trust labels", () => {
  const [event] = filterPosterEvents(toPosterEventViews(discoverFallback), {
    query: "",
    category: "Tất cả",
    mood: "Tất cả",
    verifiedOnly: true,
    budgetOnly: false
  });
  assert.equal(event.trustBadges.includes("Verified"), true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && pnpm test:ui-home-discover`
Expected: FAIL until the helper layer exposes the badge-ready fields the new components need.

- [ ] **Step 3: Write minimal implementation**

Create focused components with these responsibilities:

- `EventPosterCard.tsx`
  - image-led tile
  - dark overlay
  - top badges
  - title/date/location
  - compact trust row
  - preview action + detail link

- `PosterSpotlightHero.tsx`
  - large hero poster
  - trust badges
  - trust panel
  - CTA row

- `EditorialSectionBlock.tsx`
  - section label/title
  - optional subtitle/action slot
  - child grid/rail wrapper

- `TrustInfoModal.tsx`
  - explain `Verified`, `Resale safe`, `Official seller`, `Sync`

- `QuickPreviewModal.tsx`
  - larger art
  - metadata summary
  - CTA to event detail

- `DiscoverFilterSheet.tsx`
  - mood/category toggles
  - `verifiedOnly`
  - `budgetOnly`

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && pnpm test:ui-home-discover`
Expected: PASS after the helper contract and component data requirements align.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/mobile/EventPosterCard.tsx apps/web/src/components/mobile/PosterSpotlightHero.tsx apps/web/src/components/mobile/EditorialSectionBlock.tsx apps/web/src/components/mobile/TrustInfoModal.tsx apps/web/src/components/mobile/QuickPreviewModal.tsx apps/web/src/components/mobile/DiscoverFilterSheet.tsx apps/web/src/features/discover/event-posters.ts apps/web/src/features/discover/event-posters.test.ts
git commit -m "feat(web): add poster-first discovery components"
```

### Task 3: Retrofit HomePage

**Files:**

- Modify: `apps/web/src/pages/HomePage.tsx`
- Test: `apps/web/src/features/discover/event-posters.test.ts`

- [ ] **Step 1: Write the failing test**

Add a helper-level assertion for `buildHomeSections(...)` that requires the section names and card counts used by the page:

```ts
test("buildHomeSections returns multiple editorial groups", () => {
  const sections = buildHomeSections(toPosterEventViews(discoverFallback));
  assert.equal(sections.nearYou.length > 0, true);
  assert.equal(sections.byMood.length > 0, true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && pnpm test:ui-home-discover`
Expected: FAIL until the section builder exposes the required groups.

- [ ] **Step 3: Write minimal implementation**

Replace the current `HomePage` layout with:

- sticky header and category rail
- `PosterSpotlightHero`
- editorial section blocks for:
  - `Hot now`
  - `Near you`
  - `Editor picks`
  - `By mood`
- `QuickPreviewModal`
- `TrustInfoModal`
- loading skeleton blocks
- fallback notice preserved as a small operational banner

Use `EventPosterCard` for all poster tiles. Keep `MobileLayout` and existing route links.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && pnpm test:ui-home-discover`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/pages/HomePage.tsx apps/web/src/features/discover/event-posters.test.ts apps/web/src/features/discover/event-posters.ts
git commit -m "feat(web): redesign home with poster spotlight"
```

### Task 4: Retrofit DiscoverPage

**Files:**

- Modify: `apps/web/src/pages/DiscoverPage.tsx`
- Test: `apps/web/src/features/discover/event-posters.test.ts`

- [ ] **Step 1: Write the failing test**

Add helper assertions for Discover filtering:

```ts
test("filterPosterEvents supports verified-only and budget-only discover states", () => {
  const posters = toPosterEventViews(discoverFallback);
  const results = filterPosterEvents(posters, {
    query: "",
    category: "Tất cả",
    mood: "Tất cả",
    verifiedOnly: true,
    budgetOnly: true
  });
  assert.equal(
    results.every((event) => event.verified),
    true
  );
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && pnpm test:ui-home-discover`
Expected: FAIL until the helper returns enough state for these filters.

- [ ] **Step 3: Write minimal implementation**

Refactor `DiscoverPage` to include:

- richer search header
- `useDeferredValue` for search input
- quick chips for categories/moods
- `DiscoverFilterSheet`
- poster mosaic feed using mixed card spans
- `QuickPreviewModal`
- better empty state
- fallback notice preserved

The page should still work entirely from `discoverFallback` when the API fails.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && pnpm test:ui-home-discover`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/pages/DiscoverPage.tsx apps/web/src/features/discover/event-posters.test.ts apps/web/src/features/discover/event-posters.ts
git commit -m "feat(web): redesign discover as poster mosaic"
```

### Task 5: Verify integration quality

**Files:**

- Verify only: `apps/web`

- [ ] **Step 1: Run targeted tests**

Run: `cd apps/web && pnpm test:ui-home-discover`
Expected: PASS.

- [ ] **Step 2: Run static verification**

Run: `cd apps/web && pnpm typecheck`
Expected: PASS with no TypeScript errors.

- [ ] **Step 3: Run lint**

Run: `cd apps/web && pnpm lint`
Expected: PASS with no ESLint errors.

- [ ] **Step 4: Run production build**

Run: `cd apps/web && pnpm build`
Expected: PASS with Vite production output.

- [ ] **Step 5: Commit**

```bash
git add apps/web
git commit -m "feat(web): ship poster-first home and discover refresh"
```
