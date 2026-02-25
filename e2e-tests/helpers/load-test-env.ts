/**
 * Jest setupFiles entry — runs in each worker before any modules are loaded.
 * Reads /tmp/e2e-supabase-keys.env (written by setup-main.sh) and injects
 * the RSA-signed keys into process.env so supabase-client.ts picks them up.
 */
import { readFileSync } from 'fs'

try {
  const content = readFileSync('/tmp/e2e-supabase-keys.env', 'utf8')
  for (const line of content.split('\n')) {
    const match = line.match(/^(?:export\s+)?(\w+)="([^"]*)"/)
    if (match) {
      process.env[match[1]] = match[2]
    }
  }
} catch {
  // File doesn't exist (e.g. running locally without setup-main.sh) — use defaults
}
