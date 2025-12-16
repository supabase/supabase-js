/**
 * Module Resolution Tests (ESM)
 *
 * Tests that the package works correctly when imported via ESM.
 * This catches issues like the wrapper.mjs bug that broke jsdelivr CDN imports.
 *
 * Run with: node test/module-resolution.test.mjs
 */

import assert from 'assert'

console.log('Testing ESM import...\n')

// Test 1: Named exports work
console.log('1. Testing named exports...')
const { createClient } = await import('../dist/index.mjs')
assert(typeof createClient === 'function', 'createClient should be a function')
console.log('   ✅ Named exports work\n')

// Test 2: createClient works
console.log('2. Testing createClient...')
const client = createClient('https://example.supabase.co', 'test-key')
assert(client, 'Client should be created')
console.log('   ✅ createClient works\n')

// Test 3: Auth client exists and has methods (this is what broke in 2.86.1)
console.log('3. Testing Auth client (AuthClient null bug check)...')
assert(client.auth, 'client.auth should exist (was null in 2.86.1 bug)')
assert(typeof client.auth.signUp === 'function', 'auth.signUp should be a function')
assert(
  typeof client.auth.signInWithPassword === 'function',
  'auth.signInWithPassword should be a function'
)
assert(typeof client.auth.signOut === 'function', 'auth.signOut should be a function')
assert(typeof client.auth.getSession === 'function', 'auth.getSession should be a function')
assert(typeof client.auth.getUser === 'function', 'auth.getUser should be a function')
assert(
  typeof client.auth.onAuthStateChange === 'function',
  'auth.onAuthStateChange should be a function'
)
console.log('   ✅ Auth client works (no AuthClient null bug)\n')

// Test 4: PostgREST client exists
console.log('4. Testing PostgREST client...')
assert(typeof client.from === 'function', 'client.from should be a function')
const query = client.from('test')
assert(query, 'from() should return a query builder')
console.log('   ✅ PostgREST client works\n')

// Test 5: Storage client exists
console.log('5. Testing Storage client...')
assert(client.storage, 'client.storage should exist')
assert(typeof client.storage.from === 'function', 'storage.from should be a function')
console.log('   ✅ Storage client works\n')

// Test 6: Functions client exists
console.log('6. Testing Functions client...')
assert(client.functions, 'client.functions should exist')
assert(typeof client.functions.invoke === 'function', 'functions.invoke should be a function')
console.log('   ✅ Functions client works\n')

// Test 7: Realtime client exists
console.log('7. Testing Realtime client...')
assert(typeof client.channel === 'function', 'client.channel should be a function')
assert(typeof client.removeChannel === 'function', 'client.removeChannel should be a function')
console.log('   ✅ Realtime client works\n')

// Test 8: Type exports (check they don't throw)
console.log('8. Testing type re-exports...')
const mod = await import('../dist/index.mjs')
// These should all be importable without errors
const exports = Object.keys(mod)
assert(exports.includes('createClient'), 'Should export createClient')
console.log(`   ✅ Module exports ${exports.length} items\n`)

console.log('🎉 All ESM tests passed!')
