export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export interface Database {
  personal: {
    Tables: {
      users: {
        Row: {
          age_range: unknown | null
          data: Json | null
          status: Database['public']['Enums']['user_status'] | null
          username: string
        }
        Insert: {
          age_range?: unknown | null
          data?: Json | null
          status?: Database['public']['Enums']['user_status'] | null
          username: string
        }
        Update: {
          age_range?: unknown | null
          data?: Json | null
          status?: Database['public']['Enums']['user_status'] | null
          username?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_status: {
        Args: {
          name_param: string
        }
        Returns: Database['public']['Enums']['user_status']
      }
    }
    Enums: {
      user_status: 'ONLINE' | 'OFFLINE'
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      channel_details: {
        Row: {
          details: string | null
          id: number
        }
        Insert: {
          details?: string | null
          id: number
        }
        Update: {
          details?: string | null
          id?: number
        }
        Relationships: [
          {
            foreignKeyName: 'channel_details_id_fkey'
            columns: ['id']
            isOneToOne: true
            referencedRelation: 'channels'
            referencedColumns: ['id']
          },
        ]
      }
      channels: {
        Row: {
          data: Json | null
          id: number
          slug: string | null
        }
        Insert: {
          data?: Json | null
          id?: number
          slug?: string | null
        }
        Update: {
          data?: Json | null
          id?: number
          slug?: string | null
        }
        Relationships: []
      }
      messages: {
        Row: {
          channel_id: number
          data: Json | null
          id: number
          message: string | null
          username: string
        }
        Insert: {
          channel_id: number
          data?: Json | null
          id?: number
          message?: string | null
          username: string
        }
        Update: {
          channel_id?: number
          data?: Json | null
          id?: number
          message?: string | null
          username?: string
        }
        Relationships: [
          {
            foreignKeyName: 'messages_channel_id_fkey'
            columns: ['channel_id']
            referencedRelation: 'channels'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'messages_username_fkey'
            columns: ['username']
            referencedRelation: 'users'
            referencedColumns: ['username']
          },
          {
            foreignKeyName: 'messages_username_fkey'
            columns: ['username']
            referencedRelation: 'non_updatable_view'
            referencedColumns: ['username']
          },
          {
            foreignKeyName: 'messages_username_fkey'
            columns: ['username']
            referencedRelation: 'updatable_view'
            referencedColumns: ['username']
          },
        ]
      }
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
      users: {
        Row: {
          age_range: unknown | null
          catchphrase: unknown | null
          data: Json | null
          status: Database['public']['Enums']['user_status'] | null
          username: string
        }
        Insert: {
          age_range?: unknown | null
          catchphrase?: unknown | null
          data?: Json | null
          status?: Database['public']['Enums']['user_status'] | null
          username: string
        }
        Update: {
          age_range?: unknown | null
          catchphrase?: unknown | null
          data?: Json | null
          status?: Database['public']['Enums']['user_status'] | null
          username?: string
        }
        Relationships: []
      }
    }
    Views: {
      non_updatable_view: {
        Row: {
          username: string | null
        }
        Relationships: []
      }
      updatable_view: {
        Row: {
          non_updatable_column: number | null
          username: string | null
        }
        Insert: {
          non_updatable_column?: never
          username?: string | null
        }
        Update: {
          non_updatable_column?: never
          username?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      get_status: {
        Args: {
          name_param: string
        }
        Returns: Database['public']['Enums']['user_status']
      }
      get_username_and_status: {
        Args: {
          name_param: string
        }
        Returns: {
          username: string
          status: Database['public']['Enums']['user_status']
        }[]
      }
      offline_user: {
        Args: {
          name_param: string
        }
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
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
