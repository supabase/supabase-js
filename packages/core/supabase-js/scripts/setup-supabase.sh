#!/bin/bash
set -e

cd "$(dirname "$0")/.."

echo "🚀 Stop supabase if it is running"
npx supabase stop

echo "🚀 Starting Supabase (migrations applied, seed data skipped)..."
npx supabase start

echo "⏳ Waiting for all services..."
sleep 3

echo "🗑️  Clearing seed data from database..."
PGPASSWORD=postgres psql -h 127.0.0.1 -p 54322 -U postgres -d postgres -c "truncate public.todos cascade;" > /dev/null 2>&1

echo "🪣 Creating test storage bucket..."
PGPASSWORD=postgres psql -h 127.0.0.1 -p 54322 -U postgres -d postgres -c "insert into storage.buckets (id, name, public) values ('test-bucket','test-bucket', false) on conflict (id) do nothing;" > /dev/null 2>&1

echo "✅ Verifying database setup..."
PGPASSWORD=postgres psql -h 127.0.0.1 -p 54322 -U postgres -d postgres -c "select count(*) from public.todos;" > /dev/null 2>&1
PGPASSWORD=postgres psql -h 127.0.0.1 -p 54322 -U postgres -d postgres -c "select id from storage.buckets where id = 'test-bucket';" > /dev/null 2>&1

echo "📦 Starting Edge Functions..."
npx supabase functions serve --import-map supabase/deno.json > /tmp/supabase-functions.log 2>&1 &
FUNCTIONS_PID=$!
echo $FUNCTIONS_PID > /tmp/supabase-functions.pid

echo "⏳ Waiting for Edge Runtime to initialize..."
sleep 5

echo "🔑 Exporting authentication keys..."
export SUPABASE_PUBLISHABLE_KEY="$(npx supabase status --output json | jq -r '.ANON_KEY')"
export SUPABASE_SECRET_KEY="$(npx supabase status --output json | jq -r '.SERVICE_ROLE_KEY')"
echo "   Keys exported"

echo "🧪 Testing edge function endpoint..."
for i in {1..3}; do
  RESPONSE=$(curl -s -w "\n%{http_code}" -X POST \
    -H "Authorization: Bearer $SUPABASE_PUBLISHABLE_KEY" \
    -H "Content-Type: application/json" \
    -d '{"name":"Setup"}' \
    http://127.0.0.1:54321/functions/v1/hello 2>&1)

  HTTP_CODE=$(echo "$RESPONSE" | tail -n1)

  if [ "$HTTP_CODE" = "200" ]; then
    echo "   ✅ Edge functions responding"
    break
  elif [ $i -lt 3 ]; then
    echo "   ⏳ Attempt $i/3 failed (status $HTTP_CODE), retrying..."
    sleep 3
  else
    echo "   ⚠️  Edge functions may still be initializing (status $HTTP_CODE)"
  fi
done

echo "✨ Supabase setup complete!"
echo "   - Database: http://127.0.0.1:54322"
echo "   - API: http://127.0.0.1:54321"
echo "   - Functions: http://127.0.0.1:54321/functions/v1"
echo "   - Functions PID: $FUNCTIONS_PID"
