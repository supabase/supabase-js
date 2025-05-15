import { HeaderManager } from '../src/utils'

describe('HeaderManager', () => {
  describe('constructor', () => {
    it('should initialize with empty header when no value provided', () => {
      const manager = new HeaderManager('Prefer')
      expect(manager.get()).toBe('')
    })

    it('should parse existing header string correctly', () => {
      const manager = new HeaderManager('Prefer', 'return=representation,tx=rollback')
      expect(manager.get()).toBe('return=representation,tx=rollback')
    })

    it('should handle empty string in constructor', () => {
      const manager = new HeaderManager('Prefer', '')
      expect(manager.get()).toBe('')
    })

    it('should handle whitespace in header string', () => {
      const manager = new HeaderManager('Prefer', '  return=representation  ,  tx=rollback  ')
      expect(manager.get()).toBe('return=representation,tx=rollback')
    })
  })

  describe('add', () => {
    it('should add single value', () => {
      const manager = new HeaderManager('Prefer')
      manager.add('return=representation')
      expect(manager.get()).toBe('return=representation')
    })

    it('should add multiple values', () => {
      const manager = new HeaderManager('Prefer')
      manager.add('return=representation')
      manager.add('tx=rollback')
      expect(manager.get()).toBe('return=representation,tx=rollback')
    })

    it('should not add duplicate values', () => {
      const manager = new HeaderManager('Prefer')
      manager.add('return=representation')
      manager.add('return=representation')
      expect(manager.get()).toBe('return=representation')
    })

    it('should append to existing values', () => {
      const manager = new HeaderManager('Prefer', 'return=representation')
      manager.add('tx=rollback')
      expect(manager.get()).toBe('return=representation,tx=rollback')
    })
  })

  describe('has', () => {
    it('should return true for existing value', () => {
      const manager = new HeaderManager('Prefer', 'return=representation')
      expect(manager.has('return=representation')).toBe(true)
    })

    it('should return false for non-existing value', () => {
      const manager = new HeaderManager('Prefer', 'return=representation')
      expect(manager.has('tx=rollback')).toBe(false)
    })

    it('should handle whitespace in value check', () => {
      const manager = new HeaderManager('Prefer', 'return=representation')
      expect(manager.has('  return=representation  ')).toBe(false)
    })
  })

  describe('clear', () => {
    it('should clear all values', () => {
      const manager = new HeaderManager('Prefer', 'return=representation,tx=rollback')
      manager.clear()
      expect(manager.get()).toBe('')
    })

    it('should not throw when clearing empty header', () => {
      const manager = new HeaderManager('Prefer')
      expect(() => manager.clear()).not.toThrow()
    })
  })

  describe('integration scenarios', () => {
    it('should handle select() scenario', () => {
      const manager = new HeaderManager('Prefer')
      manager.add('return=representation')
      expect(manager.get()).toBe('return=representation')
    })

    it('should handle rollback() scenario', () => {
      const manager = new HeaderManager('Prefer', 'return=representation')
      manager.add('tx=rollback')
      expect(manager.get()).toBe('return=representation,tx=rollback')
    })

    it('should handle multiple operations in sequence', () => {
      const manager = new HeaderManager('Prefer')
      manager.add('return=representation')
      manager.add('tx=rollback')
      manager.add('count=exact')
      expect(manager.get()).toBe('return=representation,tx=rollback,count=exact')
    })

    it('should handle existing header with multiple values', () => {
      const manager = new HeaderManager('Prefer', 'return=representation,tx=rollback')
      manager.add('count=exact')
      expect(manager.get()).toBe('return=representation,tx=rollback,count=exact')
    })
  })

  describe('edge cases', () => {
    it('should handle empty values in header string', () => {
      const manager = new HeaderManager('Prefer', 'return=representation,,tx=rollback')
      expect(manager.get()).toBe('return=representation,tx=rollback')
    })

    it('should handle multiple commas in header string', () => {
      const manager = new HeaderManager('Prefer', 'return=representation,,,tx=rollback')
      expect(manager.get()).toBe('return=representation,tx=rollback')
    })

    it('should handle whitespace-only values in header string', () => {
      const manager = new HeaderManager('Prefer', 'return=representation,   ,tx=rollback')
      expect(manager.get()).toBe('return=representation,tx=rollback')
    })
  })
})
