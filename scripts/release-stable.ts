import { execSync } from 'child_process'
;(async () => {
  if (process.env.RELEASE_GITHUB_TOKEN) {
    const remoteUrl = `https://x-access-token:${process.env.RELEASE_GITHUB_TOKEN}@github.com/supabase/supabase-js.git`
    execSync(`git remote set-url origin "${remoteUrl}"`)
  }

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

  // npm publish with OIDC
  // not strictly necessary to restore the header but do it incase  we require it later
  execSync(`git config --local http.https://github.com/.extraheader "${originalAuth}"`)
  // restore the GH token
  process.env.GITHUB_TOKEN = gh_token_bak

  // ---- Create release branch + PR ----
  // switch back to the releaser GitHub token
  process.env.GITHUB_TOKEN = process.env.RELEASE_GITHUB_TOKEN

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

    execSync(`git push origin ${branchName}`)

    // Open PR using GitHub CLI
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
