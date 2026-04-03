import { releaseVersion, releaseChangelog, releasePublish } from 'nx/release'
import { execSync } from 'child_process'
import { getLastStableTag } from './utils'
;(async () => {
  const { workspaceVersion: canaryCheckWorkspaceVersion } = await releaseVersion({
    verbose: true,
    gitCommit: false,
    stageChanges: false,
    dryRun: true, // Just to check if there are any conventional commits that warrant a release
  })

  // If no version bump detected, exit early
  if (!canaryCheckWorkspaceVersion || canaryCheckWorkspaceVersion === '0.0.0') {
    console.log(
      'ℹ️  No conventional commits found that warrant a release. Skipping canary release.'
    )
    process.exit(0)
  }

  // Determine the canary version by looking at ALL commits since the last stable tag.
  // The base version (major.minor.patch) reflects what the next stable will be;
  // the canary number (canary.x) simply increments for each canary on that base.
  const lastStableTag = getLastStableTag() // e.g. 'v2.101.0'
  const stableBase = lastStableTag.replace(/^v/, '') // '2.101.0'
  const [maj, min, pat] = stableBase.split('.').map(Number)

  // Parse all commits since last stable to determine the correct bump type
  const commitMessages = execSync(`git log ${lastStableTag}..HEAD --format=%s`)
    .toString()
    .trim()
    .split('\n')
    .filter(Boolean)

  let bumpType: 'major' | 'minor' | 'patch' = 'patch'
  for (const msg of commitMessages) {
    if (/^[a-z]+(\([^)]+\))?!:/.test(msg) || msg.includes('BREAKING CHANGE')) {
      bumpType = 'major'
      break
    }
    if (/^feat(\([^)]+\))?:/.test(msg) && bumpType !== 'major') {
      bumpType = 'minor'
    }
  }

  const targetBase =
    bumpType === 'major'
      ? `${maj + 1}.0.0`
      : bumpType === 'minor'
        ? `${maj}.${min + 1}.0`
        : `${maj}.${min}.${pat + 1}`

  // Fetch latest tags from remote before computing the canary number to avoid
  // conflicts if a previous run created a tag that isn't in the local clone yet
  execSync('git fetch --tags', { stdio: 'inherit' })

  // Find the next canary number for this base
  const existingCanaries = execSync(
    `git tag --list 'v${targetBase}-canary.*' --sort=-version:refname`
  )
    .toString()
    .trim()
    .split('\n')
    .filter(Boolean)
  const highestN =
    existingCanaries.length > 0
      ? parseInt(existingCanaries[0].match(/-canary\.(\d+)$/)?.[1] ?? '-1', 10)
      : -1
  const canaryVersion = `${targetBase}-canary.${highestN + 1}`

  const { workspaceVersion, projectsVersionData } = await releaseVersion({
    verbose: true,
    gitCommit: false,
    stageChanges: false,
    specifier: canaryVersion,
    preid: 'canary',
  })

  // Update version.ts files with the new versions
  console.log('\n📦 Updating version.ts files...')
  execSync('npx tsx scripts/update-version-files.ts', { stdio: 'inherit' })

  // Rebuild packages with correct versions
  console.log('\n🔨 Rebuilding packages with new versions...')
  execSync('npx nx run-many --target=build --all', { stdio: 'inherit' })
  console.log('✅ Build complete\n')

  // releaseChangelog should use the GitHub token with permission for tagging
  // before switching the token, backup the GITHUB_TOKEN so that it
  // can be restored afterwards and used by releasePublish. We can't use the same
  // token, because releasePublish wants a token that has the id_token: write permission
  // so that we can use OIDC for trusted publishing
  const gh_token_bak = process.env.GITHUB_TOKEN
  process.env.GITHUB_TOKEN = process.env.RELEASE_GITHUB_TOKEN
  // backup original auth header if exists
  let originalAuth = ''
  try {
    originalAuth = execSync('git config --local http.https://github.com/.extraheader')
      .toString()
      .trim()
  } catch {}

  // switch the token used
  const authHeader = `AUTHORIZATION: basic ${Buffer.from(`x-access-token:${process.env.RELEASE_GITHUB_TOKEN}`).toString('base64')}`
  execSync(`git config --local http.https://github.com/.extraheader "${authHeader}"`)
  await releaseChangelog({
    versionData: projectsVersionData,
    version: workspaceVersion,
    verbose: true,
    gitCommit: false,
    stageChanges: false,
  })

  // npm publish with OIDC
  // not strictly necessary to restore the header but do it incase we require it later
  if (originalAuth) {
    execSync(`git config --local http.https://github.com/.extraheader "${originalAuth}"`)
  } else {
    execSync('git config --local --unset http.https://github.com/.extraheader || true')
  }
  // restore the GH token
  process.env.GITHUB_TOKEN = gh_token_bak

  const publishResult = await releasePublish({
    registry: 'https://registry.npmjs.org/',
    access: 'public',
    tag: 'canary',
    verbose: true,
  })

  // Publish gotrue-js as legacy mirror of auth-js
  console.log('\n📦 Publishing @supabase/gotrue-js (legacy mirror)...')
  try {
    execSync('npx tsx scripts/publish-gotrue-legacy.ts --tag=canary', { stdio: 'inherit' })
  } catch (error) {
    console.error('❌ Failed to publish gotrue-js legacy package:', error)
    // Don't fail the entire release if gotrue-js fails
    console.log('⚠️  Continuing with release despite gotrue-js publish failure')
  }

  // Publish all packages to JSR
  console.log('\n📦 Publishing packages to JSR (canary)...')
  try {
    execSync('npx tsx scripts/publish-to-jsr.ts --tag=canary', { stdio: 'inherit' })
  } catch (error) {
    console.error('❌ Failed to publish to JSR:', error)
    // Don't fail the entire release if JSR publishing fails
    console.log('⚠️  Continuing with release despite JSR publish failure')
  }

  process.exit(Object.values(publishResult).every((result) => result.code === 0) ? 0 : 1)
})()
