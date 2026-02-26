#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONTRACTS_DIR="$ROOT_DIR/contracts"

cd "$CONTRACTS_DIR"

echo "[contracts] running offline unit/integration suite"
forge test --offline

echo "[contracts] running targeted fuzz/property-style foundry suite"
forge test --offline --match-path test/MarketplaceFuzz.t.sol

if command -v echidna-test >/dev/null 2>&1; then
  echo "[contracts] running echidna properties"
  echidna-test echidna/MarketplaceProperties.sol --contract MarketplaceProperties --config echidna/echidna.yaml
else
  echo "[contracts] echidna-test not installed; skipping echidna execution (config validated in repo)"
fi
