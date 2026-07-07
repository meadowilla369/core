#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
CONTRACTS_DIR="$ROOT_DIR/contracts"
VALIDATOR="$ROOT_DIR/scripts/validate-contract-deploy-config.sh"

if [[ $# -ne 1 ]]; then
  echo "Usage: $0 <base-sepolia|base-mainnet>"
  exit 1
fi

network="$1"
case "$network" in
  base-sepolia)
    env_file="$CONTRACTS_DIR/deploy-config/base-sepolia.env"
    deploy_output="$CONTRACTS_DIR/deployments/base-sepolia-addresses.json"
    ;;
  base-mainnet)
    env_file="$CONTRACTS_DIR/deploy-config/base-mainnet.env"
    deploy_output="$CONTRACTS_DIR/deployments/base-mainnet-addresses.json"
    ;;
  *)
    echo "Unsupported network: $network"
    exit 1
    ;;
esac

if [[ ! -f "$env_file" ]]; then
  echo "Missing $env_file. Copy from ${env_file}.example"
  exit 1
fi

"$VALIDATOR" "$env_file"

set -a
source "$env_file"
set +a

cd "$CONTRACTS_DIR"

expected_chain_id=""
case "$network" in
  base-sepolia) expected_chain_id="84532" ;;
  base-mainnet) expected_chain_id="8453" ;;
esac

actual_chain_id="$(cast chain-id --rpc-url "$RPC_URL" 2>/dev/null || true)"
if [[ -z "$actual_chain_id" ]]; then
  echo "Unable to read chain id from RPC_URL=$RPC_URL"
  echo "Check that this is a working Base RPC endpoint, not a placeholder or another network."
  exit 1
fi

if [[ "$actual_chain_id" != "$expected_chain_id" ]]; then
  echo "RPC_URL=$RPC_URL returned chain id $actual_chain_id, expected $expected_chain_id for $network"
  echo "Please update contracts/deploy-config/${network}.env to point at the correct Base RPC endpoint."
  exit 1
fi

DEPLOY_OUTPUT_PATH="$deploy_output" \
forge script script/DeployPlatform.s.sol:DeployPlatform \
  --rpc-url "$RPC_URL" \
  --private-key "$PRIVATE_KEY" \
  --broadcast \
  --slow \
  ${RESUME_DEPLOY:+--resume}

node "$ROOT_DIR/scripts/sync-base-sepolia-deployment.mjs" \
  --network "$network" \
  --deployment "$deploy_output" \
  --registry "$CONTRACTS_DIR/deployments/address-registry.json" \
  --template "$ROOT_DIR/config/environments/base-sepolia.env.example" \
  --env-output "$ROOT_DIR/config/environments/base-sepolia.env"
