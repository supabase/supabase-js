import { PostgrestClient } from '../../../src/index'

declare const postgrest: PostgrestClient

// No return annotations: declaration emit has to print each builder type, and the consumer reads it back.
export const readBuilder = () => postgrest.from('users').select('username, status')

export const writeBuilder = () =>
  postgrest.from('users').insert({ username: 'x' }).select('username')

export const reselectBuilder = () => postgrest.from('users').select('username').select('status')

export const rpcBuilder = () =>
  postgrest.rpc('get_username_and_status', { name_param: 'supabot' }).select('username, status')
