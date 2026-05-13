import type { TracePropagationTarget } from './types'

/**
 * Generate default propagation targets based on the Supabase project URL.
 *
 * By default, trace context is only propagated to Supabase domains for
 * security. This prevents leaking trace context to potentially malicious
 * third-party services.
 *
 * Wildcard strings (e.g. `*.supabase.co`) are matched with linear string
 * operations rather than regex, avoiding ReDoS risk.
 *
 * @param supabaseUrl - The Supabase project URL
 * @returns Array of default propagation targets
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

  // Supabase cloud domains. Use wildcard strings (not regex) — these are
  // matched by linear hostname-suffix checks, so there is no ReDoS surface.
  targets.push('*.supabase.co', '*.supabase.in')

  // Localhost and loopback addresses for local development.
  targets.push('localhost', '127.0.0.1', '[::1]')

  return targets
}
