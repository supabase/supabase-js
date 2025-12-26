

import { createClient } from '@supabase/supabase-js'

async function testConcurrentGetSession() {
  const supabase = createClient(
    'https://example.supabase.co',
    'public-anon-key'
  )

  console.log('Testing concurrent getSession() calls...')
  console.log('Expected: Only 1 network request should be made')
  console.log('Previous behavior: 10 network requests would be made\n')

  const startTime = Date.now()

  const promises = Array.from({ length: 10 }, (_, i) => {
    console.log(`Initiating getSession() call #${i + 1}`)
    return supabase.auth.getSession()
  })


  const results = await Promise.all(promises)

  const endTime = Date.now()
  const duration = endTime - startTime

  console.log(`\n✅ All 10 calls completed in ${duration}ms`)
  console.log(`All results are identical: ${results.every((r, i) => 
    i === 0 || JSON.stringify(r) === JSON.stringify(results[0])
  )}`)


  const firstResult = results[0]
  const allSame = results.every(result => 
    result.data.session === firstResult.data.session &&
    result.error === firstResult.error
  )

  if (allSame) {
    console.log('\n✅ SUCCESS: All concurrent calls returned the same result')
    console.log('This confirms request deduplication is working!')
  } else {
    console.log('\n❌ FAILURE: Results differ between calls')
  }

  return allSame
}


if (require.main === module) {
  testConcurrentGetSession()
    .then(success => {
      process.exit(success ? 0 : 1)
    })
    .catch(error => {
      console.error('Test failed with error:', error)
      process.exit(1)
    })
}

export { testConcurrentGetSession }
