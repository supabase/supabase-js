import { releaseVersion, releaseChangelog, releasePublish } from 'nx/release'
import { execSync } from 'child_process'
import { getLastStableTag, getArg } from './utils'

// Optional CLI flags for overriding default behavior (used by develop branch for v3 prereleases):
//   --base-version <version>  Skip bump detection, use this as the base (e.g. 3.0.0)
//   --preid <id>              Prerelease identifier (default: canary)
//   --tag <tag>               npm dist-tag (default: canary)
const baseVersionArg = getArg('base-version')
const preidArg = getArg('preid') ?? 'canary'
const tagArg = getArg('tag') ?? 'canary'

;(async () => {
  let targetBase: string

  if (baseVersionArg) {
    // Explicit base version provided (e.g. from develop branch for v3 prereleases).
    // Skip dry-run check and commit parsing — always publish.
    targetBase = baseVersionArg
  } else {
    // Auto-detect version from conventional commits (default behavior for master/canary)
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

    targetBase =
      bumpType === 'major'
        ? `${maj + 1}.0.0`
        : bumpType === 'minor'
          ? `${maj}.${min + 1}.0`
          : `${maj}.${min}.${pat + 1}`
  }

  // Fetch latest tags from remote before computing the prerelease number to avoid
  // conflicts if a previous run created a tag that isn't in the local clone yet
  execSync('git fetch --tags', { stdio: 'inherit' })

  // Find the next prerelease number for this base
  const existingPrereleases = execSync(
    `git tag --list 'v${targetBase}-${preidArg}.*' --sort=-version:refname`
  )
    .toString()
    .trim()
    .split('\n')
    .filter(Boolean)
  const preidPattern = new RegExp(`-${preidArg}\\.(\\d+)$`)
  const highestN =
    existingPrereleases.length > 0
      ? parseInt(existingPrereleases[0].match(preidPattern)?.[1] ?? '-1', 10)
      : -1
  const prereleaseVersion = `${targetBase}-${preidArg}.${highestN + 1}`

  const { workspaceVersion, projectsVersionData } = await releaseVersion({
    verbose: true,
    gitCommit: false,
    stageChanges: false,
    specifier: prereleaseVersion,
    preid: preidArg,
  })

  // Update version.ts files with the new versions
  console.log('\n📦 Updating version.ts files...')
  execSync('pnpm exec tsx scripts/update-version-files.ts', { stdio: 'inherit' })

  // Rebuild packages with correct versions
  console.log('\n🔨 Rebuilding packages with new versions...')
  execSync('pnpm nx run-many --target=build --all', { stdio: 'inherit' })
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
    tag: tagArg,
    verbose: true,
  })

  // Publish gotrue-js as legacy mirror of auth-js
  console.log('\n📦 Publishing @supabase/gotrue-js (legacy mirror)...')
  try {
    execSync(`pnpm exec tsx scripts/publish-gotrue-legacy.ts --tag=${tagArg}`, { stdio: 'inherit' })
  } catch (error) {
    console.error('❌ Failed to publish gotrue-js legacy package:', error)
    // Don't fail the entire release if gotrue-js fails
    console.log('⚠️  Continuing with release despite gotrue-js publish failure')
  }

  // Publish all packages to JSR
  console.log(`\n📦 Publishing packages to JSR (${tagArg})...`)
  try {
    execSync(`pnpm exec tsx scripts/publish-to-jsr.ts --tag=${tagArg}`, { stdio: 'inherit' })
  } catch (error) {
    console.error('❌ Failed to publish to JSR:', error)
    // Don't fail the entire release if JSR publishing fails
    console.log('⚠️  Continuing with release despite JSR publish failure')
  }

  process.exit(Object.values(publishResult).every((result) => result.code === 0) ? 0 : 1)
})()
