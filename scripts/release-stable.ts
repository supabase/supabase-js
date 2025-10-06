import { execSync } from 'child_process'
;(async () => {
  // Set remote to use GitHub App token
  if (process.env.RELEASE_GITHUB_TOKEN) {
    const remoteUrl = `https://x-access-token:${process.env.RELEASE_GITHUB_TOKEN}@github.com/supabase/supabase-js.git`
    execSync(`git remote set-url origin "${remoteUrl}"`)
  }

  // Backup GITHUB_TOKEN for later restore
  const gh_token_bak = process.env.GITHUB_TOKEN
  process.env.GITHUB_TOKEN = process.env.RELEASE_GITHUB_TOKEN

  // Backup original auth header
  let originalAuth = ''
  try {
    originalAuth = execSync('git config --local http.https://github.com/.extraheader')
      .toString()
      .trim()
  } catch {
    // Might not exist, ignore
  }

  // Switch the token used for git http requests
  const authHeader = `AUTHORIZATION: basic ${Buffer.from(`x-access-token:${process.env.RELEASE_GITHUB_TOKEN}`).toString('base64')}`
  execSync(`git config --local http.https://github.com/.extraheader "${authHeader}"`)

  // [Your code for changelog/tagging or npm publish goes here...]

  // Restore the header (if it existed) and GH token
  if (originalAuth) {
    execSync(`git config --local http.https://github.com/.extraheader "${originalAuth}"`)
  } else {
    execSync(`git config --local --unset http.https://github.com/.extraheader || true`)
  }
  process.env.GITHUB_TOKEN = gh_token_bak

  // ---- Create release branch + PR ----
  // Switch back to the releaser GitHub token
  process.env.GITHUB_TOKEN = process.env.RELEASE_GITHUB_TOKEN

  // Remove ALL credential helpers to ensure only our token is used
  try {
    execSync('git config --system --unset credential.helper || true')
  } catch {}
  try {
    execSync('git config --global --unset credential.helper || true')
  } catch {}
  try {
    execSync('git config --local --unset credential.helper || true')
  } catch {}

  // Ensure remote is set again before push
  if (process.env.RELEASE_GITHUB_TOKEN) {
    const remoteUrl = `https://x-access-token:${process.env.RELEASE_GITHUB_TOKEN}@github.com/supabase/supabase-js.git`
    execSync(`git remote set-url origin "${remoteUrl}"`)
  }

  const branchName = `release-test`

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

    execSync(`git push origin ${branchName}`)

    // Open PR using GitHub CLI (GH_TOKEN is automatically picked up in CI)
    execSync(
      `gh pr create --base master --head ${branchName} --title "chore(repo): test permissions" --body "chore(repo): test permissions"`,
      { stdio: 'inherit' }
    )

    // Enable auto-merge
    execSync(`gh pr merge --auto --squash`, { stdio: 'inherit' })
  } catch (err) {
    console.error('❌ Failed to push release branch or open PR', err)
  }
})()
