#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

chmod +x ./bin/pnpm ./scripts/dev-stack.sh ./scripts/localchain.sh ./scripts/localchain-smoke.sh

if [[ ! -f .env || ! -s .env ]]; then
  cp .env.example .env
  echo "Created .env from .env.example"
fi

echo "== Ticket Platform bootstrap =="
echo "1) Local pnpm shim ready: ./bin/pnpm"
echo "2) Install deps: PATH=\"$ROOT_DIR/bin:$PATH\" pnpm install"
echo "3) Build workspace: npm run build"
echo "4) Start local infra + app stack: npm run stack:up"
echo "5) Verify stack: npm run stack:smoke"
echo "6) Contracts tests: (cd contracts && forge test --offline)"
echo "7) Local chain + BE: npm run stack:localchain:up"
echo "8) Local chain smoke only: npm run stack:localchain:smoke"
echo "9) Local chain FE: npm run web:localchain:dev"
