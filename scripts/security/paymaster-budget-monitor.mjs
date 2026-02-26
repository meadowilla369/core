import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const THIS_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(THIS_DIR, "../..");

const policyPath = path.resolve(ROOT_DIR, "config/security/paymaster-budget-controls.json");
const policy = JSON.parse(fs.readFileSync(policyPath, "utf8"));

const spentWei = BigInt(process.argv[2] ?? "0");
const dailyBudgetWei = BigInt(policy.dailyBudgetWei);

if (dailyBudgetWei === 0n) {
  console.error("Invalid budget policy");
  process.exit(1);
}

const usagePct = Number((spentWei * 10000n) / dailyBudgetWei) / 100;

const status =
  usagePct >= policy.blockThresholdPct
    ? "block"
    : usagePct >= policy.warningThresholdPct
      ? "warn"
      : "ok";

console.log(
  JSON.stringify(
    {
      status,
      usagePct,
      spentWei: spentWei.toString(),
      dailyBudgetWei: dailyBudgetWei.toString(),
      safeguards: policy.automaticSafeguards
    },
    null,
    2
  )
);

if (status === "block") {
  process.exit(2);
}
