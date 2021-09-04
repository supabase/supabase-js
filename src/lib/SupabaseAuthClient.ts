import { GoTrueClient } from '@supabase/gotrue-js'
import { SupabaseAuthClientOptions } from './types'

export class SupabaseAuthClient extends GoTrueClient {
  constructor(options: SupabaseAuthClientOptions) {
    super(options)
  }
}
