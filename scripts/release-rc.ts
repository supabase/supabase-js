import { releaseVersion, releaseChangelog, releasePublish } from 'nx/release'
import { execSync } from 'child_process'
import { getLastStableTag, getArg } from './utils'

const version = getArg('version')

if (!version) {
  console.error(
    `Usage: npm run release-rc -- --version <prerelease-version>\n` +
      `Examples:\n` +
      `  --version 2.101.0-rc.0\n` +
      `  --version 2.101.0-rc.1\n`
  )
  process.exit(1)
}

// Must be a valid prerelease semver (e.g. 2.101.0-rc.0)
const isValidPrerelease = /^\d+\.\d+\.\d+-[a-zA-Z0-9.-]+$/.test(version)
if (!isValidPrerelease) {
  console.error(`❌ Invalid version: "${version}". Must be a prerelease semver, e.g. 2.101.0-rc.0`)
  process.exit(1)
}

// Extract the preid (e.g. 'rc' from '2.101.0-rc.0')
const preid = version.split('-')[1].split('.')[0]

function safeExec(cmd: string, opts = {}) {
  try {
    return execSync(cmd, { stdio: 'inherit', ...opts })
  } catch (err) {
    console.error(`❌ Command failed: ${cmd}`)
    throw err
  }
}

;(async () => {
  const { workspaceVersion, projectsVersionData } = await releaseVersion({
    verbose: true,
    gitCommit: false,
    stageChanges: false,
    specifier: version,
    preid,
  })

  // Update version.ts files with the new versions
  console.log('\n📦 Updating version.ts files...')
  safeExec('npx tsx scripts/update-version-files.ts')

  // Rebuild packages with correct versions
  console.log('\n🔨 Rebuilding packages with new versions...')
  safeExec('npx nx run-many --target=build --all')
  console.log('✅ Build complete\n')

  // --- GIT AUTH SETUP FOR TAGGING/CHANGELOG ---
  const gh_token_bak = process.env.GITHUB_TOKEN
  process.env.GITHUB_TOKEN = process.env.RELEASE_GITHUB_TOKEN

  let originalAuth = ''
  try {
    originalAuth = execSync('git config --local http.https://github.com/.extraheader')
      .toString()
      .trim()
  } catch {}

  const authHeader = `AUTHORIZATION: basic ${Buffer.from(`x-access-token:${process.env.RELEASE_GITHUB_TOKEN}`).toString('base64')}`
  safeExec(`git config --local http.https://github.com/.extraheader "${authHeader}"`)

  // Generate changelog anchored to last stable tag so RC tags never pollute
  // the commit range used by future stable releases
  await releaseChangelog({
    versionData: projectsVersionData,
    version: workspaceVersion,
    verbose: true,
    gitCommit: false,
    stageChanges: false,
    from: getLastStableTag(),
  })

  // --- RESTORE GIT AUTH FOR PUBLISHING ---
  if (originalAuth) {
    safeExec(`git config --local http.https://github.com/.extraheader "${originalAuth}"`)
  } else {
    safeExec(`git config --local --unset http.https://github.com/.extraheader || true`)
  }
  process.env.GITHUB_TOKEN = gh_token_bak

  // --- NPM PUBLISH ---
  const publishResult = await releasePublish({
    registry: 'https://registry.npmjs.org/',
    access: 'public',
    tag: 'rc',
    verbose: true,
  })

  process.exit(Object.values(publishResult).every((r) => r.code === 0) ? 0 : 1)
})()
