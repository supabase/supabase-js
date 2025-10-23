#!/usr/bin/env node

const { execSync } = require('child_process');

// Get Deno version
let denoVersion = '1.0.0'; // default fallback
try {
  const versionOutput = execSync('deno --version', { encoding: 'utf-8' });
  const match = versionOutput.match(/deno (\d+)\.(\d+)\.(\d+)/);
  if (match) {
    denoVersion = `${match[1]}.${match[2]}.${match[3]}`;
  }
} catch (error) {
  console.warn('Could not determine Deno version, assuming 1.x');
}

const majorVersion = parseInt(denoVersion.split('.')[0]);

// Get test file from arguments
const testFile = process.argv[2] || 'integration.test.ts';

// Base flags that work for both versions
let flags = '--allow-all --no-check --unstable-sloppy-imports';

// Add version-specific flags
if (majorVersion >= 2) {
  flags += ' --unstable-detect-cjs';
  console.log(`Running with Deno ${denoVersion} (v2+ detected, using --unstable-detect-cjs)`);
} else {
  console.log(`Running with Deno ${denoVersion} (v1.x detected, skipping --unstable-detect-cjs)`);
}

// Run the test
const command = `deno test ${flags} ${testFile}`;
console.log(`Executing: ${command}\n`);

try {
  execSync(command, { stdio: 'inherit' });
} catch (error) {
  process.exit(error.status || 1);
}