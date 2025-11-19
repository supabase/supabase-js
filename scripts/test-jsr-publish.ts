// TEMPORARY TEST SCRIPT - DO NOT MERGE
// This script is for testing JSR publishing in CI without affecting npm
import { execSync } from 'child_process'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'

// Hardcoded test version - change this to test different versions
const TEST_VERSION = '0.0.0-jsr-test.1'

// Test with just one package to start
const packages = [
  'functions-js', // Start with simplest package (no slow types)
]

// Packages that need --allow-slow-types
const packagesWithSlowTypes = ['auth-js', 'postgrest-js', 'storage-js', 'realtime-js']

function safeExec(cmd: string, opts = {}) {
  try {
    return execSync(cmd, { stdio: 'inherit', ...opts })
  } catch (err) {
    console.error(`❌ Command failed: ${cmd}`)
    throw err
  }
}

async function testJsrPublish() {
  console.log(`\n🧪 TESTING JSR Publishing with version: ${TEST_VERSION}\n`)
  console.log('⚠️  This is a TEST - using hardcoded version\n')

  // GitHub Actions uses OIDC authentication automatically via id-token: write permission
  if (!process.env.GITHUB_ACTIONS) {
    console.warn('⚠️  Not running in GitHub Actions.')
    console.warn('   Local publishing will use interactive browser authentication.')
  }

  let hasErrors = false
  const results: { package: string; success: boolean; error?: string }[] = []

  for (const pkg of packages) {
    const packagePath = join(process.cwd(), 'packages', 'core', pkg)
    const jsrPath = join(packagePath, 'jsr.json')

    // Check if jsr.json exists
    if (!existsSync(jsrPath)) {
      console.log(`⚠️  Skipping ${pkg}: no jsr.json file found`)
      continue
    }

    // Read and backup the original jsr.json
    const originalJsrContent = readFileSync(jsrPath, 'utf-8')
    const jsrConfig = JSON.parse(originalJsrContent)

    // Update jsr.json with the TEST version
    jsrConfig.version = TEST_VERSION
    writeFileSync(jsrPath, JSON.stringify(jsrConfig, null, 2) + '\n')

    console.log(`\n📤 [TEST] Publishing @supabase/${pkg}@${TEST_VERSION} to JSR...`)

    try {
      // Determine if we need to allow slow types for this package
      const allowSlowTypes = packagesWithSlowTypes.includes(pkg) ? ' --allow-slow-types' : ''

      // Change to package directory and publish
      // Note: Provenance is automatically enabled in GitHub Actions via OIDC (no flag needed)
      const publishCmd = `cd "${packagePath}" && npx jsr publish --allow-dirty${allowSlowTypes}`

      console.log(`Running: ${publishCmd}`)
      safeExec(publishCmd)

      console.log(`✅ Successfully published @supabase/${pkg}@${TEST_VERSION} to JSR`)
      results.push({ package: pkg, success: true })
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      console.error(`❌ Failed to publish ${pkg} to JSR: ${errorMsg}`)
      results.push({ package: pkg, success: false, error: errorMsg })
      hasErrors = true
    } finally {
      // Restore original jsr.json
      writeFileSync(jsrPath, originalJsrContent)
    }
  }

  // Summary
  console.log('\n' + '='.repeat(50))
  console.log('🧪 JSR Test Publishing Summary:')
  console.log('='.repeat(50))

  for (const result of results) {
    const icon = result.success ? '✅' : '❌'
    const status = result.success ? 'SUCCESS' : 'FAILED'
    console.log(`${icon} ${result.package}: ${status}`)
    if (result.error) {
      console.log(`   Error: ${result.error}`)
    }
  }

  if (hasErrors) {
    console.log('\n⚠️  Some packages failed to publish to JSR.')
    process.exit(1)
  }

  console.log('\n✅ Test completed successfully!')
  console.log(`\nView published package at: https://jsr.io/@supabase/${packages[0]}/versions`)
}

// Run the test
testJsrPublish().catch((error) => {
  console.error('Unexpected error:', error)
  process.exit(1)
})
