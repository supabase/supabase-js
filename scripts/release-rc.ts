import { releaseVersion, releasePublish } from 'nx/release'
import { execSync } from 'child_process'
import { writeFile } from 'fs/promises'

function getArg(name: string): string | undefined {
  // supports --name=value and --name value
  const idx = process.argv.findIndex((a) => a === `--${name}` || a.startsWith(`--${name}=`))
  if (idx === -1) return undefined
  const token = process.argv[idx]
  if (token.includes('=')) return token.split('=')[1]
  return process.argv[idx + 1] // next token
}

const versionSpecifier = getArg('versionSpecifier') ?? process.argv[2] // optional positional fallback

if (!versionSpecifier) {
  console.error(
    `Usage: npm run release-rc -- --versionSpecifier <specifier>\n` +
      `Examples:\n` +
      `  --versionSpecifier patch | minor | major | prepatch | preminor | premajor | prerelease\n` +
      `  --versionSpecifier v2.3.4 (explicit version)\n` +
      `  --versionSpecifier v2.3.4-rc.0 (explicit RC version)\n`
  )
  process.exit(1)
}

// Validate versionSpecifier to prevent command injection
const validSpecifiers = [
  'patch',
  'minor',
  'major',
  'prepatch',
  'preminor',
  'premajor',
  'prerelease',
]
const isValidVersion = /^v?\d+\.\d+\.\d+(-rc\.\d+)?$/.test(versionSpecifier)
if (!validSpecifiers.includes(versionSpecifier) && !isValidVersion) {
  console.error(`❌ Invalid version specifier: ${versionSpecifier}`)
  console.error(
    `Must be one of: ${validSpecifiers.join(', ')} or a valid semver version (optionally with -rc.N suffix)`
  )
  process.exit(1)
}

;(async () => {
  console.log('\n🚀 Starting RC Release...\n')

  // --- VERSION AND BUILD ---

  const { workspaceVersion, projectsVersionData } = await releaseVersion({
    verbose: true,
    gitCommit: false,
    stageChanges: false,
    specifier: versionSpecifier,
    preid: 'rc', // This creates -rc.0, -rc.1, etc.
  })

  console.log(`\n📦 RC Version: ${workspaceVersion}\n`)

  // Update version.ts files with the new versions
  console.log('📦 Updating version.ts files...')
  execSync('npx tsx scripts/update-version-files.ts', { stdio: 'inherit' })

  // Rebuild packages with correct versions
  console.log('\n🔨 Rebuilding packages with new versions...')
  execSync('npx nx run-many --target=build --all', { stdio: 'inherit' })
  console.log('✅ Build complete\n')

  // --- NPM PUBLISH ---

  console.log('🚀 Publishing to npm with "rc" tag...\n')

  const publishResult = await releasePublish({
    registry: 'https://registry.npmjs.org/',
    access: 'public',
    tag: 'rc',
    verbose: true,
  })

  // Publish gotrue-js as legacy mirror of auth-js
  console.log('\n📦 Publishing @supabase/gotrue-js (legacy mirror) with "rc" tag...')
  try {
    execSync('npx tsx scripts/publish-gotrue-legacy.ts --tag=rc', { stdio: 'inherit' })
  } catch (error) {
    console.error('❌ Failed to publish gotrue-js legacy package:', error)
    // Don't fail the entire release if gotrue-js fails
    console.log('⚠️  Continuing with release despite gotrue-js publish failure')
  }

  // Publish all packages to JSR
  console.log('\n📦 Publishing packages to JSR with "rc" tag...')
  try {
    execSync('npx tsx scripts/publish-to-jsr.ts --tag=rc', { stdio: 'inherit' })
  } catch (error) {
    console.error('❌ Failed to publish to JSR:', error)
    // Don't fail the entire release if JSR publishing fails
    console.log('⚠️  Continuing with release despite JSR publish failure')
  }

  // Write version to file for CI to read
  try {
    await writeFile('.release-version', workspaceVersion ?? '', 'utf-8')
    console.log(`\n✅ Wrote version to .release-version: ${workspaceVersion}`)
  } catch (error) {
    console.error('❌ Failed to write release version to file', error)
  }

  console.log('\n✨ RC Release Complete!\n')
  console.log(`📦 Published version: ${workspaceVersion}`)
  console.log(`🏷️  Dist-tag: rc`)
  console.log(`📥 Install command: npm install @supabase/supabase-js@rc\n`)

  process.exit(Object.values(publishResult).every((result) => result.code === 0) ? 0 : 1)
})()
