import type { PostgrestClient } from '../../src/index'

// Ambient: the tests only type-check, they never run. Reads the global `SupabaseDatabase` from fixture/db.d.ts.
export declare const supabase: PostgrestClient
