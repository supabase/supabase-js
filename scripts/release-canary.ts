import { releaseVersion, releaseChangelog, releasePublish } from 'nx/release'
import { execSync } from 'child_process'
;(async () => {
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

  await releaseChangelog({
    versionData: projectsVersionData,
    version: workspaceVersion,
    verbose: true,
    gitCommit: false,
    stageChanges: false,
  })

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

  execSync('git stash')
  console.log('✅ All changes stashed.')

  process.exit(Object.values(publishResult).every((result) => result.code === 0) ? 0 : 1)
})()
