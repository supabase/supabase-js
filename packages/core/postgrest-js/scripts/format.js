#!/usr/bin/env node

const { execSync } = require('child_process');
const path = require('path');

// Get the monorepo root directory (go up from scripts/ to postgrest-js/ to core/ to packages/ to root)
const monorepoRoot = path.resolve(__dirname, '../../../../');

// Run prettier from the monorepo root
const command = process.argv[2] === 'check'
    ? 'npx prettier --check "packages/core/postgrest-js/src/**/*.ts" "packages/core/postgrest-js/test/**/*.ts"'
    : 'npx prettier --write "packages/core/postgrest-js/src/**/*.ts" "packages/core/postgrest-js/test/**/*.ts" packages/core/postgrest-js/wrapper.mjs';

try {
    execSync(command, { cwd: monorepoRoot, stdio: 'inherit' });
} catch (error) {
    process.exit(error.status || 1);
}
