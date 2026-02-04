#!/bin/bash
set -e

cd "$(dirname "$0")/.."

echo "🧹 Stopping Supabase..."

# Stop functions if running
if [ -f /tmp/supabase-functions.pid ]; then
  FUNCTIONS_PID=$(cat /tmp/supabase-functions.pid)
  if kill -0 $FUNCTIONS_PID 2>/dev/null; then
    echo "Stopping functions (PID: $FUNCTIONS_PID)..."
    kill $FUNCTIONS_PID
  fi
  rm /tmp/supabase-functions.pid
fi
rm -f /tmp/supabase-functions.log

npx supabase stop

echo "✨ Cleanup complete!"
