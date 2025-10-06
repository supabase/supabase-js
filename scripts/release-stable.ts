import { releaseVersion, releaseChangelog, releasePublish } from 'nx/release'
import { execSync } from 'child_process'

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

;(async () => {
  // const { workspaceVersion, projectsVersionData } = await releaseVersion({
  //   verbose: true,
  //   gitCommit: false,
  //   stageChanges: false,
  //   specifier: versionSpecifier,
  // })

  if (process.env.RELEASE_GITHUB_TOKEN) {
    const remoteUrl = `https://x-access-token:${process.env.RELEASE_GITHUB_TOKEN}@github.com/supabase/supabase-js.git`
    execSync(`git remote set-url origin "${remoteUrl}"`)
    console.log('Set origin to:', remoteUrl)
  }

  // Update version.ts files with the new versions
  console.log('\n📦 Updating version.ts files...')
  // execSync('npx tsx scripts/update-version-files.ts', { stdio: 'inherit' })

  // Rebuild packages with correct versions
  console.log('\n🔨 Rebuilding packages with new versions...')
  // execSync('npx nx run-many --target=build --all', { stdio: 'inherit' })
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

  // const result = await releaseChangelog({
  //   versionData: projectsVersionData,
  //   version: workspaceVersion,
  //   verbose: true,
  //   gitCommit: false,
  //   stageChanges: false,
  // })

  // npm publish with OIDC
  // not strictly necessary to restore the header but do it incase  we require it later
  execSync(`git config --local http.https://github.com/.extraheader "${originalAuth}"`)
  // restore the GH token
  process.env.GITHUB_TOKEN = gh_token_bak

  // const publishResult = await releasePublish({
  //   registry: 'https://registry.npmjs.org/',
  //   access: 'public',
  //   tag: 'latest',
  //   verbose: true,
  // })

  // Publish gotrue-js as legacy mirror of auth-js
  // console.log('\n📦 Publishing @supabase/gotrue-js (legacy mirror)...')
  // try {
  //   execSync('npx tsx scripts/publish-gotrue-legacy.ts --tag=latest', { stdio: 'inherit' })
  // } catch (error) {
  //   console.error('❌ Failed to publish gotrue-js legacy package:', error)
  //   // Don't fail the entire release if gotrue-js fails
  //   console.log('⚠️  Continuing with release despite gotrue-js publish failure')
  // }

  // ---- Create release branch + PR ----
  // switch back to the releaser GitHub token
  process.env.GITHUB_TOKEN = process.env.RELEASE_GITHUB_TOKEN
  // const version = result.workspaceChangelog?.releaseVersion.rawVersion || workspaceVersion

  // Validate version to prevent command injection
  // Version should match semver pattern or be a valid npm version specifier
  // if (
  //   !version ||
  //   !/^(v?\d+\.\d+\.\d+(-[a-zA-Z0-9.-]+)?|patch|minor|major|prepatch|preminor|premajor|prerelease)$/.test(
  //     version
  //   )
  // ) {
  //   console.error(`❌ Invalid version format: ${version}`)
  //   process.exit(1)
  // }

  const branchName = `release-test}`

  try {
    execSync(`git checkout -b ${branchName}`)
    // create a small file and git add it
    execSync('touch test.txt')
    execSync('git add test.txt')

    // Commit changes if any
    try {
      execSync(`git commit -m "chore(repo): test permissions"`)
    } catch {
      console.log('No changes to commit')
    }

    if (process.env.RELEASE_GITHUB_TOKEN) {
      const remoteUrl = `https://x-access-token:${process.env.RELEASE_GITHUB_TOKEN}@github.com/supabase/supabase-js.git`
      execSync(`git remote set-url origin "${remoteUrl}"`)
    }

    console.log('Remote config before push:')
    console.log(execSync('git remote -v').toString())
    execSync(`git push origin ${branchName}`)

    // Open PR using GitHub CLI
    execSync(
      `gh pr create --base master --head ${branchName} --title "chore(repo): test permissions" --body "chore(repo): test permissions"`,
      { stdio: 'inherit' }
    )

    // Enable auto-merge
    execSync(`gh pr merge --auto --squash`, { stdio: 'inherit' })

    // execSync('git stash')
    // console.log('✅ Stashed package.json changes')
  } catch (err) {
    console.error('❌ Failed to push release branch or open PR', err)
  }

  // process.exit(Object.values(publishResult).every((r) => r.code === 0) ? 0 : 1)
})()
