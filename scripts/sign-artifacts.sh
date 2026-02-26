#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUTPUT_DIR="$ROOT_DIR/artifacts/signatures"
MANIFEST_PATH="$OUTPUT_DIR/checksums.sha256"

mkdir -p "$OUTPUT_DIR"
: >"$MANIFEST_PATH"

append_checksums() {
  local pattern="$1"
  while IFS= read -r path; do
    [[ -f "$path" ]] || continue
    local rel
    rel="${path#"$ROOT_DIR"/}"
    shasum -a 256 "$path" | awk -v rel="$rel" '{print $1 "  " rel}' >>"$MANIFEST_PATH"
  done < <(find "$ROOT_DIR" -path "$pattern" -type f | sort)
}

append_checksums "$ROOT_DIR/apps/*/dist/*"
append_checksums "$ROOT_DIR/services/*/dist/*"
append_checksums "$ROOT_DIR/packages/*/dist/*"
append_checksums "$ROOT_DIR/contracts/abi/*"
append_checksums "$ROOT_DIR/infra/db/migrations/*"

if [[ -f "$ROOT_DIR/docs/api/openapi.yaml" ]]; then
  shasum -a 256 "$ROOT_DIR/docs/api/openapi.yaml" | awk '{print $1 "  docs/api/openapi.yaml"}' >>"$MANIFEST_PATH"
fi

sort -u "$MANIFEST_PATH" -o "$MANIFEST_PATH"

echo "checksum_manifest_path=$MANIFEST_PATH"
echo "Artifact checksum manifest generated."
