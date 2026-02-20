#!/bin/bash
# PostgREST v12 Docker Cleanup Script
set -e

cd "$(dirname "$0")/.."

COMPOSE_FILE="infra/postgrest-v12/docker-compose.yml"

echo "🧹 Stopping PostgREST v12 Docker infrastructure..."
docker compose -f "$COMPOSE_FILE" down --remove-orphans 2>/dev/null || true

echo "✅ PostgREST v12 Docker infrastructure stopped"
