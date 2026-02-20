#!/bin/bash
# Runs all e2e standard test suites in parallel against the running Supabase CLI instance.
# Call this AFTER setup-main.sh. Infrastructure must already be up.
set -e

cd "$(dirname "$0")/.."  # Go to e2e-tests/

FAILED=0

npx jest tests/auth/standard    --runInBand --coverage --coverageDirectory=coverage/auth      --forceExit & P1=$!
npx jest tests/storage          --runInBand --coverage --coverageDirectory=coverage/storage   --forceExit & P2=$!
npx jest tests/postgrest/standard --runInBand --coverage --coverageDirectory=coverage/postgrest --forceExit & P3=$!
npx jest tests/functions        --runInBand --coverage --coverageDirectory=coverage/functions --forceExit & P4=$!
npx jest tests/supabase         --runInBand --coverage --coverageDirectory=coverage/supabase  --forceExit & P5=$!

wait $P1 || FAILED=1
wait $P2 || FAILED=1
wait $P3 || FAILED=1
wait $P4 || FAILED=1
wait $P5 || FAILED=1

exit $FAILED
