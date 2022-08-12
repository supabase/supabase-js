export type Json = string | number | boolean | null | { [key: string]: Json } | Json[]

export interface Database {
  personal: {
    Tables: {
      users: {
        Row: {
          username: string
          data: Json | null
          age_range: unknown | null
          status: 'ONLINE' | 'OFFLINE' | null
        }
        Insert: {
          username: string
          data?: Json | null
          age_range?: unknown | null
          status?: 'ONLINE' | 'OFFLINE' | null
        }
        Update: {
          username?: string
          data?: Json | null
          age_range?: unknown | null
          status?: 'ONLINE' | 'OFFLINE' | null
        }
      }
    }
    Functions: {
      get_status: {
        Args: { name_param: string }
        Returns: 'ONLINE' | 'OFFLINE'
      }
    }
  }
  public: {
    Tables: {
      users: {
        Row: {
          username: string
          data: Json | null
          age_range: unknown | null
          catchphrase: unknown | null
          status: 'ONLINE' | 'OFFLINE' | null
        }
        Insert: {
          username: string
          data?: Json | null
          age_range?: unknown | null
          catchphrase?: unknown | null
          status?: 'ONLINE' | 'OFFLINE' | null
        }
        Update: {
          username?: string
          data?: Json | null
          age_range?: unknown | null
          catchphrase?: unknown | null
          status?: 'ONLINE' | 'OFFLINE' | null
        }
      }
      channels: {
        Row: {
          id: number
          data: Json | null
          slug: string | null
        }
        Insert: {
          id?: number
          data?: Json | null
          slug?: string | null
        }
        Update: {
          id?: number
          data?: Json | null
          slug?: string | null
        }
      }
      messages: {
        Row: {
          id: number
          data: Json | null
          message: string | null
          username: string
          channel_id: number
        }
        Insert: {
          id?: number
          data?: Json | null
          message?: string | null
          username: string
          channel_id: number
        }
        Update: {
          id?: number
          data?: Json | null
          message?: string | null
          username?: string
          channel_id?: number
        }
      }
    }
    Functions: {
      get_status: {
        Args: { name_param: string }
        Returns: 'ONLINE' | 'OFFLINE'
      }
      get_username_and_status: {
        Args: { name_param: string }
        Returns: Record<string, unknown>[]
      }
      void_func: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
    }
  }
}
