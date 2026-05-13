import type { TracePropagationTarget } from './types'

/**
 * Check if trace context should be propagated to the target URL.
 *
 * This function checks if the target URL matches any of the configured
 * propagation targets. Targets can be:
 * - String: Exact hostname match or wildcard domain (*.example.com)
 * - RegExp: Pattern matching hostname
 * - Function: Custom logic to determine if URL should receive trace context
 *
 * @param targetUrl - The URL to check
 * @param targets - Array of propagation targets
 * @returns True if trace context should be propagated, false otherwise
 *
 * @example
 * ```typescript
 * const targets = [
 *   'myproject.supabase.co',           // Exact match
 *   '*.supabase.co',                   // Wildcard domain
 *   /.*\.supabase\.co$/,               // Regex pattern
 *   (url) => url.hostname === 'localhost' // Custom function
 * ]
 *
 * shouldPropagateToTarget('https://myproject.supabase.co/rest/v1/table', targets)
 * // true
 *
 * shouldPropagateToTarget('https://evil.com/api', targets)
 * // false
 * ```
 */
export function shouldPropagateToTarget(
  targetUrl: string | URL,
  targets: TracePropagationTarget[]
): boolean {
  if (!targetUrl || !targets || targets.length === 0) {
    return false
  }

  let url: URL
  if (targetUrl instanceof URL) {
    url = targetUrl
  } else {
    try {
      url = new URL(targetUrl)
    } catch (error) {
      // Invalid URL
      return false
    }
  }

  // Check each target
  for (const target of targets) {
    try {
      if (typeof target === 'string') {
        // String matcher: exact match or wildcard domain
        if (matchStringTarget(url.hostname, target)) {
          return true
        }
      } else if (target instanceof RegExp) {
        // Regex matcher
        if (target.test(url.hostname)) {
          return true
        }
      } else if (typeof target === 'function') {
        // Function matcher
        if (target(url)) {
          return true
        }
      }
    } catch (error) {
      // Ignore errors from individual matchers and continue
      continue
    }
  }

  return false
}

/**
 * Match hostname against string target (exact match or wildcard)
 *
 * @param hostname - The hostname to check
 * @param target - The target pattern (exact or wildcard)
 * @returns True if hostname matches target
 */
function matchStringTarget(hostname: string, target: string): boolean {
  // Exact match
  if (target === hostname) {
    return true
  }

  // Wildcard domain match (*.example.com)
  if (target.startsWith('*.')) {
    const domain = target.slice(2) // Remove "*."

    // Check if hostname ends with the domain
    if (hostname.endsWith(domain)) {
      // Ensure it's either an exact match or has a subdomain
      // (prevents "notexample.com" from matching "*.example.com")
      if (hostname === domain || hostname.endsWith('.' + domain)) {
        return true
      }
    }
  }

  return false
}
