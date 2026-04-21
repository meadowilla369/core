import assert from "node:assert/strict";
import test from "node:test";

import { discoverFallback } from "../../lib/fallback-data.ts";
import { buildHomeSections, filterPosterEvents, toPosterEventViews } from "./event-posters.ts";

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
  assert.equal(sections.nearYou.length > 0, true);
  assert.equal(sections.byMood.length > 0, true);
});

test("filterPosterEvents respects query and toggles", () => {
  const posters = toPosterEventViews(discoverFallback);

  const queryResults = filterPosterEvents(posters, {
    query: "Jazz",
    category: "Tất cả",
    mood: "Tất cả",
    verifiedOnly: false,
    budgetOnly: false
  });

  assert.equal(
    queryResults.some((event) => event.name.includes("Jazz")),
    true
  );

  const verifiedBudgetResults = filterPosterEvents(posters, {
    query: "",
    category: "Tất cả",
    mood: "Tất cả",
    verifiedOnly: true,
    budgetOnly: true
  });

  assert.equal(
    verifiedBudgetResults.every((event) => event.verified),
    true
  );
  assert.equal(
    verifiedBudgetResults.every((event) => event.priceValue <= 1000000),
    true
  );
});
