/**
 * Type tests for the /dev subpath export.
 */

import { expectError, expectType } from 'tsd'
import type { User } from '@supabase/auth-js'
import SupabaseClient from '../../src/SupabaseClient'
import { devSession, type DevSession } from '../../src/dev'
import { Database } from '../types'

async function main() {
  // Test: the session client is a regular client typed with the database
  const session = await devSession<Database>({ slot: 's07', branchRef: 'abcd1234' })
  expectType<DevSession<Database, 'public', 'public'>>(session)
  expectType<SupabaseClient<Database, 'public', 'public'>>(session.client)
  expectType<User | null>(session.user)
  expectType<string>(session.uniq('slug'))
  expectType<string>(session.uniq())

  // Test: the admin client has the same type as the session client
  const admin = session.adminClient({ scope: { users: { username: 'supabot' } } })
  expectType<SupabaseClient<Database, 'public', 'public'>>(admin)

  // Test: slot and branchRef are required
  expectError(devSession({ slot: 's07' }))
  expectError(devSession({ branchRef: 'abcd1234' }))

  // Test: the namespace always comes from the slot
  expectError(devSession({ slot: 's07', branchRef: 'abcd1234', options: { namespace: 'other' } }))
}

main()
