import { getDefaultPropagationTargets } from '../src/defaults'
import { shouldPropagateToTarget } from '../src/validate'

describe('getDefaultPropagationTargets', () => {
  it('should include exact project hostname', () => {
    const targets = getDefaultPropagationTargets('https://myproject.supabase.co')

    expect(targets).toContain('myproject.supabase.co')
  })

  it('should include Supabase cloud wildcard targets', () => {
    const targets = getDefaultPropagationTargets('https://myproject.supabase.co')

    expect(targets).toContain('*.supabase.co')
    expect(targets).toContain('*.supabase.in')
  })

  it('should not use regex targets (avoids ReDoS surface)', () => {
    const targets = getDefaultPropagationTargets('https://myproject.supabase.co')
    expect(targets.some((t) => t instanceof RegExp)).toBe(false)
  })

  it('should include localhost and loopback addresses', () => {
    const targets = getDefaultPropagationTargets('https://myproject.supabase.co')

    expect(targets).toContain('localhost')
    expect(targets).toContain('127.0.0.1')
    expect(targets).toContain('[::1]')
  })

  it('should handle invalid URL gracefully', () => {
    const targets = getDefaultPropagationTargets('not-a-url')

    // Should still include cloud domains and localhost
    expect(targets.length).toBeGreaterThan(0)
    expect(targets).toContain('localhost')
    expect(targets).toContain('127.0.0.1')
    expect(targets).toContain('[::1]')
  })

  it('should handle URL with port', () => {
    const targets = getDefaultPropagationTargets('https://myproject.supabase.co:3000')

    expect(targets).toContain('myproject.supabase.co')
  })

  it('should handle URL with path', () => {
    const targets = getDefaultPropagationTargets('https://myproject.supabase.co/rest/v1')

    expect(targets).toContain('myproject.supabase.co')
  })

  it('should match supabase.co subdomains via wildcard', () => {
    const targets = getDefaultPropagationTargets('https://myproject.supabase.co')

    expect(shouldPropagateToTarget('https://myproject.supabase.co/x', targets)).toBe(true)
    expect(shouldPropagateToTarget('https://another.supabase.co/x', targets)).toBe(true)
    expect(shouldPropagateToTarget('https://evil.com/x', targets)).toBe(false)
  })

  it('should match supabase.in subdomains via wildcard', () => {
    const targets = getDefaultPropagationTargets('https://myproject.supabase.in')

    expect(shouldPropagateToTarget('https://myproject.supabase.in/x', targets)).toBe(true)
    expect(shouldPropagateToTarget('https://another.supabase.in/x', targets)).toBe(true)
    expect(shouldPropagateToTarget('https://evil.com/x', targets)).toBe(false)
  })
})
