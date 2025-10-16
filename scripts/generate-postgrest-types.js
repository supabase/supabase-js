#!/usr/bin/env node

/**
 * Generate TypeScript types for postgrest-js tests from the test database
 *
 * This script spins up the Docker test infrastructure, generates types
 * from the database schema, and writes them to test/types.generated.ts
 */

const { execSync } = require('child_process')
const path = require('path')

const POSTGREST_DIR = path.join(__dirname, '../packages/core/postgrest-js')
const DB_DIR = path.join(POSTGREST_DIR, 'test/db')
const OUTPUT_FILE = path.join(POSTGREST_DIR, 'test/types.generated.ts')

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

function main() {
  console.log('🔄 Generating postgrest-js test types...\n')

  // Start Docker containers
  console.log('📦 Starting Docker containers...')
  exec('docker compose up --detach', { cwd: DB_DIR })

  // Wait for services to be ready
  console.log('⏳ Waiting for services to be ready...')
  exec('npx wait-for-localhost 8080')
  exec('npx wait-for-localhost 3000')

  // Generate types from database
  console.log('🔧 Generating types from database...')
  exec(
    `curl --location 'http://0.0.0.0:8080/generators/typescript?included_schemas=public,personal&detect_one_to_one_relationships=true' > ${OUTPUT_FILE}`,
    { cwd: POSTGREST_DIR, stdio: 'inherit' }
  )

  // Run post-generation script to update JSON type
  console.log('🔧 Post-processing generated types...')
  exec('node scripts/update-json-type.js', { cwd: POSTGREST_DIR })

  // Format the generated file with Prettier
  console.log('💅 Formatting generated types with Prettier...')
  exec(`npx nx format`, { cwd: path.join(__dirname, '..') })

  // Clean up Docker containers
  console.log('🧹 Cleaning up Docker containers...')
  exec('docker compose down --volumes', { cwd: DB_DIR })

  console.log('\n✅ Type generation complete!')
  console.log(`   Output: ${OUTPUT_FILE}`)
}

main()
