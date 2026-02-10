#!/usr/bin/env node

const { execSync } = require('child_process');

// Get test file from arguments
const testFile = process.argv[2] || 'integration.test.ts';

// Flags for Deno 2.x
// Use import map for package resolution (points to pkg.pr.new URLs for preview testing)
const flags = '--allow-all --no-check --unstable-sloppy-imports --unstable-detect-cjs --import-map=deno.json';

// Run the test
const command = `deno test ${flags} ${testFile}`;
console.log(`Executing: ${command}\n`);

try {
  execSync(command, { stdio: 'inherit' });
} catch (error) {
  process.exit(error.status || 1);
}