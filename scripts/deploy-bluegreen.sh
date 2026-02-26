#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 2 ]]; then
  echo "Usage: $0 <environment> <image-tag>"
  exit 1
fi

ENVIRONMENT="$1"
IMAGE_TAG="$2"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPORT_DIR="$ROOT_DIR/artifacts/deploy"
REPORT_FILE="$REPORT_DIR/bluegreen-${ENVIRONMENT}.json"

mkdir -p "$REPORT_DIR"

jq -n \
  --arg env "$ENVIRONMENT" \
  --arg image "$IMAGE_TAG" \
  --arg generatedAt "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  '{environment: $env, imageTag: $image, strategy: "blue-green", result: "simulated_success", generatedAt: $generatedAt}' \
  > "$REPORT_FILE"

cat "$REPORT_FILE"
