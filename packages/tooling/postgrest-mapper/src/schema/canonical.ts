/** Returns a deep copy whose object keys are sorted (arrays keep their order). */
export function sortKeys<T>(value: T): T {
  if (Array.isArray(value)) return value.map(sortKeys) as unknown as T
  if (typeof value === 'object' && value !== null) {
    const out: Record<string, unknown> = {}
    for (const key of Object.keys(value).sort()) {
      // defineProperty, not assignment: assigning `__proto__` would set the prototype and drop a real key of that name
      Object.defineProperty(out, key, {
        value: sortKeys((value as Record<string, unknown>)[key]),
        enumerable: true,
        writable: true,
        configurable: true,
      })
    }
    return out as T
  }
  return value
}

/** Compact JSON with sorted keys: equal data gives equal text. */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(sortKeys(value))
}
