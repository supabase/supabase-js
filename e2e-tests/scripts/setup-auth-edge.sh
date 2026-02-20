#!/bin/bash
# Auth Edge Cases Docker Setup Script
# Starts 4 GoTrue instances with different configurations for edge case testing
set -e

cd "$(dirname "$0")/.."

COMPOSE_FILE="infra/auth/docker-compose.yml"

echo "🐳 Starting Auth Edge Cases Docker infrastructure..."

# Stop any existing instances
docker compose -f "$COMPOSE_FILE" down --remove-orphans 2>/dev/null || true

# Start all services
docker compose -f "$COMPOSE_FILE" up -d

echo "⏳ Waiting for GoTrue instances to be ready..."

wait_for_gotrue() {
  local port=$1
  local name=$2
  local attempts=0
  local max_attempts=60

  while [ $attempts -lt $max_attempts ]; do
    local http_status
    http_status=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:${port}/health" 2>/dev/null || echo "000")
    if [ "$http_status" = "200" ]; then
      echo "   ✅ ${name} (port ${port}) ready"
      return 0
    fi
    attempts=$((attempts + 1))
    sleep 2
  done

  echo "   ❌ ${name} (port ${port}) failed to start after ${max_attempts} attempts"
  return 1
}

wait_for_gotrue 9999 "GoTrue (autoconfirm OFF)"
wait_for_gotrue 9998 "GoTrue (autoconfirm ON)"
wait_for_gotrue 9997 "GoTrue (signup disabled)"
wait_for_gotrue 9996 "GoTrue (asymmetric JWT)"

echo ""
echo "✨ Auth Edge Cases Infrastructure Ready!"
echo "   - GoTrue (autoconfirm OFF):  http://localhost:9999"
echo "   - GoTrue (autoconfirm ON):   http://localhost:9998"
echo "   - GoTrue (signup disabled):  http://localhost:9997"
echo "   - GoTrue (asymmetric JWT):   http://localhost:9996"
echo "   - Mail (inbucket):           http://localhost:9000"
echo ""
