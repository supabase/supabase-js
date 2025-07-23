import { polyfillGlobalThis } from '../../src/lib/polyfills'

describe('polyfillGlobalThis', () => {
  it('should be defined as a function', () => {
    expect(typeof polyfillGlobalThis).toBe('function')
  })
})
