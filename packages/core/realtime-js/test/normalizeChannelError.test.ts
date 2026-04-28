import { describe, expect, test } from 'vitest'
import { normalizeChannelError } from '../src/lib/normalizeChannelError'

describe('normalizeChannelError', () => {
  test('returns the original Error untouched', () => {
    const original = new Error('boom')
    expect(normalizeChannelError(original)).toBe(original)
  })

  test('preserves Error subclasses', () => {
    class CustomError extends Error {}
    const original = new CustomError('custom')
    const normalized = normalizeChannelError(original)
    expect(normalized).toBe(original)
    expect(normalized).toBeInstanceOf(CustomError)
  })

  test('wraps a string into an Error with the same message', () => {
    const result = normalizeChannelError('something failed')
    expect(result).toBeInstanceOf(Error)
    expect(result.message).toBe('something failed')
  })

  test('formats a CloseEvent-shaped object with code and reason', () => {
    const closeEvent = { code: 1006, reason: 'abnormal closure' }
    const result = normalizeChannelError(closeEvent)
    expect(result).toBeInstanceOf(Error)
    expect(result.message).toBe('socket closed: 1006 (abnormal closure)')
    expect(result.cause).toBe(closeEvent)
  })

  test('formats a CloseEvent without reason', () => {
    const closeEvent = { code: 1000 }
    const result = normalizeChannelError(closeEvent)
    expect(result.message).toBe('socket closed: 1000')
    expect(result.cause).toBe(closeEvent)
  })

  test('treats an empty reason string as missing detail', () => {
    const closeEvent = { code: 1011, reason: '' }
    const result = normalizeChannelError(closeEvent)
    expect(result.message).toBe('socket closed: 1011')
  })

  test('falls back to a generic transport message for plain objects', () => {
    const event = { type: 'error', target: {} }
    const result = normalizeChannelError(event)
    expect(result.message).toBe('channel error: transport failure')
    expect(result.cause).toBe(event)
  })

  test('returns a default Error for undefined', () => {
    const result = normalizeChannelError(undefined)
    expect(result).toBeInstanceOf(Error)
    expect(result.message).toBe('channel error: connection lost')
  })

  test('returns a default Error for null', () => {
    const result = normalizeChannelError(null)
    expect(result).toBeInstanceOf(Error)
    expect(result.message).toBe('channel error: connection lost')
  })
})
