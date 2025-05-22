export type Json = unknown

export type Database = {
  // This is a dummy non existent schema to allow automatically passing down options
  // to the instanciated client at type levels from the introspected database
  __internal_supabase: {
    postgrestVersion: '13.0.12'
    // We make this still abide to `GenericSchema` to allow types helpers bellow to work the same
    Tables: {
      [_ in never]: never
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
      best_friends: {
        Row: {
          first_user: string
          id: number
          second_user: string
          third_wheel: string | null
        }
        Insert: {
          first_user: string
          id?: number
          second_user: string
          third_wheel?: string | null
        }
        Update: {
          first_user?: string
          id?: number
          second_user?: string
          third_wheel?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'best_friends_first_user_fkey'
            columns: ['first_user']
            isOneToOne: false
            referencedRelation: 'non_updatable_view'
            referencedColumns: ['username']
          },
          {
            foreignKeyName: 'best_friends_first_user_fkey'
            columns: ['first_user']
            isOneToOne: false
            referencedRelation: 'updatable_view'
            referencedColumns: ['username']
          },
          {
            foreignKeyName: 'best_friends_first_user_fkey'
            columns: ['first_user']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['username']
          },
          {
            foreignKeyName: 'best_friends_second_user_fkey'
            columns: ['second_user']
            isOneToOne: false
            referencedRelation: 'non_updatable_view'
            referencedColumns: ['username']
          },
          {
            foreignKeyName: 'best_friends_second_user_fkey'
            columns: ['second_user']
            isOneToOne: false
            referencedRelation: 'updatable_view'
            referencedColumns: ['username']
          },
          {
            foreignKeyName: 'best_friends_second_user_fkey'
            columns: ['second_user']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['username']
          },
          {
            foreignKeyName: 'best_friends_third_wheel_fkey'
            columns: ['third_wheel']
            isOneToOne: false
            referencedRelation: 'non_updatable_view'
            referencedColumns: ['username']
          },
          {
            foreignKeyName: 'best_friends_third_wheel_fkey'
            columns: ['third_wheel']
            isOneToOne: false
            referencedRelation: 'updatable_view'
            referencedColumns: ['username']
          },
          {
            foreignKeyName: 'best_friends_third_wheel_fkey'
            columns: ['third_wheel']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['username']
          }
        ]
      }
      booking: {
        Row: {
          hotel_id: number | null
          id: number
        }
        Insert: {
          hotel_id?: number | null
          id?: number
        }
        Update: {
          hotel_id?: number | null
          id?: number
        }
        Relationships: [
          {
            foreignKeyName: 'booking_hotel_id_fkey'
            columns: ['hotel_id']
            isOneToOne: false
            referencedRelation: 'hotel'
            referencedColumns: ['id']
          }
        ]
      }
      categories: {
        Row: {
          description: string | null
          id: number
          name: string
        }
        Insert: {
          description?: string | null
          id?: number
          name: string
        }
        Update: {
          description?: string | null
          id?: number
          name?: string
        }
        Relationships: []
      }
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
          }
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
      collections: {
        Row: {
          description: string | null
          id: number
          parent_id: number | null
        }
        Insert: {
          description?: string | null
          id?: number
          parent_id?: number | null
        }
        Update: {
          description?: string | null
          id?: number
          parent_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: 'collections_parent_id_fkey'
            columns: ['parent_id']
            isOneToOne: false
            referencedRelation: 'collections'
            referencedColumns: ['id']
          }
        ]
      }
      cornercase: {
        Row: {
          array_column: string[] | null
          'column whitespace': string | null
          id: number
        }
        Insert: {
          array_column?: string[] | null
          'column whitespace'?: string | null
          id: number
        }
        Update: {
          array_column?: string[] | null
          'column whitespace'?: string | null
          id?: number
        }
        Relationships: []
      }
      hotel: {
        Row: {
          id: number
          name: string | null
        }
        Insert: {
          id?: number
          name?: string | null
        }
        Update: {
          id?: number
          name?: string | null
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
            isOneToOne: false
            referencedRelation: 'channels'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'messages_username_fkey'
            columns: ['username']
            isOneToOne: false
            referencedRelation: 'non_updatable_view'
            referencedColumns: ['username']
          },
          {
            foreignKeyName: 'messages_username_fkey'
            columns: ['username']
            isOneToOne: false
            referencedRelation: 'updatable_view'
            referencedColumns: ['username']
          },
          {
            foreignKeyName: 'messages_username_fkey'
            columns: ['username']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['username']
          }
        ]
      }
      product_categories: {
        Row: {
          category_id: number
          product_id: number
        }
        Insert: {
          category_id: number
          product_id: number
        }
        Update: {
          category_id?: number
          product_id?: number
        }
        Relationships: [
          {
            foreignKeyName: 'product_categories_category_id_fkey'
            columns: ['category_id']
            isOneToOne: false
            referencedRelation: 'categories'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'product_categories_product_id_fkey'
            columns: ['product_id']
            isOneToOne: false
            referencedRelation: 'products'
            referencedColumns: ['id']
          }
        ]
      }
      products: {
        Row: {
          description: string | null
          id: number
          name: string
          price: number
        }
        Insert: {
          description?: string | null
          id?: number
          name: string
          price: number
        }
        Update: {
          description?: string | null
          id?: number
          name?: string
          price?: number
        }
        Relationships: []
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
      user_profiles: {
        Row: {
          id: number
          username: string | null
        }
        Insert: {
          id?: number
          username?: string | null
        }
        Update: {
          id?: number
          username?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'user_profiles_username_fkey'
            columns: ['username']
            isOneToOne: false
            referencedRelation: 'non_updatable_view'
            referencedColumns: ['username']
          },
          {
            foreignKeyName: 'user_profiles_username_fkey'
            columns: ['username']
            isOneToOne: false
            referencedRelation: 'updatable_view'
            referencedColumns: ['username']
          },
          {
            foreignKeyName: 'user_profiles_username_fkey'
            columns: ['username']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['username']
          }
        ]
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
      function_with_array_param: {
        Args: {
          param: string[]
        }
        Returns: undefined
      }
      function_with_optional_param: {
        Args: {
          param?: string
        }
        Returns: string
      }
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

type DefaultSchema = Database[Extract<keyof Database, 'public'>]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof (Database[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        Database[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? (Database[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      Database[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
  ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
  ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
  ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums'] | { schema: keyof Database },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
  ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema['CompositeTypes']
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
  ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  personal: {
    Enums: {
      user_status: ['ONLINE', 'OFFLINE'],
    },
  },
  public: {
    Enums: {
      user_status: ['ONLINE', 'OFFLINE'],
    },
  },
} as const
