#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SCHEMA_FILE="${SCHEMA_FILE:-$ROOT_DIR/infra/db/schema.sql}"
POSTGRES_SERVICE="${POSTGRES_SERVICE:-postgres}"
POSTGRES_USER="${POSTGRES_USER:-ticket_platform}"
POSTGRES_DB="${POSTGRES_DB:-ticket_platform}"

if [[ ! -f "$SCHEMA_FILE" ]]; then
  echo "Schema file not found: $SCHEMA_FILE" >&2
  exit 1
fi

if ! docker compose ps "$POSTGRES_SERVICE" >/dev/null 2>&1; then
  echo "Postgres service is not running. Start it with: docker compose up -d $POSTGRES_SERVICE" >&2
  exit 1
fi

echo "Resetting PostgreSQL database '$POSTGRES_DB' only. Redis/MinIO volumes are not touched."

docker compose exec -T "$POSTGRES_SERVICE" psql \
  -v ON_ERROR_STOP=1 \
  -U "$POSTGRES_USER" \
  -d "$POSTGRES_DB" <<'SQL'
DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO ticket_platform;
GRANT ALL ON SCHEMA public TO public;
SQL

docker compose exec -T "$POSTGRES_SERVICE" psql \
  -v ON_ERROR_STOP=1 \
  -U "$POSTGRES_USER" \
  -d "$POSTGRES_DB" < "$SCHEMA_FILE"

echo "Database reset complete from $SCHEMA_FILE"
