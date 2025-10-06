#!/usr/bin/env node

const { execSync } = require('child_process')
const path = require('path')

// Get the monorepo root directory (go up from scripts/ to postgrest-js/ to core/ to packages/ to root)
const monorepoRoot = path.resolve(__dirname, '../../../../')

// Run prettier from the monorepo root
const command =
  process.argv[2] === 'check'
    ? 'npx prettier --ignore-path packages/core/postgrest-js/.gitignore --check "packages/core/postgrest-js/**/*{ts,js,mjs,json,yml,yaml}"'
    : 'npx prettier --ignore-path packages/core/postgrest-js/.gitignore --write "packages/core/postgrest-js/**/*{ts,js,mjs,json,yml,yaml}"'

try {
  execSync(command, { cwd: monorepoRoot, stdio: 'inherit' })
} catch (error) {
  process.exit(error.status || 1)
}
