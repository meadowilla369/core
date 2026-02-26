#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [[ ! -f "$ROOT_DIR/docs/release/ROLLBACK_CRITERIA.md" ]]; then
  echo "Missing rollback criteria"
  exit 1
fi

if [[ ! -f "$ROOT_DIR/docs/ops/OBSERVABILITY_RUNBOOKS.md" ]]; then
  echo "Missing observability runbook"
  exit 1
fi

echo "Incident rollback criteria validated"
