#!/bin/bash
# Auth Edge Cases Docker Cleanup Script
set -e

cd "$(dirname "$0")/.."

COMPOSE_FILE="infra/auth/docker-compose.yml"

echo "🧹 Stopping Auth Edge Cases Docker infrastructure..."
docker compose -f "$COMPOSE_FILE" down --remove-orphans 2>/dev/null || true

echo "✅ Auth edge cases Docker infrastructure stopped"
