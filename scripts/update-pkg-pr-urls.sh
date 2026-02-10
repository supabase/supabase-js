#!/bin/bash
set -e

# Usage: ./scripts/update-pkg-pr-urls.sh <commit-hash>

if [ -z "$1" ]; then
  echo "Error: Commit hash required"
  echo "Usage: $0 <commit-hash>"
  exit 1
fi

COMMIT_HASH=$1

echo "=========================================="
echo "📝 Updating pkg.pr.new URLs"
echo "   Commit hash: $COMMIT_HASH"
echo "   Working directory: $(pwd)"
echo "=========================================="
echo ""

# Function to update a file and show the result
update_file() {
  local file=$1
  echo "Updating: $file"

  if [ ! -f "$file" ]; then
    echo "❌ File not found: $file"
    exit 1
  fi

  # Check for {COMMIT_HASH} placeholders before replacement
  local before_count
  before_count=$(grep -c '{COMMIT_HASH}' "$file" || true)

  echo "Before:"
  if [ "$before_count" -eq 0 ]; then
    echo "❌ Error: No {COMMIT_HASH} placeholders found in $file"
    exit 1
  fi
  grep -n '{COMMIT_HASH}' "$file"
  echo "  (found $before_count placeholder(s))"

  # Update using sed (portable syntax for both macOS and Linux)
  if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    sed -i '' "s/{COMMIT_HASH}/$COMMIT_HASH/g" "$file"
  else
    # Linux
    sed -i "s/{COMMIT_HASH}/$COMMIT_HASH/g" "$file"
  fi

  # Verify replacements were made
  local after_count
  after_count=$(grep -c "$COMMIT_HASH" "$file" || true)

  echo "After:"
  if [ "$after_count" -eq 0 ]; then
    echo "❌ Error: No replacements were made in $file (expected $COMMIT_HASH to appear)"
    exit 1
  fi
  grep -n "$COMMIT_HASH" "$file"
  echo "  (verified $after_count replacement(s))"
  echo ""
}

# Update all files
update_file "packages/core/supabase-js/supabase/deno.json"
update_file "packages/core/supabase-js/test/deno/deno.json"
update_file "packages/core/supabase-js/test/integration/next/package.json"
update_file "packages/core/supabase-js/test/integration/bun/package.json"
update_file "packages/core/supabase-js/test/integration/expo/package.json"

echo "=========================================="
echo "✅ All URLs updated successfully!"
echo "=========================================="
