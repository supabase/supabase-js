import { createServerClient, createBrowserClient } from '@supabase/ssr'
import { expectType } from 'tsd'

// Copied from ts-expect
// https://github.com/TypeStrong/ts-expect/blob/master/src/index.ts#L23-L27
export type TypeEqual<Target, Value> =
  (<T>() => T extends Target ? 1 : 2) extends <T>() => T extends Value ? 1 : 2 ? true : false

type Database = {
  public: {
    Tables: {
      shops: {
        Row: {
          address: string | null
          id: number
          shop_geom: unknown | null
        }
        Insert: {
          address?: string | null
          id: number
          shop_geom?: unknown | null
        }
        Update: {
          address?: string | null
          id?: number
          shop_geom?: unknown | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

{
  // createBrowserClient should return a typed client
  const pg12Client = createBrowserClient<Database>('HTTP://localhost:3000', '')
  const res12 = await pg12Client.from('shops').select('*')
  expectType<
    TypeEqual<
      | {
          address: string | null
          id: number
          shop_geom: unknown | null
        }[]
      | null,
      typeof res12.data
    >
  >(true)
}

{
  // createBrowserClient should infer everything to any without types provided
  const pg12Client = createBrowserClient('HTTP://localhost:3000', '')
  const res12 = await pg12Client.from('shops').select('address, id, relation(field)')
  expectType<
    TypeEqual<
      | {
          address: any
          id: any
          relation: {
            field: any
          }[]
        }[]
      | null,
      typeof res12.data
    >
  >(true)
}

{
  // createServerClient should return a typed client
  const pg12Server = createServerClient<Database>('HTTP://localhost:3000', '')
  const res12 = await pg12Server.from('shops').select('*')
  expectType<
    TypeEqual<
      | {
          address: string | null
          id: number
          shop_geom: unknown | null
        }[]
      | null,
      typeof res12.data
    >
  >(true)
}

{
  // createServerClient should infer everything to any without types provided
  const pg12Server = createServerClient('HTTP://localhost:3000', '')
  const res12 = await pg12Server.from('shops').select('address, id, relation(field)')
  expectType<
    TypeEqual<
      | {
          address: any
          id: any
          relation: {
            field: any
          }[]
        }[]
      | null,
      typeof res12.data
    >
  >(true)
}
// Should be able to get a PostgrestVersion 13 client from __InternalSupabase
{
  type DatabaseWithInternals = {
    __InternalSupabase: {
      PostgrestVersion: '13'
    }
    public: {
      Tables: {
        shops: {
          Row: {
            address: string | null
            id: number
            shop_geom: unknown | null
          }
          Insert: {
            address?: string | null
            id: number
            shop_geom?: unknown | null
          }
          Update: {
            address?: string | null
            id?: number
            shop_geom?: unknown | null
          }
          Relationships: []
        }
      }
      Views: {
        [_ in never]: never
      }
      Functions: {
        [_ in never]: never
      }
      Enums: {
        [_ in never]: never
      }
      CompositeTypes: {
        [_ in never]: never
      }
    }
  }
  const pg13BrowserClient = createBrowserClient<DatabaseWithInternals>('HTTP://localhost:3000', '')
  const pg13ServerClient = createServerClient<DatabaseWithInternals>('HTTP://localhost:3000', '', {
    cookies: { getAll: () => [], setAll: () => {} },
  })
  const res13 = await pg13BrowserClient.from('shops').update({ id: 21 }).maxAffected(1)
  expectType<typeof res13.data>(null)
  const res13Server = await pg13ServerClient.from('shops').update({ id: 21 }).maxAffected(1)
  expectType<typeof res13Server.data>(null)
}
{
  // Should default to PostgrestVersion 12
  const pg12BrowserClient = createBrowserClient<Database>('HTTP://localhost:3000', '')
  const pg12ServerClient = createServerClient<Database>('HTTP://localhost:3000', '', {
    cookies: { getAll: () => [], setAll: () => {} },
  })
  const res12 = await pg12BrowserClient.from('shops').update({ id: 21 }).maxAffected(1)
  expectType<typeof res12.Error>('maxAffected method only available on postgrest 13+')
  const res12Server = await pg12ServerClient.from('shops').update({ id: 21 }).maxAffected(1)
  expectType<typeof res12Server.Error>('maxAffected method only available on postgrest 13+')
}
