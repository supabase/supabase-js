import type { TracePropagationTarget } from './types'

/**
 * Generate default propagation targets based on the Supabase project URL.
 *
 * By default, trace context is only propagated to Supabase domains for security.
 * This prevents leaking trace context to potentially malicious third-party services.
 *
 * Default targets include:
 * - The exact project hostname (e.g., myproject.supabase.co)
 * - All Supabase cloud domains (*.supabase.co, *.supabase.in)
 * - Localhost and loopback addresses (for local development)
 *
 * @param supabaseUrl - The Supabase project URL
 * @returns Array of default propagation targets
 *
 * @example
 * ```typescript
 * const targets = getDefaultPropagationTargets('https://myproject.supabase.co')
 *
 * // Returns:
 * // [
 * //   'myproject.supabase.co',   // Exact project URL
 * //   /.*\.supabase\.co$/,       // Supabase cloud
 * //   /.*\.supabase\.in$/,       // Supabase cloud (alternative)
 * //   'localhost',               // Local development
 * //   '127.0.0.1',               // IPv4 loopback
 * //   '::1'                      // IPv6 loopback
 * // ]
 * ```
 */
export function getDefaultPropagationTargets(supabaseUrl: string): TracePropagationTarget[] {
  const targets: TracePropagationTarget[] = []

  // Add exact project hostname
  try {
    const url = new URL(supabaseUrl)
    targets.push(url.hostname)
  } catch (error) {
    // Invalid URL, skip exact hostname
  }

  // Add Supabase cloud domains
  targets.push(
    /.*\.supabase\.co$/, // Main Supabase cloud domain
    /.*\.supabase\.in$/ // Alternative Supabase cloud domain
  )

  // Add localhost and loopback addresses for local development
  targets.push('localhost', '127.0.0.1', '[::1]')

  return targets
}
