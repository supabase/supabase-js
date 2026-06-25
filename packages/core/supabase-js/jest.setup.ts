// Make require available in globalThis to match actual Node.js environment
// In real Node.js, require is available in globalThis, but ts-jest may not expose it
if (typeof require !== 'undefined' && !(globalThis as any).require) {
  ;(globalThis as any).require = require
}
