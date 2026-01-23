#!/usr/bin/env node
/**
 * Unified script for prerelease publishing (canary and RC)
 * Usage:
 *   npm run release-prerelease -- --type=canary
 *   npm run release-prerelease -- --type=rc --version=patch
 */

import { releaseVersion, releaseChangelog, releasePublish } from 'nx/release'
import { execSync } from 'child_process'
import { writeFile } from 'fs/promises'

function getArg(name: string): string | undefined {
  const idx = process.argv.findIndex((a) => a === `--${name}` || a.startsWith(`--${name}=`))
  if (idx === -1) return undefined
  const token = process.argv[idx]
  if (token.includes('=')) return token.split('=')[1]
  return process.argv[idx + 1]
}

const releaseType = getArg('type')
const versionSpecifier = getArg('version') ?? getArg('versionSpecifier')

// Validate release type
if (!releaseType || !['canary', 'rc'].includes(releaseType)) {
  console.error(`❌ Invalid or missing release type`)
  console.error(`Usage: npm run release-prerelease -- --type=<canary|rc> [--version=<specifier>]`)
  process.exit(1)
}

const isCanary = releaseType === 'canary'
const isRC = releaseType === 'rc'

// RC requires version specifier
if (isRC && !versionSpecifier) {
  console.error(`❌ RC releases require --version parameter`)
  console.error(`Examples: --version=patch | --version=minor | --version=v2.3.4-rc.0`)
  process.exit(1)
}

// Validate and transform version specifier for RC
let rcSpecifier = versionSpecifier
if (isRC) {
  const validSpecifiers = [
    'patch',
    'minor',
    'major',
    'prepatch',
    'preminor',
    'premajor',
    'prerelease',
  ]
  const isValidVersion = /^v?\d+\.\d+\.\d+(-rc\.\d+)?$/.test(versionSpecifier!)

  if (!validSpecifiers.includes(versionSpecifier!) && !isValidVersion) {
    console.error(`❌ Invalid version specifier: ${versionSpecifier}`)
    console.error(`Must be one of: ${validSpecifiers.join(', ')} or a valid semver version`)
    process.exit(1)
  }

  // For explicit versions without -rc suffix, require the suffix
  if (isValidVersion && !/-rc\.\d+$/.test(versionSpecifier!)) {
    console.error(`❌ Explicit RC versions must include -rc.N suffix`)
    console.error(
      `Use: ${versionSpecifier}-rc.0 or a keyword (patch/minor/major/prepatch/preminor/premajor/prerelease)`
    )
    process.exit(1)
  }

  // Transform patch/minor/major to prepatch/preminor/premajor for RC
  if (versionSpecifier === 'patch') rcSpecifier = 'prepatch'
  else if (versionSpecifier === 'minor') rcSpecifier = 'preminor'
  else if (versionSpecifier === 'major') rcSpecifier = 'premajor'
  else rcSpecifier = versionSpecifier // keep prepatch/preminor/premajor/prerelease/explicit
}

;(async () => {
  console.log(`\n🚀 Starting ${releaseType.toUpperCase()} Release...\n`)

  // Canary: check if there are commits that warrant a release
  if (isCanary) {
    const { workspaceVersion: canaryCheckWorkspaceVersion } = await releaseVersion({
      verbose: true,
      gitCommit: false,
      stageChanges: false,
      dryRun: true,
    })

    if (!canaryCheckWorkspaceVersion || canaryCheckWorkspaceVersion === '0.0.0') {
      console.log('ℹ️  No conventional commits found that warrant a release. Skipping.')
      process.exit(0)
    }
  }

  // --- VERSION AND BUILD ---

  const { workspaceVersion, projectsVersionData } = await releaseVersion({
    verbose: true,
    gitCommit: false,
    stageChanges: false,
    specifier: isCanary ? 'prerelease' : rcSpecifier!,
    preid: releaseType, // 'canary' or 'rc'
  })

  console.log(`\n📦 ${releaseType.toUpperCase()} Version: ${workspaceVersion}\n`)

  // Update version.ts files
  console.log('📦 Updating version.ts files...')
  execSync('npx tsx scripts/update-version-files.ts', { stdio: 'inherit' })

  // Rebuild packages
  console.log('\n🔨 Rebuilding packages with new versions...')
  execSync('npx nx run-many --target=build --all', { stdio: 'inherit' })
  console.log('✅ Build complete\n')

  // --- CHANGELOG (canary and RC) ---

  if (isCanary || isRC) {
    const gh_token_bak = process.env.GITHUB_TOKEN
    process.env.GITHUB_TOKEN = process.env.RELEASE_GITHUB_TOKEN

    const originalAuth = execSync('git config --local http.https://github.com/.extraheader')
      .toString()
      .trim()

    const authHeader = `AUTHORIZATION: basic ${Buffer.from(`x-access-token:${process.env.RELEASE_GITHUB_TOKEN}`).toString('base64')}`
    execSync(`git config --local http.https://github.com/.extraheader "${authHeader}"`)

    await releaseChangelog({
      versionData: projectsVersionData,
      version: workspaceVersion,
      verbose: true,
      gitCommit: false,
      stageChanges: false,
      gitPush: false,
    })

    execSync(`git config --local http.https://github.com/.extraheader "${originalAuth}"`)
    process.env.GITHUB_TOKEN = gh_token_bak
  }

  // --- PUBLISH ---

  console.log(`\n🚀 Publishing to npm with "${releaseType}" tag...\n`)

  const publishResult = await releasePublish({
    registry: 'https://registry.npmjs.org/',
    access: 'public',
    tag: releaseType,
    verbose: true,
  })

  // Publish gotrue-js legacy
  console.log(`\n📦 Publishing @supabase/gotrue-js (legacy mirror) with "${releaseType}" tag...`)
  try {
    execSync(`npx tsx scripts/publish-gotrue-legacy.ts --tag=${releaseType}`, { stdio: 'inherit' })
  } catch (error) {
    console.error('❌ Failed to publish gotrue-js legacy package:', error)
    console.log('⚠️  Continuing with release despite gotrue-js publish failure')
  }

  // Publish to JSR
  console.log(`\n📦 Publishing packages to JSR with "${releaseType}" tag...`)
  try {
    execSync(`npx tsx scripts/publish-to-jsr.ts --tag=${releaseType}`, { stdio: 'inherit' })
  } catch (error) {
    console.error('❌ Failed to publish to JSR:', error)
    console.log('⚠️  Continuing with release despite JSR publish failure')
  }

  // Write version file (RC only, for CI to read)
  if (isRC) {
    try {
      await writeFile('.release-version', workspaceVersion ?? '', 'utf-8')
      console.log(`\n✅ Wrote version to .release-version: ${workspaceVersion}`)
    } catch (error) {
      console.error('❌ Failed to write release version to file', error)
    }
  }

  console.log(`\n✨ ${releaseType.toUpperCase()} Release Complete!\n`)
  console.log(`📦 Published version: ${workspaceVersion}`)
  console.log(`🏷️  Dist-tag: ${releaseType}`)
  if (isRC) {
    console.log(`📥 Install command: npm install @supabase/supabase-js@rc`)
    console.log(`🏷️  Git tag created: v${workspaceVersion}`)
    console.log(
      `🚀 GitHub release: https://github.com/supabase/supabase-js/releases/tag/v${workspaceVersion}\n`
    )
  } else if (isCanary) {
    console.log(`🏷️  Git tag created: v${workspaceVersion}\n`)
  }

  process.exit(Object.values(publishResult).every((result) => result.code === 0) ? 0 : 1)
})()
