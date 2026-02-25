#!/usr/bin/env bash
set -euo pipefail

echo "== Ticket Platform bootstrap =="
echo "1) Install pnpm if missing"
echo "2) Run: pnpm install"
echo "3) Run: pnpm build"
echo "4) Contracts tests: cd contracts && forge test --offline"
