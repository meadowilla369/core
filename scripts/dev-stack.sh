#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STATE_DIR="$ROOT_DIR/.tmp/dev-stack"
LOG_DIR="$STATE_DIR/logs"
PID_DIR="$STATE_DIR/pids"
ENV_FILE="$ROOT_DIR/.env"

mkdir -p "$LOG_DIR" "$PID_DIR"

SERVICES=(
  "auth-service|http://127.0.0.1:3001/healthz|PORT=3001 node --env-file=.env services/auth-service/dist/index.js"
  "user-service|http://127.0.0.1:3002/healthz|PORT=3002 node --env-file=.env services/user-service/dist/index.js"
  "kyc-service|http://127.0.0.1:3003/healthz|PORT=3003 node --env-file=.env services/kyc-service/dist/index.js"
  "event-service|http://127.0.0.1:3004/healthz|PORT=3004 node --env-file=.env services/event-service/dist/index.js"
  "ticketing-service|http://127.0.0.1:3005/healthz|PORT=3005 node --env-file=.env services/ticketing-service/dist/index.js"
  "payment-orchestrator|http://127.0.0.1:3006/healthz|PORT=3006 node --env-file=.env services/payment-orchestrator/dist/index.js"
  "marketplace-service|http://127.0.0.1:3007/healthz|PORT=3007 node --env-file=.env services/marketplace-service/dist/index.js"
  "checkin-service|http://127.0.0.1:3008/healthz|PORT=3008 node --env-file=.env services/checkin-service/dist/index.js"
  "refund-service|http://127.0.0.1:3009/healthz|PORT=3009 node --env-file=.env services/refund-service/dist/index.js"
  "worker-mint|http://127.0.0.1:3010/healthz|PORT=3010 node --env-file=.env services/worker-mint/dist/index.js"
  "recovery-service|http://127.0.0.1:3011/healthz|PORT=3011 node --env-file=.env services/recovery-service/dist/index.js"
  "dispute-service|http://127.0.0.1:3012/healthz|PORT=3012 node --env-file=.env services/dispute-service/dist/index.js"
  "notification-service|http://127.0.0.1:3013/healthz|PORT=3013 node --env-file=.env services/notification-service/dist/index.js"
  "contract-sync-service|http://127.0.0.1:3014/healthz|PORT=3014 node --env-file=.env services/contract-sync-service/dist/index.js"
  "api-gateway|http://127.0.0.1:3000/healthz|PORT=3000 node --env-file=.env services/api-gateway/dist/index.js"
  "ui-simulator|http://127.0.0.1:4310|UI_PORT=4310 node --env-file=.env apps/ui-simulator/server.mjs"
)

ensure_env() {
  if [[ ! -f "$ENV_FILE" || ! -s "$ENV_FILE" ]]; then
    cp "$ROOT_DIR/.env.example" "$ENV_FILE"
    echo "Created .env from .env.example"
  fi
}

can_use_docker() {
  command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1
}

start_infra() {
  if can_use_docker; then
    echo "== Starting local infra (docker compose) =="
    docker compose up -d postgres redis minio
  else
    echo "== Skipping docker infra =="
    echo "Docker daemon is not available. Start Docker Desktop and re-run 'npm run stack:up' if you want Postgres/Redis/MinIO containers."
  fi
}

stop_infra() {
  if can_use_docker; then
    echo "== Stopping local infra =="
    docker compose down
  else
    echo "== Docker infra already skipped =="
  fi
}

status_infra() {
  if can_use_docker; then
    echo
    docker compose ps || true
  else
    echo
    echo "Docker infra: skipped (daemon unavailable)"
  fi
}

is_running() {
  local pid="$1"
  kill -0 "$pid" >/dev/null 2>&1
}

service_pid_file() {
  local name="$1"
  echo "$PID_DIR/$name.pid"
}

service_log_file() {
  local name="$1"
  echo "$LOG_DIR/$name.log"
}

wait_for_health() {
  local name="$1"
  local url="$2"

  for _ in $(seq 1 30); do
    if curl -fsS "$url" >/dev/null 2>&1; then
      echo "✓ $name ready -> $url"
      return 0
    fi
    sleep 1
  done

  echo "✗ $name did not become ready -> $url"
  echo "--- $name log ---"
  tail -n 60 "$(service_log_file "$name")" || true
  return 1
}

start_service() {
  local name="$1"
  local url="$2"
  local command="$3"
  local pid_file
  pid_file="$(service_pid_file "$name")"
  local log_file
  log_file="$(service_log_file "$name")"

  if [[ -f "$pid_file" ]]; then
    local existing_pid
    existing_pid="$(cat "$pid_file")"
    if is_running "$existing_pid"; then
      echo "• $name already running (pid $existing_pid)"
      return 0
    fi
    rm -f "$pid_file"
  fi

  (
    cd "$ROOT_DIR"
    nohup bash -lc "$command" >>"$log_file" 2>&1 &
    echo $! >"$pid_file"
  )

  local pid
  pid="$(cat "$pid_file")"
  echo "→ starting $name (pid $pid)"
  wait_for_health "$name" "$url"
}

stop_service() {
  local name="$1"
  local pid_file
  pid_file="$(service_pid_file "$name")"

  if [[ ! -f "$pid_file" ]]; then
    echo "• $name not running"
    return 0
  fi

  local pid
  pid="$(cat "$pid_file")"
  if is_running "$pid"; then
    kill "$pid" >/dev/null 2>&1 || true
    for _ in $(seq 1 10); do
      if ! is_running "$pid"; then
        break
      fi
      sleep 1
    done
    if is_running "$pid"; then
      kill -9 "$pid" >/dev/null 2>&1 || true
    fi
    echo "✓ stopped $name (pid $pid)"
  else
    echo "• $name pid file existed but process already stopped"
  fi

  rm -f "$pid_file"
}

status_service() {
  local name="$1"
  local url="$2"
  local pid_file
  pid_file="$(service_pid_file "$name")"

  if [[ -f "$pid_file" ]]; then
    local pid
    pid="$(cat "$pid_file")"
    if is_running "$pid"; then
      if curl -fsS "$url" >/dev/null 2>&1; then
        echo "RUNNING  $name  pid=$pid  healthy"
      else
        echo "RUNNING  $name  pid=$pid  unhealthy"
      fi
      return 0
    fi
  fi

  echo "STOPPED  $name"
}

cmd_up() {
  ensure_env
  start_infra

  echo "== Building workspace =="
  (
    cd "$ROOT_DIR"
    npm run build >/dev/null
  )

  echo "== Starting app/services stack =="
  for entry in "${SERVICES[@]}"; do
    IFS='|' read -r name url command <<<"$entry"
    start_service "$name" "$url" "$command"
  done

  echo
  echo "Local stack is up."
  echo "- API gateway:   http://127.0.0.1:3000/healthz"
  echo "- UI simulator:  http://127.0.0.1:4310"
  echo "- Logs:          ./scripts/dev-stack.sh logs [service]"
}

cmd_down() {
  echo "== Stopping app/services stack =="
  for (( idx=${#SERVICES[@]}-1 ; idx>=0 ; idx-- )); do
    IFS='|' read -r name _ <<<"${SERVICES[$idx]}"
    stop_service "$name"
  done

  stop_infra
}

cmd_status() {
  echo "== Local stack status =="
  for entry in "${SERVICES[@]}"; do
    IFS='|' read -r name url _ <<<"$entry"
    status_service "$name" "$url"
  done

  status_infra
}

cmd_logs() {
  local service="${2:-}"
  if [[ -n "$service" ]]; then
    tail -n 120 -f "$(service_log_file "$service")"
    return 0
  fi

  for entry in "${SERVICES[@]}"; do
    IFS='|' read -r name _ <<<"$entry"
    echo "--- $name ($(service_log_file "$name")) ---"
    tail -n 20 "$(service_log_file "$name")" 2>/dev/null || true
    echo
  done
}

cmd_smoke() {
  ensure_env
  local checks=(
    "http://127.0.0.1:3000/healthz"
    "http://127.0.0.1:3001/healthz"
    "http://127.0.0.1:3006/healthz"
    "http://127.0.0.1:4310"
  )

  for url in "${checks[@]}"; do
    echo "-> $url"
    curl -fsS "$url" >/dev/null
  done

  echo "Smoke checks passed."
}

case "${1:-up}" in
  up) cmd_up ;;
  down) cmd_down ;;
  status) cmd_status ;;
  logs) cmd_logs "$@" ;;
  smoke) cmd_smoke ;;
  *)
    echo "Usage: $0 {up|down|status|logs [service]|smoke}"
    exit 1
    ;;
esac
