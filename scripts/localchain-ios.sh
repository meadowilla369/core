#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$ROOT_DIR/.env.localchain"
DEFAULT_VITE_PORT="8080"

detect_public_host() {
  if [[ -n "${LOCALCHAIN_PUBLIC_HOST:-}" ]]; then
    printf '%s' "$LOCALCHAIN_PUBLIC_HOST"
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

  echo "Could not detect a LAN IP. Set LOCALCHAIN_PUBLIC_HOST manually." >&2
  return 1
}

configure_device_env() {
  local public_host
  public_host="$(detect_public_host)"
  local vite_port="${VITE_PORT:-$DEFAULT_VITE_PORT}"
  local web_scheme="http"
  if [[ "${LOCALCHAIN_WEB_HTTPS:-}" == "true" || "${VITE_DEV_HTTPS:-}" == "true" ]]; then
    web_scheme="https"
    export VITE_DEV_HTTPS="${VITE_DEV_HTTPS:-true}"
  fi

  export HOST="${HOST:-0.0.0.0}"
  export ANVIL_HOST="${ANVIL_HOST:-0.0.0.0}"
  export LOCALCHAIN_PUBLIC_HOST="$public_host"
  export RPC_URL="${RPC_URL:-http://127.0.0.1:${ANVIL_PORT:-8545}}"
  if [[ "$web_scheme" == "https" ]]; then
    export VITE_API_BASE_URL="https://$public_host:$vite_port"
    export VITE_RPC_URL="https://$public_host:$vite_port/rpc"
  else
    export VITE_API_BASE_URL="http://$public_host:3000"
    export VITE_RPC_URL="http://$public_host:${ANVIL_PORT:-8545}"
  fi
  export CAPACITOR_SERVER_URL="${CAPACITOR_SERVER_URL:-$web_scheme://$public_host:$vite_port}"
}

stop_existing_stack() {
  "$ROOT_DIR/scripts/localchain.sh" full-down >/dev/null 2>&1 || true

  if command -v lsof >/dev/null 2>&1; then
    local pids
    pids="$(
      {
        lsof -tiTCP:3000-3014 -sTCP:LISTEN 2>/dev/null || true
        lsof -tiTCP:${ANVIL_PORT:-8545} -sTCP:LISTEN 2>/dev/null || true
      } | sort -u
    )"

    if [[ -n "$pids" ]]; then
      echo "Stopping stale localchain listeners:"
      printf '%s\n' "$pids"
      # shellcheck disable=SC2086
      kill $pids >/dev/null 2>&1 || true
      sleep 1
    fi
  fi

  rm -f "$ROOT_DIR"/.tmp/dev-stack/pids/*.pid "$ROOT_DIR"/.tmp/localchain/anvil.pid 2>/dev/null || true
}

print_env() {
  configure_device_env
  printf 'HOST=%s\n' "$HOST"
  printf 'ANVIL_HOST=%s\n' "$ANVIL_HOST"
  printf 'LOCALCHAIN_PUBLIC_HOST=%s\n' "$LOCALCHAIN_PUBLIC_HOST"
  printf 'RPC_URL=%s\n' "$RPC_URL"
  printf 'VITE_API_BASE_URL=%s\n' "$VITE_API_BASE_URL"
  printf 'VITE_RPC_URL=%s\n' "$VITE_RPC_URL"
  printf 'CAPACITOR_SERVER_URL=%s\n' "$CAPACITOR_SERVER_URL"
  printf 'VITE_DEV_HTTPS=%s\n' "${VITE_DEV_HTTPS:-false}"
}

build_ios() {
  if [[ ! -f "$ENV_FILE" ]]; then
    echo "Missing $ENV_FILE. Run 'npm run stack:localchain:ios:up' first." >&2
    exit 1
  fi

  set -a
  source "$ENV_FILE"
  set +a
  configure_device_env

  (
    cd "$ROOT_DIR"
    pnpm --filter @ticket-platform/app-web mobile:build
  )
}

run_web() {
  if [[ ! -f "$ENV_FILE" ]]; then
    echo "Missing $ENV_FILE. Run 'npm run stack:localchain:ios:up' first." >&2
    exit 1
  fi

  set -a
  source "$ENV_FILE"
  set +a
  configure_device_env

  (
    cd "$ROOT_DIR"
    pnpm --filter @ticket-platform/app-web dev -- --host 0.0.0.0 --port "${VITE_PORT:-$DEFAULT_VITE_PORT}" --strictPort
  )
}

run_live_ios() {
  if [[ ! -f "$ENV_FILE" ]]; then
    echo "Missing $ENV_FILE. Run 'npm run stack:localchain:ios:up' first." >&2
    exit 1
  fi

  set -a
  source "$ENV_FILE"
  set +a
  configure_device_env
  local https_args=()
  if [[ "${VITE_DEV_HTTPS:-}" == "true" ]]; then
    https_args+=(--https)
  fi

  (
    cd "$ROOT_DIR"
    pnpm --filter @ticket-platform/app-web exec cap run ios \
      --live-reload \
      --host "$LOCALCHAIN_PUBLIC_HOST" \
      --port "${VITE_PORT:-$DEFAULT_VITE_PORT}" \
      "${https_args[@]}"
  )
}

case "${1:-env}" in
  env)
    print_env
    ;;
  up)
    configure_device_env
    stop_existing_stack
    "$ROOT_DIR/scripts/localchain.sh" full-up
    ;;
  build)
    build_ios
    ;;
  open)
    cd "$ROOT_DIR"
    pnpm --filter @ticket-platform/app-web cap:ios
    ;;
  sync)
    build_ios
    cd "$ROOT_DIR"
    pnpm --filter @ticket-platform/app-web cap:ios
    ;;
  web)
    run_web
    ;;
  live)
    run_live_ios
    ;;
  *)
    echo "Usage: $0 {env|up|build|open|sync|web|live}" >&2
    exit 1
    ;;
esac
