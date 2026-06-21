#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$ROOT_DIR/.env.localchain"
STATE_DIR="$ROOT_DIR/.tmp/localchain"
FE_PREVIEW_PID_FILE="$STATE_DIR/web-preview.pid"
FE_PREVIEW_LOG_FILE="$STATE_DIR/web-preview.log"
SMOKE_OUTPUT_FILE="$ROOT_DIR/contracts/deployments/localchain-smoke.json"

mkdir -p "$STATE_DIR"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing $ENV_FILE. Run 'npm run chain:up' or 'npm run stack:localchain:up' first."
  exit 1
fi

set -a
source "$ENV_FILE"
set +a

PATH="$ROOT_DIR/bin:$PATH"

LOCALCHAIN_SMOKE_ADMIN_PRIVATE_KEY="${LOCALCHAIN_SMOKE_ADMIN_PRIVATE_KEY:-$PRIVATE_KEY}"
LOCALCHAIN_SMOKE_BUYER_PRIVATE_KEY="${LOCALCHAIN_SMOKE_BUYER_PRIVATE_KEY:-0x59c6995e998f97a5a0044976f5f0e7cf9874a3f5f6b0dd8f04fbfdbb6c42fbaa}"
LOCALCHAIN_SMOKE_FE_PORT="${LOCALCHAIN_SMOKE_FE_PORT:-4180}"
LOCALCHAIN_SMOKE_EVENT_ID="${LOCALCHAIN_SMOKE_EVENT_ID:-900001}"
LOCALCHAIN_SMOKE_TICKET_TYPE_ID="${LOCALCHAIN_SMOKE_TICKET_TYPE_ID:-1}"
LOCALCHAIN_SMOKE_QUANTITY="${LOCALCHAIN_SMOKE_QUANTITY:-1}"

lowercase() {
  printf '%s' "$1" | tr '[:upper:]' '[:lower:]'
}

cleanup() {
  if [[ -f "$FE_PREVIEW_PID_FILE" ]]; then
    local pid
    pid="$(cat "$FE_PREVIEW_PID_FILE")"
    if kill -0 "$pid" >/dev/null 2>&1; then
      kill "$pid" >/dev/null 2>&1 || true
      for _ in $(seq 1 10); do
        if ! kill -0 "$pid" >/dev/null 2>&1; then
          break
        fi
        sleep 1
      done
      if kill -0 "$pid" >/dev/null 2>&1; then
        kill -9 "$pid" >/dev/null 2>&1 || true
      fi
    fi
    rm -f "$FE_PREVIEW_PID_FILE"
  fi
}

trap cleanup EXIT

fail() {
  echo "Smoke failed: $1" >&2
  exit 1
}

check_http() {
  local label="$1"
  local url="$2"
  local body
  if ! body="$(curl -fsS "$url")"; then
    fail "$label unavailable at $url"
  fi
  echo "✓ $label -> $url"
  printf '%s' "$body"
}

check_rpc_chain_id() {
  local response
  response="$(
    curl -fsS \
      -H "content-type: application/json" \
      -d '{"jsonrpc":"2.0","id":1,"method":"eth_chainId","params":[]}' \
      "$RPC_URL"
  )"
  local actual
  actual="$(
    node -e '
      const payload = JSON.parse(process.argv[1]);
      if (!payload.result) process.exit(1);
      console.log(Number(payload.result));
    ' "$response"
  )" || fail "RPC chainId response is invalid"

  if [[ "$actual" != "$CHAIN_ID" ]]; then
    fail "RPC chainId mismatch: expected $CHAIN_ID, got $actual"
  fi

  echo "✓ RPC chainId -> $actual"
}

check_contract_code() {
  local label="$1"
  local address="$2"
  local code
  code="$(cast code "$address" --rpc-url "$RPC_URL" 2>/dev/null || true)"
  if [[ -z "$code" || "$code" == "0x" ]]; then
    fail "$label has no deployed bytecode at $address"
  fi
  echo "✓ $label code -> $address"
}

wait_for_token_sync() {
  local token_id="$1"
  local buyer_address="$2"

  for _ in $(seq 1 30); do
    local token_json
    token_json="$(curl -fsS "http://127.0.0.1:3014/internal/contracts/tokens/$token_id" 2>/dev/null || true)"
    if [[ -n "$token_json" ]]; then
      local owner
      owner="$(
        node -e '
          const payload = JSON.parse(process.argv[1]);
          const owner = payload?.data?.ownerWalletAddress ?? "";
          process.stdout.write(String(owner));
        ' "$token_json"
      )"
      if [[ "$(lowercase "$owner")" == "$(lowercase "$buyer_address")" ]]; then
        echo "✓ RPC listener sync -> token $token_id owner $(lowercase "$buyer_address")"
        return 0
      fi
    fi
    sleep 1
  done

  fail "contract-sync-service did not ingest token $token_id from RPC listener"
}

run_onchain_sync_probe() {
  local buyer_address
  buyer_address="$(cast wallet address --private-key "$LOCALCHAIN_SMOKE_BUYER_PRIVATE_KEY")"

  rm -f "$SMOKE_OUTPUT_FILE"

  (
    cd "$ROOT_DIR/contracts"
    LOCALCHAIN_SMOKE_ADMIN_PRIVATE_KEY="$LOCALCHAIN_SMOKE_ADMIN_PRIVATE_KEY" \
    LOCALCHAIN_SMOKE_BUYER_PRIVATE_KEY="$LOCALCHAIN_SMOKE_BUYER_PRIVATE_KEY" \
    LOCALCHAIN_SMOKE_EVENT_ID="$LOCALCHAIN_SMOKE_EVENT_ID" \
    LOCALCHAIN_SMOKE_TICKET_TYPE_ID="$LOCALCHAIN_SMOKE_TICKET_TYPE_ID" \
    LOCALCHAIN_SMOKE_QUANTITY="$LOCALCHAIN_SMOKE_QUANTITY" \
    LOCALCHAIN_SMOKE_OUTPUT_PATH="deployments/localchain-smoke.json" \
    forge script script/SmokeSyncEvent.s.sol:SmokeSyncEvent \
      --rpc-url "$RPC_URL" \
      --private-key "$LOCALCHAIN_SMOKE_ADMIN_PRIVATE_KEY" \
      --broadcast \
      >/dev/null
  )

  [[ -f "$SMOKE_OUTPUT_FILE" ]] || fail "Smoke output file was not generated"

  local token_id
  token_id="$(
    node -e '
      const fs = require("fs");
      const payload = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
      console.log(payload.tokenId);
    ' "$SMOKE_OUTPUT_FILE"
  )"

  wait_for_token_sync "$token_id" "$buyer_address"
}

run_fe_probe() {
  (
    VITE_API_BASE_URL="$VITE_API_BASE_URL" \
    VITE_HANDLER_ADDRESS="$VITE_HANDLER_ADDRESS" \
    VITE_DEMO_USER_ID="$VITE_DEMO_USER_ID" \
    VITE_DEMO_WALLET_ADDRESS="$VITE_DEMO_WALLET_ADDRESS" \
    npm --prefix "$ROOT_DIR/apps/web" run build:dev >/dev/null
  )

  (
    VITE_API_BASE_URL="$VITE_API_BASE_URL" \
    VITE_HANDLER_ADDRESS="$VITE_HANDLER_ADDRESS" \
    VITE_DEMO_USER_ID="$VITE_DEMO_USER_ID" \
    VITE_DEMO_WALLET_ADDRESS="$VITE_DEMO_WALLET_ADDRESS" \
    nohup npm --prefix "$ROOT_DIR/apps/web" run preview -- --host 127.0.0.1 --port "$LOCALCHAIN_SMOKE_FE_PORT" --strictPort \
      >"$FE_PREVIEW_LOG_FILE" 2>&1 &
    echo $! >"$FE_PREVIEW_PID_FILE"
  )

  for _ in $(seq 1 30); do
    if curl -fsS "http://127.0.0.1:$LOCALCHAIN_SMOKE_FE_PORT" >/dev/null 2>&1; then
      break
    fi
    sleep 1
  done

  local fe_html
  fe_html="$(curl -fsS "http://127.0.0.1:$LOCALCHAIN_SMOKE_FE_PORT")" || fail "FE preview is unavailable"
  [[ "$fe_html" == *"<div id=\"root\"></div>"* ]] || fail "FE preview returned unexpected HTML"

  echo "✓ FE preview -> http://127.0.0.1:$LOCALCHAIN_SMOKE_FE_PORT"
}

echo "== Local-chain smoke =="
check_rpc_chain_id
check_contract_code "TicketLedger" "$TICKET_LEDGER_ADDRESS"
check_contract_code "MarketplaceV2" "$MARKETPLACE_ADDRESS"
check_http "API gateway health" "http://127.0.0.1:3000/healthz" >/dev/null
check_http "Auth service health" "http://127.0.0.1:3001/healthz" >/dev/null
check_http "User service health" "http://127.0.0.1:3002/healthz" >/dev/null
check_http "Event service health" "http://127.0.0.1:3004/healthz" >/dev/null
check_http "Ticketing service health" "http://127.0.0.1:3005/healthz" >/dev/null
check_http "Payment orchestrator health" "http://127.0.0.1:3006/healthz" >/dev/null
check_http "Marketplace service health" "http://127.0.0.1:3007/healthz" >/dev/null
check_http "Check-in service health" "http://127.0.0.1:3008/healthz" >/dev/null
check_http "Contract sync health" "http://127.0.0.1:3014/healthz" >/dev/null
check_http "Contract sync status" "http://127.0.0.1:3014/sync/status" >/dev/null
run_onchain_sync_probe
run_fe_probe

echo "Smoke checks passed."
