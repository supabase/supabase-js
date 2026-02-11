/**
 * Jest Global Setup
 * Runs once before all test suites
 */

export default async function globalSetup() {
  console.log('\n🚀 E2E Tests Global Setup')
  console.log('Supabase should be started via setup-main.sh before running tests')
  console.log('Environment variables should be sourced from /tmp/e2e-supabase-keys.env\n')

  // Verify required environment variables are set
  const requiredEnvVars = ['SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY']
  const missingEnvVars = requiredEnvVars.filter((key) => !process.env[key])

  if (missingEnvVars.length > 0) {
    console.warn(`⚠️  Warning: Missing environment variables: ${missingEnvVars.join(', ')}`)
    console.warn('   Run: source /tmp/e2e-supabase-keys.env')
  }
}
