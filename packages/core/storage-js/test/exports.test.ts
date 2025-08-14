describe('Module Exports', () => {
  test('can import main module successfully', () => {
    const mainExports = require('../src/index')
    expect(mainExports.StorageClient).toBeDefined()
    expect(typeof mainExports).toBe('object')
  })

  test('can import lib module successfully', () => {
    const libExports = require('../src/lib/index')
    expect(typeof libExports).toBe('object')
  })

  test('constants are accessible', () => {
    const constants = require('../src/lib/constants')
    expect(constants.DEFAULT_HEADERS).toBeDefined()
  })
})
