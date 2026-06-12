import { spawnSync } from 'child_process'
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'

// Only publishing packages with explicit return types to JSR
const packages = ['functions-js', 'supabase-js']

// supabase-js imports `@supabase/tracing` (an internal, unpublished workspace
// package). JSR rejects unpinned npm specifiers, so before publishing
// supabase-js we copy the tracing source into the package and rely on
// jsr.json's `imports` map to redirect `@supabase/tracing` → `./src/_internal/tracing/index.ts`.
// The snapshot is removed in the publish loop's finally block.
const TRACING_INTERNAL_SUBPATH = 'src/_internal'
const TRACING_SNAPSHOT_SOURCES: Record<string, string | undefined> = {
  'supabase-js': join('packages', 'shared', 'tracing', 'src'),
}

function copyTracingSnapshot(packagePath: string, pkg: string): void {
  const src = TRACING_SNAPSHOT_SOURCES[pkg]
  if (!src) return
  const absoluteSrc = join(process.cwd(), src)
  const dest = join(packagePath, TRACING_INTERNAL_SUBPATH, 'tracing')
  mkdirSync(dirname(dest), { recursive: true })
  cpSync(absoluteSrc, dest, { recursive: true })
}

function cleanupTracingSnapshot(packagePath: string, pkg: string): void {
  if (!TRACING_SNAPSHOT_SOURCES[pkg]) return
  rmSync(join(packagePath, TRACING_INTERNAL_SUBPATH), { recursive: true, force: true })
}

// JSR rejects pnpm's `workspace:*` protocol as an unpinned npm specifier. Before
// publishing, swap every `workspace:<range>` entry in package.json for the
// package's own version (fixed-release mode means all siblings share it), then
// restore the original file in the finally block.
function rewriteWorkspaceDeps(packagePath: string, version: string): string {
  const pkgJsonPath = join(packagePath, 'package.json')
  const original = readFileSync(pkgJsonPath, 'utf-8')
  const pkgJson = JSON.parse(original)
  let touched = false
  for (const section of ['dependencies', 'devDependencies'] as const) {
    const deps = pkgJson[section]
    if (!deps) continue
    for (const [name, value] of Object.entries(deps)) {
      if (typeof value === 'string' && value.startsWith('workspace:')) {
        deps[name] = version
        touched = true
      }
    }
  }
  if (touched) {
    writeFileSync(pkgJsonPath, JSON.stringify(pkgJson, null, 2) + '\n')
  }
  return original
}

function restorePackageJson(packagePath: string, original: string): void {
  writeFileSync(join(packagePath, 'package.json'), original)
}

function getArg(name: string): string | undefined {
  const idx = process.argv.findIndex((a) => a === `--${name}` || a.startsWith(`--${name}=`))
  if (idx === -1) return undefined
  const token = process.argv[idx]
  if (token.includes('=')) return token.split('=')[1]
  return process.argv[idx + 1]
}

const tag = getArg('tag') || 'latest'
const dryRun = process.argv.includes('--dry-run')

async function publishToJsr() {
  console.log(`\n📦 Publishing packages to JSR (tag: ${tag})...\n`)

  // GitHub Actions uses OIDC authentication automatically via id-token: write permission
  // No manual token setup required when running in CI with proper permissions
  if (!process.env.GITHUB_ACTIONS && !dryRun) {
    console.warn('⚠️  Not running in GitHub Actions.')
    console.warn('   Local publishing will use interactive browser authentication.')
    console.warn('   For CI/CD, ensure your workflow has "id-token: write" permission.')
  }

  // In CI, DENO_BIN_PATH should point to the pinned Deno from `denoland/setup-deno`
  // so the `jsr` wrapper doesn't fall back to downloading "latest" from dl.deno.land.
  if (process.env.GITHUB_ACTIONS && !process.env.DENO_BIN_PATH) {
    console.warn(
      '⚠️  DENO_BIN_PATH is not set — the `jsr` wrapper will download the latest Deno binary instead of using the pinned one. Check that publish.yml has the "Export pinned Deno path" step after Setup Deno.'
    )
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

    // Pin workspace:* sibling deps so JSR sees a real version constraint.
    const originalPackageJson = rewriteWorkspaceDeps(packagePath, version)

    // Snapshot any internal workspace deps that JSR would otherwise reject for
    // missing version constraints. See TRACING_SNAPSHOT_SOURCES for details.
    copyTracingSnapshot(packagePath, pkg)

    console.log(`\n📤 Publishing @supabase/${pkg}@${version} to JSR...`)

    try {
      const args = ['exec', 'jsr', 'publish', '--allow-dirty']
      if (dryRun) args.push('--dry-run')
      console.log(`   Command: pnpm ${args.join(' ')}`)
      const result = spawnSync('pnpm', args, {
        cwd: packagePath,
        stdio: 'inherit',
        timeout: 5 * 60 * 1000,
        killSignal: 'SIGKILL',
      })
      if (result.signal === 'SIGKILL') {
        throw new Error(`jsr publish for ${pkg} timed out after 5 minutes`)
      }
      if (result.error) throw result.error
      if (result.status !== 0) {
        throw new Error(`jsr publish for ${pkg} exited with status ${result.status}`)
      }

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
      // Restore package.json (workspace:* sibling deps)
      restorePackageJson(packagePath, originalPackageJson)
      // Remove any internal snapshot copies created above
      cleanupTracingSnapshot(packagePath, pkg)
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
