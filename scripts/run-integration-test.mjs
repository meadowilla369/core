import { spawnSync } from "node:child_process";

const target = process.argv[2]?.trim() ?? "";

const scriptByTarget = new Map([
  ["payment-orchestrator", "test:payment-orchestrator"],
  ["flow1", "test:flow1"],
  ["backend", "test:backend"],
  ["critical", "test:critical"],
  ["e2e", "test:e2e"],
  ["load", "test:load"],
  ["chaos", "test:chaos"],
  ["contracts", "test:contracts"]
]);

if (!target) {
  console.error("Usage: pnpm test:integration <target>");
  console.error(`Supported targets: ${Array.from(scriptByTarget.keys()).join(", ")}`);
  process.exit(1);
}

const scriptName = scriptByTarget.get(target);
if (!scriptName) {
  console.error(`Unknown integration target: ${target}`);
  console.error(`Supported targets: ${Array.from(scriptByTarget.keys()).join(", ")}`);
  process.exit(1);
}

const result = spawnSync("npm", ["--prefix", "packages/integration-suite", "run", scriptName], {
  stdio: "inherit"
});

if (typeof result.status === "number") {
  process.exit(result.status);
}

process.exit(1);
