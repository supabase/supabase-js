#!/bin/bash
# PostgREST v12 Compatibility Docker Setup Script
# Starts PostgREST v12 + PostgreSQL for backward compatibility testing
set -e

cd "$(dirname "$0")/.."

COMPOSE_FILE="infra/postgrest-v12/docker-compose.yml"

echo "🐳 Starting PostgREST v12 Docker infrastructure..."

# Stop any existing instances
docker compose -f "$COMPOSE_FILE" down --remove-orphans 2>/dev/null || true

# Start all services
docker compose -f "$COMPOSE_FILE" up -d

echo "⏳ Waiting for PostgREST v12 to be ready..."

attempts=0
max_attempts=30

while [ $attempts -lt $max_attempts ]; do
  if curl -s "http://localhost:3012/" | grep -q "OpenAPI" 2>/dev/null || \
     curl -s -o /dev/null -w "%{http_code}" "http://localhost:3012/" 2>/dev/null | grep -q "200"; then
    echo "   ✅ PostgREST v12 (port 3012) ready"
    break
  fi
  attempts=$((attempts + 1))
  if [ $attempts -eq $max_attempts ]; then
    echo "   ❌ PostgREST v12 failed to start after ${max_attempts} attempts"
    exit 1
  fi
  sleep 2
done

echo ""
echo "✨ PostgREST v12 Infrastructure Ready!"
echo "   - PostgREST v12: http://localhost:3012"
echo "   - PostgreSQL:    localhost:5433"
echo ""
