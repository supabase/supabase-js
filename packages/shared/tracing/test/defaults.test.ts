import { getDefaultPropagationTargets } from '../src/defaults'

describe('getDefaultPropagationTargets', () => {
  it('should include exact project hostname', () => {
    const targets = getDefaultPropagationTargets('https://myproject.supabase.co')

    expect(targets).toContain('myproject.supabase.co')
  })

  it('should include Supabase cloud domain patterns', () => {
    const targets = getDefaultPropagationTargets('https://myproject.supabase.co')

    // Check for RegExp patterns
    const regexTargets = targets.filter((t) => t instanceof RegExp)
    expect(regexTargets).toHaveLength(2)

    const supabaseCoPattern = regexTargets.find((r) => r.test('project.supabase.co'))
    const supabaseInPattern = regexTargets.find((r) => r.test('project.supabase.in'))

    expect(supabaseCoPattern).toBeDefined()
    expect(supabaseInPattern).toBeDefined()
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

  it('should match supabase.co subdomains with RegExp', () => {
    const targets = getDefaultPropagationTargets('https://myproject.supabase.co')
    const pattern = targets.find((t) => t instanceof RegExp && t.test('project.supabase.co'))

    expect(pattern).toBeDefined()
    expect((pattern as RegExp).test('myproject.supabase.co')).toBe(true)
    expect((pattern as RegExp).test('another.supabase.co')).toBe(true)
    expect((pattern as RegExp).test('evil.com')).toBe(false)
  })

  it('should match supabase.in subdomains with RegExp', () => {
    const targets = getDefaultPropagationTargets('https://myproject.supabase.in')
    const pattern = targets.find((t) => t instanceof RegExp && t.test('project.supabase.in'))

    expect(pattern).toBeDefined()
    expect((pattern as RegExp).test('myproject.supabase.in')).toBe(true)
    expect((pattern as RegExp).test('another.supabase.in')).toBe(true)
    expect((pattern as RegExp).test('evil.com')).toBe(false)
  })
})
