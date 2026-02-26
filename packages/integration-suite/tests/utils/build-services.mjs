import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const THIS_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(THIS_DIR, "../../../..");

const TS_PROJECTS = [
  "services/api-gateway/tsconfig.json",
  "services/auth-service/tsconfig.json",
  "services/checkin-service/tsconfig.json",
  "services/dispute-service/tsconfig.json",
  "services/event-service/tsconfig.json",
  "services/kyc-service/tsconfig.json",
  "services/marketplace-service/tsconfig.json",
  "services/payment-orchestrator/tsconfig.json",
  "services/recovery-service/tsconfig.json",
  "services/refund-service/tsconfig.json",
  "services/ticketing-service/tsconfig.json",
  "services/worker-mint/tsconfig.json",
  "apps/mobile/tsconfig.json",
  "apps/staff-scanner/tsconfig.json"
];

for (const project of TS_PROJECTS) {
  const result = spawnSync("npx", ["tsc", "-p", project], {
    cwd: REPO_ROOT,
    encoding: "utf8"
  });

  if (result.status !== 0) {
    const output = [result.stdout, result.stderr].filter(Boolean).join("\n");
    console.error(`Failed to build ${project}`);
    console.error(output);
    process.exit(result.status ?? 1);
  }
}
