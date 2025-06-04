import { memoryLocalStorageAdapter } from '../../src/lib/local-storage'

describe('memoryLocalStorageAdapter', () => {
  it('sets and gets a value', () => {
    const adapter = memoryLocalStorageAdapter()
    adapter.setItem('foo', 'bar')
    expect(adapter.getItem('foo')).toBe('bar')
  })

  it('returns null for unknown key', () => {
    const adapter = memoryLocalStorageAdapter()
    expect(adapter.getItem('missing')).toBeNull()
  })

  it('removes an item', () => {
    const adapter = memoryLocalStorageAdapter()
    adapter.setItem('key', 'value')
    adapter.removeItem('key')
    expect(adapter.getItem('key')).toBeNull()
  })
})
