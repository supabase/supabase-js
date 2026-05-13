// Enforce pnpm as the only allowed package manager for this workspace.
// Runs before any deps are installed (preinstall lifecycle), so it cannot
// rely on packages from node_modules. Inspects the npm_config_user_agent
// env var that every package manager sets when invoking lifecycle scripts.

const ua = process.env.npm_config_user_agent
if (ua && !ua.startsWith('pnpm')) {
  console.error(
    '\nError: This repo must be installed with pnpm.\n' + 'Run: corepack enable && pnpm install\n'
  )
  process.exit(1)
}
