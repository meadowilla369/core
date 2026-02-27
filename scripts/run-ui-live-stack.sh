#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
LOG_DIR="$ROOT_DIR/.tmp/ui-live-logs"
mkdir -p "$LOG_DIR"

PIDS=()

run_service() {
  local service_dir="$1"
  local log_name="$2"

  (
    cd "$ROOT_DIR/$service_dir"
    # Use non-watch mode to avoid EMFILE in constrained local environments.
    node --experimental-strip-types src/index.ts >"$LOG_DIR/$log_name.log" 2>&1
  ) &

  local pid="$!"
  PIDS+=("$pid")
  echo "[ui-live-stack] started $service_dir (pid=$pid)"
}

cleanup() {
  echo "[ui-live-stack] stopping services..."
  for pid in "${PIDS[@]:-}"; do
    if kill -0 "$pid" >/dev/null 2>&1; then
      kill "$pid" >/dev/null 2>&1 || true
    fi
  done
}

trap cleanup EXIT INT TERM

run_service "services/kyc-service" "kyc-service"
run_service "services/event-service" "event-service"
run_service "services/ticketing-service" "ticketing-service"
run_service "services/marketplace-service" "marketplace-service"
run_service "services/checkin-service" "checkin-service"
run_service "services/api-gateway" "api-gateway"

sleep 2

echo "[ui-live-stack] Logs: $LOG_DIR"
echo "[ui-live-stack] API Gateway: http://127.0.0.1:3000/healthz"
echo "[ui-live-stack] Keep this terminal open while running UI"

wait
