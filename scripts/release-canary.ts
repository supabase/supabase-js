import { releaseVersion, releaseChangelog, releasePublish } from 'nx/release'
import { execSync } from 'child_process'
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

  const { workspaceVersion, projectsVersionData } = await releaseVersion({
    verbose: true,
    gitCommit: false,
    stageChanges: false,
    specifier: 'prerelease',
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
  // backup original auth header
  const originalAuth = execSync('git config --local http.https://github.com/.extraheader')
    .toString()
    .trim()
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
  // not strictly necessary to restore the header but do it incase  we require it later
  execSync(`git config --local http.https://github.com/.extraheader "${originalAuth}"`)
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
