#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 2 ]]; then
  echo "Usage: $0 <environment> <release-id>"
  exit 1
fi

ENVIRONMENT="$1"
RELEASE_ID="$2"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPORT_DIR="$ROOT_DIR/artifacts/deploy"
REPORT_FILE="$REPORT_DIR/rollback-${ENVIRONMENT}.json"

mkdir -p "$REPORT_DIR"

jq -n \
  --arg env "$ENVIRONMENT" \
  --arg releaseId "$RELEASE_ID" \
  --arg generatedAt "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  '{environment: $env, releaseId: $releaseId, action: "rollback", result: "simulated_success", generatedAt: $generatedAt}' \
  > "$REPORT_FILE"

cat "$REPORT_FILE"
