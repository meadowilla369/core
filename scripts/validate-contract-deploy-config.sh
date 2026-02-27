#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <env-file>"
  exit 1
fi

ENV_FILE="$1"
if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing env file: $ENV_FILE"
  exit 1
fi

required_vars=(
  RPC_URL
  PRIVATE_KEY
  DEPLOY_ADMIN
  ENTRYPOINT_ADDRESS
  SESSION_SIGNER
  GUARDIAN_ADDRESS
  GUARDIAN_OWNER
  ESCROW_HOOK
  GUARDIAN_RECOVERY_DELAY
)

missing=0

if command -v rg >/dev/null 2>&1; then
  has_var() {
    rg -q "^${1}=" "$2"
  }
else
  has_var() {
    grep -q "^${1}=" "$2"
  }
fi

for var in "${required_vars[@]}"; do
  if ! has_var "$var" "$ENV_FILE"; then
    echo "Missing required var: ${var}"
    missing=1
  fi
done

if [[ $missing -ne 0 ]]; then
  exit 1
fi

echo "Contract deploy config valid: $ENV_FILE"
