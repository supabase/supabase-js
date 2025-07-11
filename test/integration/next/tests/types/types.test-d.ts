import { expectType } from 'tsd'
import { createServerClient, createBrowserClient } from '@supabase/ssr'

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

{
  //  createBrowserClient should be able discriminate postgrest version
  const pg13Client = createBrowserClient<DatabaseWithInternals>('HTTP://localhost:3000', '')
  const pg12Client = createBrowserClient<Database>('HTTP://localhost:3000', '')
  const res13 = await pg13Client.from('shops').update({ id: 21 }).maxAffected(1)
  const res12 = await pg12Client.from('shops').update({ id: 21 }).maxAffected(1)
  expectType<typeof res13.data>(null)
  expectType<typeof res12.Error>('maxAffected method only available on postgrest 13+')
}

{
  // createBrowserClient should return a typed client
  const pg12Client = createBrowserClient<Database>('HTTP://localhost:3000', '')
  const res12 = await pg12Client.from('shops').select('*')
  expectType<
    | {
        address: string | null
        id: number
        shop_geom: unknown | null
      }[]
    | null
  >(res12.data)
}

{
  // createBrowserClient should infer everything to any without types provided
  const pg12Client = createBrowserClient('HTTP://localhost:3000', '')
  const res12 = await pg12Client.from('shops').select('address, id, relation(field)')
  expectType<
    | {
        address: any
        id: any
        relation: {
          field: any
        }[]
      }[]
    | null
  >(res12.data)
}

{
  //  createServerClient should be able discriminate postgrest version
  const pg13Client = createServerClient<DatabaseWithInternals>('HTTP://localhost:3000', '')
  const pg12Client = createServerClient<Database>('HTTP://localhost:3000', '')
  const res13 = await pg13Client.from('shops').update({ id: 21 }).maxAffected(1)
  const res12 = await pg12Client.from('shops').update({ id: 21 }).maxAffected(1)
  expectType<typeof res13.data>(null)
  expectType<typeof res12.Error>('maxAffected method only available on postgrest 13+')
}

{
  // createServerClient should return a typed client
  const pg12Client = createServerClient<Database>('HTTP://localhost:3000', '')
  const res12 = await pg12Client.from('shops').select('*')
  expectType<
    | {
        address: string | null
        id: number
        shop_geom: unknown | null
      }[]
    | null
  >(res12.data)
}

{
  // createServerClient should infer everything to any without types provided
  const pg12Client = createServerClient('HTTP://localhost:3000', '')
  const res12 = await pg12Client.from('shops').select('address, id, relation(field)')
  expectType<
    | {
        address: any
        id: any
        relation: {
          field: any
        }[]
      }[]
    | null
  >(res12.data)
}

//  should default to postgrest 12 for untyped client
{
  const pg12ServerClient = createServerClient('HTTP://localhost:3000', '')
  const res12Server = await pg12ServerClient.from('shops').update({ id: 21 }).maxAffected(1)
  const pg12BrowserClient = createBrowserClient('HTTP://localhost:3000', '')
  const res12Browser = await pg12BrowserClient.from('shops').update({ id: 21 }).maxAffected(1)
  expectType<typeof res12Server.Error>('maxAffected method only available on postgrest 13+')
  expectType<typeof res12Browser.Error>('maxAffected method only available on postgrest 13+')
}
