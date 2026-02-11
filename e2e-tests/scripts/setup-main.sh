#!/bin/bash
# Main E2E Test Infrastructure Setup Script
# Starts Supabase CLI with all services enabled for integration testing
set -e

cd "$(dirname "$0")/.."

echo "🚀 Stop supabase if it is running"
npx supabase stop 2>/dev/null || true

echo "🚀 Starting Supabase (with migrations and seed data)..."
npx supabase start

echo "⏳ Waiting for all services..."
sleep 3

echo "✅ Verifying services..."
# Verify database is ready
PGPASSWORD=postgres psql -h 127.0.0.1 -p 54322 -U postgres -d postgres -c "SELECT 1;" > /dev/null 2>&1
echo "   ✅ PostgreSQL ready"

# Verify PostgREST schema
PGPASSWORD=postgres psql -h 127.0.0.1 -p 54322 -U postgres -d postgres -c "SELECT count(*) FROM public.users;" > /dev/null 2>&1
echo "   ✅ PostgREST schema loaded"

# Verify storage schema
PGPASSWORD=postgres psql -h 127.0.0.1 -p 54322 -U postgres -d postgres -c "SELECT count(*) FROM storage.buckets;" > /dev/null 2>&1
echo "   ✅ Storage schema loaded"

# Verify auth users
PGPASSWORD=postgres psql -h 127.0.0.1 -p 54322 -U postgres -d postgres -c "SELECT count(*) FROM auth.users;" > /dev/null 2>&1
echo "   ✅ Auth users loaded"

echo "📦 Starting Edge Functions..."
npx supabase functions serve --import-map supabase/deno.json > /tmp/e2e-supabase-functions.log 2>&1 &
FUNCTIONS_PID=$!
echo $FUNCTIONS_PID > /tmp/e2e-supabase-functions.pid

echo "⏳ Waiting for Edge Runtime to initialize..."
sleep 5

echo "🔑 Exporting authentication keys..."
export SUPABASE_ANON_KEY="$(npx supabase status --output json | jq -r '.ANON_KEY')"
export SUPABASE_SERVICE_ROLE_KEY="$(npx supabase status --output json | jq -r '.SERVICE_ROLE_KEY')"
echo "   SUPABASE_ANON_KEY exported"
echo "   SUPABASE_SERVICE_ROLE_KEY exported"

# Write keys to a file that tests can source
cat > /tmp/e2e-supabase-keys.env << EOF
export SUPABASE_ANON_KEY="$SUPABASE_ANON_KEY"
export SUPABASE_SERVICE_ROLE_KEY="$SUPABASE_SERVICE_ROLE_KEY"
export SUPABASE_URL="http://127.0.0.1:54321"
export SUPABASE_DB_URL="postgresql://postgres:postgres@127.0.0.1:54322/postgres"
EOF

echo "🧪 Testing edge function endpoint..."
for i in {1..3}; do
  RESPONSE=$(curl -s -w "\n%{http_code}" -X POST \
    -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
    -H "Content-Type: application/json" \
    -d '{"name":"E2E Setup"}' \
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

echo "🧪 Testing Auth API..."
HEALTH_CHECK=$(curl -s http://127.0.0.1:54321/auth/v1/health)
if echo "$HEALTH_CHECK" | grep -q "ok"; then
  echo "   ✅ Auth API responding"
else
  echo "   ⚠️  Auth API may not be fully ready"
fi

echo "🧪 Testing Storage API..."
HEALTH_CHECK=$(curl -s http://127.0.0.1:54321/storage/v1/bucket)
if [ "$?" -eq 0 ]; then
  echo "   ✅ Storage API responding"
else
  echo "   ⚠️  Storage API may not be fully ready"
fi

echo "🧪 Testing Realtime..."
HEALTH_CHECK=$(curl -s http://127.0.0.1:54321/realtime/v1/health)
if [ "$?" -eq 0 ]; then
  echo "   ✅ Realtime responding"
else
  echo "   ⚠️  Realtime may not be fully ready"
fi

echo ""
echo "✨ E2E Test Infrastructure Ready!"
echo "   - Database: postgresql://postgres:postgres@127.0.0.1:54322/postgres"
echo "   - API Gateway: http://127.0.0.1:54321"
echo "   - Auth: http://127.0.0.1:54321/auth/v1"
echo "   - Storage: http://127.0.0.1:54321/storage/v1"
echo "   - PostgREST: http://127.0.0.1:54321/rest/v1"
echo "   - Realtime: http://127.0.0.1:54321/realtime/v1"
echo "   - Functions: http://127.0.0.1:54321/functions/v1"
echo "   - Inbucket: http://127.0.0.1:54324"
echo ""
echo "   Functions PID: $FUNCTIONS_PID"
echo "   Environment: source /tmp/e2e-supabase-keys.env"
echo ""
