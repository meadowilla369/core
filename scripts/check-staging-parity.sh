#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STAGING_FILE="$ROOT_DIR/infra/terraform/envs/staging/main.tf"
PROD_FILE="$ROOT_DIR/infra/terraform/envs/prod/main.tf"
REPORT_DIR="$ROOT_DIR/artifacts/parity"
REPORT_FILE="$REPORT_DIR/staging-parity.json"

mkdir -p "$REPORT_DIR"

extract_modules() {
  local file="$1"
  rg -N '^module\s+"[^"]+"' "$file" | sed -E 's/module\s+"([^"]+)".*/\1/' | sort
}

staging_modules="$(extract_modules "$STAGING_FILE")"
prod_modules="$(extract_modules "$PROD_FILE")"

if [[ "$staging_modules" == "$prod_modules" ]]; then
  status="pass"
  mismatch="[]"
else
  status="fail"
  mismatch="$(comm -3 <(printf '%s\n' "$staging_modules") <(printf '%s\n' "$prod_modules") | jq -R -s 'split("\n") | map(select(length>0))')"
fi

jq -n \
  --arg status "$status" \
  --arg generatedAt "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  --argjson mismatch "$mismatch" \
  '{status: $status, generatedAt: $generatedAt, mismatchedModules: $mismatch}' \
  > "$REPORT_FILE"

cat "$REPORT_FILE"

if [[ "$status" != "pass" ]]; then
  echo "Staging parity check failed"
  exit 1
fi
