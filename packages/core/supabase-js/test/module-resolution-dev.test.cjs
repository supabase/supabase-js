/**
 * CommonJS module resolution test for the /dev subpath export.
 */

const { devSession } = require('@supabase/supabase-js/dev')
const { SupabaseClient } = require('@supabase/supabase-js')

console.log('Testing @supabase/supabase-js/dev CommonJS exports...')

if (typeof devSession !== 'function') {
  throw new Error('devSession is not exported')
}

async function main() {
  const { client, uniq } = await devSession({
    slot: 's07',
    branchRef: 'abcd1234',
    url: 'https://abcd1234.supabase.co',
    key: 'sb_publishable_abc',
    options: { auth: { persistSession: false, autoRefreshToken: false } },
  })

  // The /dev entry and the main entry share one SupabaseClient class.
  if (!(client instanceof SupabaseClient)) {
    throw new Error('devSession client is not a SupabaseClient from the main entry')
  }

  if (client.channel('room').topic !== 'realtime:s07:room') {
    throw new Error('devSession client is not in the slot namespace')
  }

  if (!/^s07-slug-[0-9a-z]{8}$/.test(uniq('slug'))) {
    throw new Error('uniq returned an unexpected value')
  }

  console.log('✓ devSession creates a namespaced client')
  console.log('\n✅ All CommonJS module resolution tests passed for @supabase/supabase-js/dev')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
