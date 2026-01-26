describe('Module Exports', () => {
  test('can import main module successfully', () => {
    const mainExports = require('../src/index')
    expect(mainExports.StorageClient).toBeDefined()
    expect(typeof mainExports).toBe('object')
  })

  test('can import types successfully', () => {
    const types = require('../src/lib/types')
    expect(typeof types).toBe('object')
  })

  test('constants are accessible', () => {
    const constants = require('../src/lib/constants')
    expect(constants.DEFAULT_HEADERS).toBeDefined()
  })
})
