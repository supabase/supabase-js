/**
 * @jest-environment node
 */

// Make this file a module to satisfy TypeScript's isolatedModules
export {}

describe('Node.js deprecation warning', () => {
  const originalProcess = global.process
  const originalWindow = global.window
  const originalConsoleWarn = console.warn

  beforeEach(() => {
    // Reset modules to re-run the deprecation check
    jest.resetModules()
    // Mock console.warn
    console.warn = jest.fn()
  })

  afterEach(() => {
    // Restore original values
    global.process = originalProcess
    global.window = originalWindow
    console.warn = originalConsoleWarn
    jest.resetModules()
  })

  it('should not show warning in browser environment', () => {
    // Simulate browser environment
    global.window = {} as any

    require('../../src/index')

    expect(console.warn).not.toHaveBeenCalled()
  })

  // Note: We can't easily test "process is undefined" because dependencies like ws require it
  // The code handles it correctly with typeof process === 'undefined' check
  // In real Edge Runtime, the module loading context is different

  it('should not show warning when process.version is undefined', () => {
    // Process exists but version is undefined
    // Only mock the version property to avoid TTYWRAP warnings
    Object.defineProperty(global.process, 'version', {
      value: undefined,
      configurable: true,
    })

    require('../../src/index')

    expect(console.warn).not.toHaveBeenCalled()
  })

  it('should not show warning when process.version is null', () => {
    // Process exists but version is null
    // Only mock the version property to avoid TTYWRAP warnings
    Object.defineProperty(global.process, 'version', {
      value: null,
      configurable: true,
    })

    require('../../src/index')

    expect(console.warn).not.toHaveBeenCalled()
  })

  it('should show warning for Node.js 18', () => {
    Object.defineProperty(global.process, 'version', {
      value: 'v18.0.0',
      configurable: true,
    })
    delete (global as any).window

    require('../../src/index')

    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('Node.js 18 and below are deprecated')
    )
  })

  it('should show warning for Node.js 16', () => {
    Object.defineProperty(global.process, 'version', {
      value: 'v16.14.0',
      configurable: true,
    })
    delete (global as any).window

    require('../../src/index')

    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('Node.js 18 and below are deprecated')
    )
  })

  it('should not show warning for Node.js 20', () => {
    Object.defineProperty(global.process, 'version', {
      value: 'v20.0.0',
      configurable: true,
    })
    delete (global as any).window

    require('../../src/index')

    expect(console.warn).not.toHaveBeenCalled()
  })

  it('should not show warning for Node.js 22', () => {
    Object.defineProperty(global.process, 'version', {
      value: 'v22.0.0',
      configurable: true,
    })
    delete (global as any).window

    require('../../src/index')

    expect(console.warn).not.toHaveBeenCalled()
  })

  it('should handle invalid version format gracefully', () => {
    Object.defineProperty(global.process, 'version', {
      value: 'invalid-version',
      configurable: true,
    })
    delete (global as any).window

    require('../../src/index')

    expect(console.warn).not.toHaveBeenCalled()
  })

  it('should handle version without v prefix', () => {
    Object.defineProperty(global.process, 'version', {
      value: '18.0.0',
      configurable: true,
    })
    delete (global as any).window

    require('../../src/index')

    // Should not match the regex and thus not show warning
    expect(console.warn).not.toHaveBeenCalled()
  })
})
