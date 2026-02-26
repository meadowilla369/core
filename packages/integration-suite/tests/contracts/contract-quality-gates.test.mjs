import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const THIS_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(THIS_DIR, "../../../..");

test("contract quality gates script succeeds", () => {
  const result = spawnSync("bash", ["scripts/run-contract-quality-gates.sh"], {
    cwd: REPO_ROOT,
    encoding: "utf8"
  });

  const output = [result.stdout, result.stderr].filter(Boolean).join("\n");
  assert.equal(result.status, 0, `contract quality gates failed\n${output}`);
});
