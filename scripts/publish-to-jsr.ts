import { execSync } from 'child_process'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'

// Only publishing packages with explicit return types to JSR
const packages = ['functions-js', 'supabase-js']

function getArg(name: string): string | undefined {
  const idx = process.argv.findIndex((a) => a === `--${name}` || a.startsWith(`--${name}=`))
  if (idx === -1) return undefined
  const token = process.argv[idx]
  if (token.includes('=')) return token.split('=')[1]
  return process.argv[idx + 1]
}

const tag = getArg('tag') || 'latest'
const dryRun = process.argv.includes('--dry-run')

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

  // GitHub Actions uses OIDC authentication automatically via id-token: write permission
  // No manual token setup required when running in CI with proper permissions
  if (!process.env.GITHUB_ACTIONS && !dryRun) {
    console.warn('⚠️  Not running in GitHub Actions.')
    console.warn('   Local publishing will use interactive browser authentication.')
    console.warn('   For CI/CD, ensure your workflow has "id-token: write" permission.')
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

    // Read and backup the original jsr.json
    const originalJsrContent = readFileSync(jsrPath, 'utf-8')
    const jsrConfig = JSON.parse(originalJsrContent)

    // Update jsr.json with the current version
    jsrConfig.version = version
    writeFileSync(jsrPath, JSON.stringify(jsrConfig, null, 2) + '\n')

    console.log(`\n📤 Publishing @supabase/${pkg}@${version} to JSR...`)

    try {
      // Change to package directory and publish
      // Note: In GitHub Actions, authentication happens automatically via OIDC
      // Provenance is automatically enabled when using OIDC (no flag needed)
      // Local publishing will prompt for interactive browser authentication
      const publishCmd = dryRun
        ? `cd "${packagePath}" && npx jsr publish --dry-run --allow-dirty`
        : `cd "${packagePath}" && npx jsr publish --allow-dirty`

      safeExec(publishCmd)

      console.log(`✅ Successfully published @supabase/${pkg}@${version} to JSR`)
      results.push({ package: pkg, success: true })
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      console.error(`❌ Failed to publish ${pkg} to JSR: ${errorMsg}`)
      results.push({ package: pkg, success: false, error: errorMsg })
      hasErrors = true
    } finally {
      // Restore original jsr.json to keep working directory clean
      writeFileSync(jsrPath, originalJsrContent)
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
