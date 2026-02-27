#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${1:-$ROOT_DIR/deploy-config/localhost.env}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing ${ENV_FILE}."
  echo "Copy from $ROOT_DIR/deploy-config/localhost.env.example"
  exit 1
fi

set -a
source "$ENV_FILE"
set +a

if [[ -z "${RPC_URL:-}" || -z "${PRIVATE_KEY:-}" ]]; then
  echo "RPC_URL and PRIVATE_KEY are required in $ENV_FILE"
  exit 1
fi

echo "Deploying contracts to localhost RPC: $RPC_URL"
forge script "$ROOT_DIR/script/DeployPlatform.s.sol:DeployPlatform" \
  --rpc-url "$RPC_URL" \
  --private-key "$PRIVATE_KEY" \
  --broadcast

echo "Deployment broadcast written under: $ROOT_DIR/broadcast/"
