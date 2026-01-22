import { describe, it, expect } from 'vitest'
import { resolveFetch, resolveResponse, resolveHeadersConstructor } from './fetch'

describe('fetch utilities', () => {
  it('should resolve native fetch by default', () => {
    const resolved = resolveFetch()
    expect(resolved).toBeDefined()
    expect(typeof resolved).toBe('function')
  })

  it('should resolve custom fetch when provided', () => {
    const customFetch = async () => new Response()
    const resolved = resolveFetch(customFetch)
    expect(resolved).toBeDefined()
  })

  it('should resolve Response constructor', () => {
    const resolved = resolveResponse()
    expect(resolved).toBe(Response)
  })

  it('should resolve Headers constructor', () => {
    const resolved = resolveHeadersConstructor()
    expect(resolved).toBe(Headers)
  })
})
