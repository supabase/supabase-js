export type Json = string | number | boolean | null | { [key: string]: Json } | Json[]

export interface Database {
  personal: {
    Tables: {
      users: {
        Row: {
          username: string
          data: Json | null
          age_range: unknown | null
          status: Database['public']['Enums']['user_status'] | null
        }
        Insert: {
          username: string
          data?: Json | null
          age_range?: unknown | null
          status?: Database['public']['Enums']['user_status'] | null
        }
        Update: {
          username?: string
          data?: Json | null
          age_range?: unknown | null
          status?: Database['public']['Enums']['user_status'] | null
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_status: {
        Args: { name_param: string }
        Returns: Database['public']['Enums']['user_status']
      }
    }
    Enums: {
      user_status: 'ONLINE' | 'OFFLINE'
    }
  }
  public: {
    Tables: {
      shops: {
        Row: {
          id: number
          address: string | null
          shop_geom: unknown | null
        }
        Insert: {
          id: number
          address?: string | null
          shop_geom?: unknown | null
        }
        Update: {
          id?: number
          address?: string | null
          shop_geom?: unknown | null
        }
      }
      users: {
        Row: {
          username: string
          data: Json | null
          age_range: unknown | null
          catchphrase: unknown | null
          status: Database['public']['Enums']['user_status'] | null
        }
        Insert: {
          username: string
          data?: Json | null
          age_range?: unknown | null
          catchphrase?: unknown | null
          status?: Database['public']['Enums']['user_status'] | null
        }
        Update: {
          username?: string
          data?: Json | null
          age_range?: unknown | null
          catchphrase?: unknown | null
          status?: Database['public']['Enums']['user_status'] | null
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
    Views: {
      non_updatable_view: {
        Row: {
          username: string | null
        }
      }
      updatable_view: {
        Row: {
          username: string | null
          non_updatable_column: number | null
        }
        Insert: {
          username?: string | null
          non_updatable_column?: never
        }
        Update: {
          username?: string | null
          non_updatable_column?: never
        }
      }
    }
    Functions: {
      get_status: {
        Args: { name_param: string }
        Returns: Database['public']['Enums']['user_status']
      }
      get_username_and_status: {
        Args: { name_param: string }
        Returns: Record<string, unknown>[]
      }
      offline_user: {
        Args: { name_param: string }
        Returns: Database['public']['Enums']['user_status']
      }
      void_func: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
    }
    Enums: {
      user_status: 'ONLINE' | 'OFFLINE'
    }
  }
}
