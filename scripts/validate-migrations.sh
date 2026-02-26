#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MIGRATION_DIR="$ROOT_DIR/infra/db/migrations"

if [[ ! -d "$MIGRATION_DIR" ]]; then
  echo "Migration directory not found: $MIGRATION_DIR"
  exit 1
fi

files=()
while IFS= read -r file; do
  files+=("$file")
done < <(find "$MIGRATION_DIR" -maxdepth 1 -type f -name '*.sql' | sort)

if [[ ${#files[@]} -eq 0 ]]; then
  echo "No migration files found."
  exit 1
fi

last_prefix=0
seen_prefixes=""

for file in "${files[@]}"; do
  base="$(basename "$file")"

  if [[ "$base" == *down* || "$base" == *rollback* ]]; then
    echo "Forward-only policy violation in filename: $base"
    exit 1
  fi

  if [[ ! "$base" =~ ^([0-9]{4})_[a-z0-9_]+\.sql$ ]]; then
    echo "Invalid migration filename format: $base"
    echo "Expected format: 0001_description.sql"
    exit 1
  fi

  prefix="${BASH_REMATCH[1]}"
  prefix_num=$((10#$prefix))

  if [[ "$seen_prefixes" == *"|$prefix|"* ]]; then
    echo "Duplicate migration prefix detected: $prefix"
    exit 1
  fi
  seen_prefixes+="|$prefix|"

  if (( prefix_num <= last_prefix )); then
    echo "Migration order violation: $base"
    exit 1
  fi
  last_prefix=$prefix_num

  if rg -n "^\\s*DROP\\s+TABLE|^\\s*DROP\\s+TYPE|^\\s*TRUNCATE\\s+TABLE" "$file" >/dev/null; then
    echo "Forward-only policy violation: destructive statement found in $base"
    exit 1
  fi
done

echo "Migration policy check passed (${#files[@]} files)."
