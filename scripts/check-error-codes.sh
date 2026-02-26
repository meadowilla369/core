#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

tmp_service_codes="$(mktemp)"
tmp_dict_codes="$(mktemp)"
trap 'rm -f "$tmp_service_codes" "$tmp_dict_codes"' EXIT

rg -oN 'code:\s*"[A-Z0-9_]+"' services/*/src/server.ts \
  | sed -E 's/.*"([A-Z0-9_]+)"/\1/' \
  | sort -u >"$tmp_service_codes"

rg -oN '^\s*[A-Z0-9_]+:' packages/shared-types/src/error-codes.ts \
  | sed -E 's/^[[:space:]]*([A-Z0-9_]+):/\1/' \
  | sort -u >"$tmp_dict_codes"

missing="$(comm -23 "$tmp_service_codes" "$tmp_dict_codes" || true)"

if [[ -n "$missing" ]]; then
  echo "Missing codes in shared dictionary:"
  echo "$missing"
  exit 1
fi

echo "Error code dictionary is in sync."
