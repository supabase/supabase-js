#!/usr/bin/env node
/**
 * Publishes pre-built packages to local Verdaccio registry for integration testing.
 *
 * This script:
 * 1. Waits for Verdaccio to be ready
 * 2. Publishes each pre-built package to the local registry
 * 3. Fails fast on any error
 *
 * Note: Packages must be built before running this script.
 */

import { exec } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(exec);

const VERDACCIO_PORT = process.env.VERDACCIO_PORT || '4873';
const REGISTRY_URL = `http://localhost:${VERDACCIO_PORT}`;
const MAX_WAIT_TIME = 60000; // 60 seconds
const POLL_INTERVAL = 500; // 500ms

// Packages to publish in dependency order
const PACKAGES = [
  'auth-js',
  'postgrest-js',
  'realtime-js',
  'storage-js',
  'functions-js',
  'supabase-js',
];

/**
 * Waits for Verdaccio to be ready by polling the health endpoint
 */
async function waitForVerdaccio() {
  const startTime = Date.now();

  while (Date.now() - startTime < MAX_WAIT_TIME) {
    try {
      const response = await fetch(REGISTRY_URL);
      if (response.ok) {
        console.log(`✓ Verdaccio is ready at ${REGISTRY_URL}`);
        return;
      }
    } catch (error) {
      // Verdaccio not ready yet, continue polling
    }

    await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL));
  }

  throw new Error(`Verdaccio failed to start within ${MAX_WAIT_TIME}ms at ${REGISTRY_URL}`);
}

/**
 * Publishes a single package to Verdaccio
 */
async function publishPackage(packageName) {
  const packagePath = `packages/core/${packageName}`;

  console.log(`  Publishing @supabase/${packageName}...`);

  try {
    const { stdout } = await execAsync(
      `npm publish --registry ${REGISTRY_URL} --access public`,
      {
        cwd: packagePath,
        maxBuffer: 10 * 1024 * 1024,
        env: {
          ...process.env,
          npm_config_registry: REGISTRY_URL,
        },
      }
    );

    console.log(`  ✓ @supabase/${packageName} published`);
  } catch (error) {
    console.error(`  ✗ Failed to publish @supabase/${packageName}:`, error.message);
    if (error.stdout) console.log(error.stdout);
    if (error.stderr) console.error(error.stderr);
    throw error;
  }
}

/**
 * Publishes all packages to Verdaccio
 */
async function publishPackages() {
  console.log(`\n📤 Publishing packages to ${REGISTRY_URL}...`);

  for (const pkg of PACKAGES) {
    await publishPackage(pkg);
  }

  console.log('\n✓ All packages published successfully');
}

/**
 * Main execution
 */
async function main() {
  try {
    console.log('🚀 Publishing packages to Verdaccio...\n');

    await waitForVerdaccio();
    await publishPackages();

    console.log('\n✅ All packages published to Verdaccio successfully');
  } catch (error) {
    console.error('\n❌ Failed to publish to Verdaccio:', error.message);
    process.exit(1);
  }
}

main();
