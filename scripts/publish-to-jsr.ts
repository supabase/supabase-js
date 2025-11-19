import { execSync } from 'child_process'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'

const packages = [
  'auth-js',
  'functions-js',
  'postgrest-js',
  'realtime-js',
  'storage-js',
  'supabase-js',
]

function getArg(name: string): string | undefined {
  const idx = process.argv.findIndex((a) => a === `--${name}` || a.startsWith(`--${name}=`))
  if (idx === -1) return undefined
  const token = process.argv[idx]
  if (token.includes('=')) return token.split('=')[1]
  return process.argv[idx + 1]
}

const tag = getArg('tag') || 'latest'
const dryRun = process.argv.includes('--dry-run')

// Packages that need --allow-slow-types due to missing explicit return types
// These should be fixed in the future but for now we'll allow slow types
const packagesWithSlowTypes = ['auth-js', 'postgrest-js', 'storage-js', 'realtime-js']

function safeExec(cmd: string, opts = {}) {
  try {
    return execSync(cmd, { stdio: 'inherit', ...opts })
  } catch (err) {
    console.error(`❌ Command failed: ${cmd}`)
    throw err
  }
}

async function publishToJsr() {
  console.log(`\n📦 Publishing packages to JSR (tag: ${tag})...\n`)

  // Check if we have JSR token for authentication
  const jsrToken = process.env.JSR_TOKEN
  if (!jsrToken && !dryRun) {
    console.warn('⚠️  JSR_TOKEN environment variable not set.')
    console.warn('   Publishing will require interactive authentication or will fail in CI.')
    console.warn('   To set up JSR publishing:')
    console.warn('   1. Create a JSR access token at https://jsr.io/account/tokens')
    console.warn('   2. Add JSR_TOKEN as a GitHub secret')
    console.warn('   3. Pass it to the release script in the workflow')
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

    // Read the package.json to get the current version
    const packageJsonPath = join(packagePath, 'package.json')
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'))
    const version = packageJson.version

    // Update jsr.json with the current version
    const jsrConfig = JSON.parse(readFileSync(jsrPath, 'utf-8'))
    jsrConfig.version = version
    writeFileSync(jsrPath, JSON.stringify(jsrConfig, null, 2) + '\n')

    console.log(`\n📤 Publishing @supabase/${pkg}@${version} to JSR...`)

    try {
      // Determine if we need to allow slow types for this package
      const allowSlowTypes = packagesWithSlowTypes.includes(pkg) ? ' --allow-slow-types' : ''

      // Add authentication token if available
      const tokenFlag = jsrToken && !dryRun ? ` --token ${jsrToken}` : ''

      // Add provenance flag if we're in GitHub Actions CI
      const provenanceFlag = process.env.GITHUB_ACTIONS && !dryRun ? ' --provenance' : ''

      // Change to package directory and publish
      const publishCmd = dryRun
        ? `cd "${packagePath}" && npx jsr publish --dry-run --allow-dirty${allowSlowTypes}`
        : `cd "${packagePath}" && npx jsr publish --allow-dirty${allowSlowTypes}${tokenFlag}${provenanceFlag}`

      safeExec(publishCmd)

      console.log(`✅ Successfully published @supabase/${pkg}@${version} to JSR`)
      results.push({ package: pkg, success: true })
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      console.error(`❌ Failed to publish ${pkg} to JSR: ${errorMsg}`)
      results.push({ package: pkg, success: false, error: errorMsg })
      hasErrors = true
    }
  }

  // Summary
  console.log('\n' + '='.repeat(50))
  console.log('JSR Publishing Summary:')
  console.log('='.repeat(50))

  for (const result of results) {
    const icon = result.success ? '✅' : '❌'
    const status = result.success ? 'SUCCESS' : 'FAILED'
    console.log(`${icon} ${result.package}: ${status}`)
    if (result.error) {
      console.log(`   Error: ${result.error}`)
    }
  }

  if (hasErrors && !dryRun) {
    console.log('\n⚠️  Some packages failed to publish to JSR.')
    console.log('This does not affect the npm release which has already succeeded.')
    // Don't exit with error to avoid failing the entire release
  }
}

// Run the script
publishToJsr().catch((error) => {
  console.error('Unexpected error:', error)
  process.exit(1)
})
