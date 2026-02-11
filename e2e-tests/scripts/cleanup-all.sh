#!/bin/bash
# Cleanup E2E Test Infrastructure
# Stops all services and cleans up temporary files
set -e

cd "$(dirname "$0")/.."

echo "🧹 Cleaning up E2E Test Infrastructure..."

# Stop Edge Functions if running
if [ -f /tmp/e2e-supabase-functions.pid ]; then
  FUNCTIONS_PID=$(cat /tmp/e2e-supabase-functions.pid)
  if kill -0 $FUNCTIONS_PID 2>/dev/null; then
    echo "   Stopping Edge Functions (PID: $FUNCTIONS_PID)..."
    kill $FUNCTIONS_PID 2>/dev/null || true
    sleep 1
    # Force kill if still running
    if kill -0 $FUNCTIONS_PID 2>/dev/null; then
      echo "   Force stopping Edge Functions..."
      kill -9 $FUNCTIONS_PID 2>/dev/null || true
    fi
  fi
  rm /tmp/e2e-supabase-functions.pid
fi

# Remove logs and env files
rm -f /tmp/e2e-supabase-functions.log
rm -f /tmp/e2e-supabase-keys.env

# Stop Supabase
echo "   Stopping Supabase..."
npx supabase stop 2>/dev/null || true

echo "✨ E2E Test Infrastructure Cleanup Complete!"
