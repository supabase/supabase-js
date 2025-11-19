import { releaseVersion, releaseChangelog, releasePublish } from 'nx/release'
import { execSync } from 'child_process'
import { writeFile } from 'fs/promises'

function getLastStableTag(): string {
  try {
    return execSync(
      `git tag --list --sort=-version:refname | grep -E '^v?[0-9]+\\.[0-9]+\\.[0-9]+$' | head -n1`
    )
      .toString()
      .trim()
  } catch {
    return ''
  }
}

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
    `Usage: npm run release-stable -- --versionSpecifier <specifier>\n` +
      `Examples:\n` +
      `  --versionSpecifier patch | minor | major | prepatch | preminor | premajor | prerelease\n` +
      `  --versionSpecifier v2.3.4 (explicit version)\n`
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
const isValidVersion = /^v?\d+\.\d+\.\d+(-[a-zA-Z0-9.-]+)?$/.test(versionSpecifier)
if (!validSpecifiers.includes(versionSpecifier) && !isValidVersion) {
  console.error(`❌ Invalid version specifier: ${versionSpecifier}`)
  console.error(`Must be one of: ${validSpecifiers.join(', ')} or a valid semver version`)
  process.exit(1)
}

function safeExec(cmd: string, opts = {}) {
  try {
    return execSync(cmd, { stdio: 'inherit', ...opts })
  } catch (err) {
    console.error(`❌ Command failed: ${cmd}`)
    throw err
  }
}

;(async () => {
  // --- VERSION AND BUILD ---

  const { workspaceVersion, projectsVersionData } = await releaseVersion({
    verbose: true,
    gitCommit: false,
    stageChanges: false,
    specifier: versionSpecifier,
  })

  // Update version.ts files with the new versions
  console.log('\n📦 Updating version.ts files...')
  safeExec('npx tsx scripts/update-version-files.ts')

  // Rebuild packages with correct versions
  console.log('\n🔨 Rebuilding packages with new versions...')
  safeExec('npx nx run-many --target=build --all')
  console.log('✅ Build complete\n')

  // --- GIT AUTH SETUP FOR TAGGING/CHANGELOG ---

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
  safeExec(`git config --local http.https://github.com/.extraheader "${authHeader}"`)

  // ---- CHANGELOG GENERATION ---
  const result = await releaseChangelog({
    versionData: projectsVersionData,
    version: workspaceVersion,
    verbose: true,
    gitCommit: false,
    stageChanges: false,
    from: getLastStableTag(),
  })

  // --- RESTORE GIT AUTH FOR PUBLISHING ---
  // npm publish with OIDC
  // not strictly necessary to restore the header but do it incase  we require it later
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
    tag: 'latest',
    verbose: true,
  })

  // Publish gotrue-js as legacy mirror of auth-js
  console.log('\n📦 Publishing @supabase/gotrue-js (legacy mirror)...')
  try {
    safeExec('npx tsx scripts/publish-gotrue-legacy.ts --tag=latest')
  } catch (error) {
    console.error('❌ Failed to publish gotrue-js legacy package:', error)
    // Don't fail the entire release if gotrue-js fails
    console.log('⚠️  Continuing with release despite gotrue-js publish failure')
  }

  // Publish all packages to JSR
  console.log('\n📦 Publishing packages to JSR...')
  try {
    safeExec('npx tsx scripts/publish-to-jsr.ts --tag=latest')
  } catch (error) {
    console.error('❌ Failed to publish to JSR:', error)
    // Don't fail the entire release if JSR publishing fails
    console.log('⚠️  Continuing with release despite JSR publish failure')
  }

  // ---- CREATE RELEASE BRANCH + PR ----
  process.env.GITHUB_TOKEN = process.env.RELEASE_GITHUB_TOKEN

  // REMOVE ALL credential helpers and .extraheader IMMEDIATELY BEFORE PUSH
  try {
    safeExec('git config --global --unset credential.helper || true')
  } catch {}
  try {
    safeExec('git config --local --unset credential.helper || true')
  } catch {}
  try {
    safeExec('git config --local --unset http.https://github.com/.extraheader || true')
  } catch {}

  // Ensure remote is set again before push
  if (process.env.RELEASE_GITHUB_TOKEN) {
    const remoteUrl = `https://x-access-token:${process.env.RELEASE_GITHUB_TOKEN}@github.com/supabase/supabase-js.git`
    safeExec(`git remote set-url origin "${remoteUrl}"`)
  }

  const version = result.workspaceChangelog?.releaseVersion.rawVersion || workspaceVersion

  // Write version to file for CI to read
  try {
    await writeFile('.release-version', version ?? '', 'utf-8')
  } catch (error) {
    console.error('❌ Failed to write release version to file', error)
  }

  // Validate version to prevent command injection
  if (
    !version ||
    !/^(v?\d+\.\d+\.\d+(-[a-zA-Z0-9.-]+)?|patch|minor|major|prepatch|preminor|premajor|prerelease)$/.test(
      version
    )
  ) {
    console.error(`❌ Invalid version format: ${version}`)
    process.exit(1)
  }

  const branchName = `release-${version}`

  try {
    // Format generated changelogs before committing
    console.log('\n✨ Formatting generated changelogs...')
    safeExec('npx nx format:write')
    console.log('✅ Changelogs formatted\n')
    safeExec(`git checkout -b ${branchName}`)
    safeExec('git add CHANGELOG.md || true')
    safeExec('git add packages/**/CHANGELOG.md || true')

    // Commit changes if any
    try {
      safeExec(`git commit -m "chore(release): version ${version} changelogs"`)
    } catch {
      console.log('No changes to commit')
    }

    // DEBUG: Show credential config and remote before push
    safeExec('git config --local --get http.https://github.com/.extraheader || true')

    safeExec(`git push origin ${branchName}`)

    // Open PR using GitHub CLI
    safeExec(
      `gh pr create --base master --head ${branchName} --title "chore(release): version ${version} changelogs" --body "Automated PR to update changelogs for version ${version}."`
    )

    // Enable auto-merge
    safeExec(`gh pr merge --auto --squash`)

    safeExec('git stash')
    console.log('✅ Stashed package.json changes')
  } catch (err) {
    console.error('❌ Failed to push release branch or open PR', err)
  }

  process.exit(Object.values(publishResult).every((r) => r.code === 0) ? 0 : 1)
})()
