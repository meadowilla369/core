#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "Usage: $0 <base-sepolia|base-mainnet>"
  exit 1
fi

network="$1"
case "$network" in
  base-sepolia)
    env_file="deploy-config/base-sepolia.env"
    ;;
  base-mainnet)
    env_file="deploy-config/base-mainnet.env"
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

set -a
source "$env_file"
set +a

forge script script/DeployPlatform.s.sol:DeployPlatform \
  --rpc-url "$RPC_URL" \
  --private-key "$PRIVATE_KEY" \
  --broadcast \
  --verify
