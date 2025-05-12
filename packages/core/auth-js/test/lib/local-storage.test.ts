import { memoryLocalStorageAdapter, localStorageAdapter } from '../../src/lib/local-storage'
import * as helpers from '../../src/lib/helpers'

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

describe('localStorageAdapter', () => {
    beforeEach(() => {
      Object.defineProperty(globalThis, 'localStorage', {
        value: {
          getItem: jest.fn(() => 'value'),
          setItem: jest.fn(),
          removeItem: jest.fn(),
        },
        configurable: true,
      })
    })
  
    it('calls localStorage.getItem when supported', () => {
      jest.spyOn(helpers, 'supportsLocalStorage').mockReturnValue(true)
      expect(localStorageAdapter.getItem('key')).toBe('value')
      expect(globalThis.localStorage.getItem).toHaveBeenCalledWith('key')
    })
  
    it('does nothing if localStorage is not supported', () => {
      jest.spyOn(helpers, 'supportsLocalStorage').mockReturnValue(false)
      expect(localStorageAdapter.getItem('key')).toBeNull()
    })
  })
