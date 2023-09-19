// constants.ts
import { version } from './version'
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
export const DEFAULT_HEADERS = { 'X-Client-Info': `supabase-js-${JS_ENV}/${version}` }
