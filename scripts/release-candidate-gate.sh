#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

required_files=(
  "$ROOT_DIR/docs/release/RELEASE_CANDIDATE_CHECKLIST.md"
  "$ROOT_DIR/docs/release/ROLLBACK_CRITERIA.md"
  "$ROOT_DIR/docs/ops/SOFT_LAUNCH_KPI_GATE.md"
)

for file in "${required_files[@]}"; do
  if [[ ! -f "$file" ]]; then
    echo "Missing required release doc: $file"
    exit 1
  fi
done

echo "Release candidate gate docs validated"
