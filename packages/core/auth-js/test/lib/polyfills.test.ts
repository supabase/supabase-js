import { polyfillGlobalThis } from '../../src/lib/polyfills'

describe('polyfillGlobalThis', () => {
  afterEach(() => {
    // Clean up __magic__ if it exists
    if (Object.prototype.hasOwnProperty('__magic__')) {
      delete (Object.prototype as any).__magic__
    }
  })

  it('should be defined as a function', () => {
    expect(typeof polyfillGlobalThis).toBe('function')
  })

  it('should not throw when called', () => {
    expect(() => polyfillGlobalThis()).not.toThrow()
  })

  it('should be safe to call multiple times', () => {
    expect(() => {
      polyfillGlobalThis()
      polyfillGlobalThis()
      polyfillGlobalThis()
    }).not.toThrow()
  })

  it('should ensure globalThis exists after being called', () => {
    polyfillGlobalThis()
    expect(globalThis).toBeDefined()
    expect(typeof globalThis).toBe('object')
  })

  it('should not leave __magic__ property on Object.prototype', () => {
    polyfillGlobalThis()
    expect(Object.prototype.hasOwnProperty('__magic__')).toBe(false)
  })

  it('should make globalThis usable for storing properties', () => {
    polyfillGlobalThis()

    // Verify we can use globalThis
    ;(globalThis as any).testProperty = 'test-value'
    expect((globalThis as any).testProperty).toBe('test-value')

    // Clean up
    delete (globalThis as any).testProperty
  })

  it('should not break existing Object.prototype usage', () => {
    // Add a legitimate property to Object.prototype
    ;(Object.prototype as any).testLegitimateProperty = 'test'

    polyfillGlobalThis()

    // Verify our legitimate property still exists
    expect((Object.prototype as any).testLegitimateProperty).toBe('test')

    // Verify __magic__ was cleaned up
    expect(Object.prototype.hasOwnProperty('__magic__')).toBe(false)

    // Clean up
    delete (Object.prototype as any).testLegitimateProperty
  })

  it('should not add enumerable properties to Object.prototype', () => {
    const originalKeys = Object.getOwnPropertyNames(Object.prototype)

    polyfillGlobalThis()

    const newKeys = Object.getOwnPropertyNames(Object.prototype)

    // Filter out any legitimate additions and look for __magic__
    const addedKeys = newKeys.filter(
      (key) => !originalKeys.includes(key) && key === '__magic__'
    )

    expect(addedKeys.length).toBe(0)
  })

  it('should handle environments where globalThis already exists', () => {
    // In modern Node.js/Jest, globalThis already exists
    // The polyfill should detect this and return early (no-op)

    const existingGlobalThis = globalThis
    const existingType = typeof globalThis

    polyfillGlobalThis()

    // Should still be the same
    expect(typeof globalThis).toBe(existingType)
    expect(globalThis).toBe(existingGlobalThis)
  })
})
