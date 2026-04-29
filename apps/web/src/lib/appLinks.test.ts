import assert from "node:assert/strict";
import test from "node:test";

import {
  buildEntrCustomSchemeLink,
  buildEntrUniversalLink,
  ENTR_DISCOVER_PATH,
  openEntrDiscoverApp,
  parseEntrDeepLink
} from "./appLinks.ts";

test("Entr app links open the custom scheme when no owned Universal Link domain is configured", () => {
  const assignedUrls: string[] = [];
  const windowRef = {
    location: {
      href: "",
      assign(url: string) {
        assignedUrls.push(url);
      }
    }
  };

  assert.equal(ENTR_DISCOVER_PATH, "/discover");
  assert.equal(buildEntrUniversalLink(), null);
  assert.equal(buildEntrCustomSchemeLink(), "entr://discover");
  assert.equal(
    buildEntrCustomSchemeLink("/discover", { handoffToken: "hnd_123" }),
    "entr://discover?handoff_token=hnd_123"
  );

  openEntrDiscoverApp({ handoffToken: "hnd_123" }, windowRef);

  const parsed = parseEntrDeepLink(assignedUrls[0]);
  assert.equal(parsed.path, "/discover");
  assert.equal(parsed.handoffToken, "hnd_123");
});

test("Entr app links can use a real Universal Link origin when one is configured", () => {
  assert.equal(buildEntrUniversalLink("/discover", "https://app.example.com/"), "https://app.example.com/discover");
  assert.equal(buildEntrUniversalLink("discover", "https://app.example.com"), "https://app.example.com/discover");
});

test("Entr app links never place wallet secrets in the deep link", () => {
  const url = buildEntrCustomSchemeLink("/discover", { handoffToken: "hnd_123" });
  const parsed = parseEntrDeepLink(url);

  assert.equal(url.includes("privateKey"), false);
  assert.equal(url.includes("walletAddress"), false);
  assert.equal(url.includes("accessToken"), false);
  assert.equal(parsed.handoffToken, "hnd_123");
});
