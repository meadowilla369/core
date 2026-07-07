#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BASE_ENV_FILE="$ROOT_DIR/config/environments/base-sepolia.env"
STACK_ENV_FILE="$ROOT_DIR/.tmp/dev-stack/base-sepolia.stack.env"
STATE_DIR="$ROOT_DIR/.tmp/base-sepolia-ios"
WEB_PID_FILE="$STATE_DIR/web.pid"
DEFAULT_VITE_PORT="8080"

mkdir -p "$STATE_DIR"

if [[ ! -f "$BASE_ENV_FILE" ]]; then
  echo "Missing $BASE_ENV_FILE. Run 'npm run contracts:deploy:base-sepolia' first."
  exit 1
fi

resolve_env_file() {
  if [[ -f "$STACK_ENV_FILE" ]]; then
    echo "$STACK_ENV_FILE"
  else
    echo "$BASE_ENV_FILE"
  fi
}

ensure_stack_env() {
  node "$ROOT_DIR/scripts/build-base-sepolia-stack-env.mjs" \
    --base "$ROOT_DIR/.env.example" \
    --override "$BASE_ENV_FILE" \
    --output "$STACK_ENV_FILE" >/dev/null
}

load_env() {
  ensure_stack_env
  set -a
  source "$(resolve_env_file)"
  set +a
}

detect_public_host() {
  if [[ -n "${BASE_SEPOLIA_PUBLIC_HOST:-}" ]]; then
    printf '%s' "$BASE_SEPOLIA_PUBLIC_HOST"
    return 0
  fi

  if command -v tailscale >/dev/null 2>&1; then
    local ip
    ip="$(
      tailscale ip -4 2>/dev/null | awk '
        /^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$/ {
          print
          exit
        }
      '
    )"
    if [[ -n "$ip" ]]; then
      printf '%s' "$ip"
      return 0
    fi
  fi

  if command -v ipconfig >/dev/null 2>&1; then
    local ip
    ip="$(ipconfig getifaddr en0 2>/dev/null || true)"
    if [[ -n "$ip" ]]; then
      printf '%s' "$ip"
      return 0
    fi
  fi

  if command -v ifconfig >/dev/null 2>&1; then
    local ip
    ip="$(
      ifconfig | awk '
        /inet / && $2 !~ /^127\./ && $2 !~ /^169\.254\./ {
          print $2
          exit
        }
      '
    )"
    if [[ -n "$ip" ]]; then
      printf '%s' "$ip"
      return 0
    fi
  fi

  echo "Could not detect a LAN IP. Set BASE_SEPOLIA_PUBLIC_HOST manually." >&2
  return 1
}

configure_ios_env() {
  local public_host
  public_host="$(detect_public_host)"
  local vite_port="${VITE_PORT:-$DEFAULT_VITE_PORT}"
  local web_scheme="http"
  if [[ "${VITE_DEV_HTTPS:-}" == "true" ]]; then
    web_scheme="https"
  fi
  export HOST="${HOST:-0.0.0.0}"
  export BASE_SEPOLIA_PUBLIC_HOST="$public_host"
  export VITE_PORT="$vite_port"
  export VITE_DEV_HTTPS="${VITE_DEV_HTTPS:-false}"
  if [[ "$web_scheme" == "https" ]]; then
    export VITE_API_BASE_URL="https://$public_host:$vite_port"
    export VITE_RPC_URL="https://$public_host:$vite_port/rpc"
  else
    export VITE_API_BASE_URL="${VITE_API_BASE_URL:-http://$public_host:3000}"
    export VITE_RPC_URL="${VITE_RPC_URL:-${RPC_URL:-https://base-sepolia.infura.io/v3/87d8f0675c114566a395060f35a9b6fe}}"
  fi
  export CAPACITOR_SERVER_URL="$web_scheme://$public_host:$vite_port"
  export VITE_DEV_API_PROXY_TARGET="${VITE_DEV_API_PROXY_TARGET:-${API_BASE_URL:-http://127.0.0.1:3000}}"
  export VITE_DEV_RPC_PROXY_TARGET="${VITE_DEV_RPC_PROXY_TARGET:-${RPC_URL:-https://base-sepolia.infura.io/v3/87d8f0675c114566a395060f35a9b6fe}}"
}

wait_for_http() {
  local url="$1"

  for _ in $(seq 1 30); do
    if curl -fsS "$url" >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
  done

  return 1
}

is_pid_running() {
  local pid="$1"
  kill -0 "$pid" >/dev/null 2>&1
}

ensure_web_server() {
  local web_url="$CAPACITOR_SERVER_URL"
  if wait_for_http "$web_url"; then
    return 0
  fi

  if [[ -f "$WEB_PID_FILE" ]]; then
    local existing_pid
    existing_pid="$(cat "$WEB_PID_FILE")"
    if is_pid_running "$existing_pid"; then
      if wait_for_http "$web_url"; then
        return 0
      fi
    fi
    rm -f "$WEB_PID_FILE"
  fi

  (
    cd "$ROOT_DIR"
    nohup pnpm --filter @ticket-platform/app-web exec vite --host 0.0.0.0 --port "$VITE_PORT" --strictPort \
      >"$STATE_DIR/web.log" 2>&1 &
    echo $! >"$WEB_PID_FILE"
  )

  if ! wait_for_http "$web_url"; then
    echo "Base Sepolia iOS web server did not become ready at $web_url" >&2
    tail -n 80 "$STATE_DIR/web.log" >&2 || true
    exit 1
  fi
}

start_base_sepolia_stack() {
  load_env
  configure_ios_env
  (
    cd "$ROOT_DIR"
    HOST=0.0.0.0 STACK_ENV_FILE=config/environments/base-sepolia.env ./scripts/dev-stack.sh up
  )
}

build_ios() {
  load_env
  configure_ios_env
  (
    cd "$ROOT_DIR"
    pnpm --filter @ticket-platform/app-web mobile:build
  )
}

run_web() {
  load_env
  configure_ios_env
  (
    cd "$ROOT_DIR"
    pnpm --filter @ticket-platform/app-web exec vite --host 0.0.0.0 --port "$VITE_PORT" --strictPort
  )
}

run_live_ios() {
  load_env
  configure_ios_env
  ensure_web_server
  local https_args=""
  if [[ "${VITE_DEV_HTTPS:-}" == "true" ]]; then
    https_args="--https"
  fi
  (
    cd "$ROOT_DIR"
    pnpm --filter @ticket-platform/app-web exec cap run ios \
      --live-reload \
      --host "$BASE_SEPOLIA_PUBLIC_HOST" \
      --port "$VITE_PORT" \
      $https_args
  )
}

case "${1:-env}" in
  env)
    load_env
    configure_ios_env
    printf 'HOST=%s\n' "${HOST:-}"
    printf 'BASE_SEPOLIA_PUBLIC_HOST=%s\n' "$BASE_SEPOLIA_PUBLIC_HOST"
    printf 'VITE_API_BASE_URL=%s\n' "$VITE_API_BASE_URL"
    printf 'VITE_RPC_URL=%s\n' "$VITE_RPC_URL"
    printf 'CAPACITOR_SERVER_URL=%s\n' "$CAPACITOR_SERVER_URL"
    printf 'VITE_DEV_HTTPS=%s\n' "${VITE_DEV_HTTPS:-false}"
    ;;
  up)
    start_base_sepolia_stack
    ;;
  build)
    build_ios
    ;;
  web)
    run_web
    ;;
  live)
    run_live_ios
    ;;
  sync)
    build_ios
    (
      cd "$ROOT_DIR"
      pnpm --filter @ticket-platform/app-web cap:ios
    )
    ;;
  *)
    echo "Usage: $0 {env|up|build|web|live|sync}" >&2
    exit 1
    ;;
esac
