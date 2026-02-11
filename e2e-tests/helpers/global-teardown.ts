/**
 * Jest Global Teardown
 * Runs once after all test suites
 */

export default async function globalTeardown() {
  console.log('\n✨ E2E Tests Global Teardown')
  console.log('Supabase should be stopped via cleanup-all.sh after all tests\n')
}
