import assert from "node:assert/strict";
import test from "node:test";

import { buildEntrCustomSchemeLink } from "./appLinks.ts";
import { applyEntrDeepLink } from "./nativeDeepLinks.ts";

test("applyEntrDeepLink exchanges handoff token before routing to discover", async () => {
  const exchangedTokens: string[] = [];
  const navigatedPaths: string[] = [];
  const url = buildEntrCustomSchemeLink("/discover", { handoffToken: "hnd_123" });

  await applyEntrDeepLink(
    url,
    (path) => {
      navigatedPaths.push(path);
    },
    async (handoffToken) => {
      exchangedTokens.push(handoffToken);
    }
  );

  assert.deepEqual(exchangedTokens, ["hnd_123"]);
  assert.deepEqual(navigatedPaths, ["/discover"]);
});
