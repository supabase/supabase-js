import { DEFAULT_HEADERS } from '../../src/lib/constants'
import { version } from '../../src/lib/version'

test('it has the correct type of returning with the correct value', () => {
  let JS_ENV = ''
  // @ts-ignore
  if (typeof Deno !== 'undefined') {
    JS_ENV = 'deno'
  } else if (typeof document !== 'undefined') {
    JS_ENV = 'web'
  } else if (typeof navigator !== 'undefined' && navigator.product === 'ReactNative') {
    JS_ENV = 'react-native'
  } else {
    JS_ENV = 'node'
  }
  const expected = {
    'X-Client-Info': `supabase-js-${JS_ENV}/${version}`,
  }
  expect(DEFAULT_HEADERS).toEqual(expected)
  expect(typeof DEFAULT_HEADERS).toBe('object')
  expect(typeof DEFAULT_HEADERS['X-Client-Info']).toBe('string')
  expect(Object.keys(DEFAULT_HEADERS).length).toBe(1)
})
