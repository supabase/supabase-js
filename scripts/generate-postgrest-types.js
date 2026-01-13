#!/usr/bin/env node

/**
 * Generate TypeScript types for postgrest-js tests from the test database
 *
 * This script uses Supabase CLI to spin up the test infrastructure, generates types
 * from the database schema, and writes them to test/types.generated.ts
 */

const { execSync } = require('child_process')
const path = require('path')

const POSTGREST_DIR = path.join(__dirname, '../packages/core/postgrest-js')
const TEST_DIR_NAME = 'test'
const TEST_DIR = path.join(POSTGREST_DIR, TEST_DIR_NAME)
const OUTPUT_FILE = path.join(POSTGREST_DIR, TEST_DIR_NAME, 'types.generated.ts')

function exec(command, options = {}) {
  try {
    return execSync(command, {
      stdio: 'inherit',
      ...options,
    })
  } catch (error) {
    console.error(`❌ Command failed: ${command}`)
    process.exit(1)
  }
}

function execAllowFail(command, options = {}) {
  try {
    return execSync(command, {
      stdio: 'inherit',
      ...options,
    })
  } catch (error) {
    // Allow failure (e.g., when stopping containers that aren't running)
  }
}

function main() {
  console.log('🔄 Generating postgrest-js test types...\n')

  // Clean up any existing containers
  console.log('🧹 Cleaning up existing containers...')
  // When running `npx` with workspaces enabled, the cwd is changed to the directory of the package.json file.
  // So we need to pass the workdir relative to the package.json file to supabase cli.
  execAllowFail(`npx supabase --workdir ${TEST_DIR_NAME} stop --no-backup`, { cwd: TEST_DIR })

  // Start Supabase (blocks until ready)
  console.log('📦 Starting Supabase...')
  exec(`npx supabase --workdir ${TEST_DIR_NAME} start`, { cwd: TEST_DIR })

  // Generate types from database using Supabase CLI
  console.log('🔧 Generating types from database...')
  exec(
    `npx supabase --workdir ${TEST_DIR_NAME} gen types typescript --local --schema public,personal > ${OUTPUT_FILE}`,
    {
      cwd: TEST_DIR,
      shell: true,
    }
  )

  // Run post-generation script to update JSON type
  console.log('🔧 Post-processing generated types...')
  exec('node scripts/update-json-type.js', { cwd: POSTGREST_DIR })

  // Format the generated file with Prettier
  console.log('💅 Formatting generated types with Prettier...')
  exec(`npx nx format`, { cwd: path.join(__dirname, '..') })

  // Clean up Supabase containers
  console.log('🧹 Cleaning up Supabase...')
  execAllowFail(`npx supabase --workdir ${TEST_DIR_NAME} stop --no-backup`, { cwd: TEST_DIR })

  console.log('\n✅ Type generation complete!')
  console.log(`   Output: ${OUTPUT_FILE}`)
}

main()
