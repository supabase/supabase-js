export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type CustomUserDataType = {
  foo: string
  bar: {
    baz: number
  }
  en: 'ONE' | 'TWO' | 'THREE'
}

export type Database = {
  personal: {
    Tables: {
      users: {
        Row: {
          age_range: unknown | null
          data: CustomUserDataType | null
          status: Database['public']['Enums']['user_status'] | null
          username: string
        }
        Insert: {
          age_range?: unknown | null
          data?: CustomUserDataType | null
          status?: Database['public']['Enums']['user_status'] | null
          username: string
        }
        Update: {
          age_range?: unknown | null
          data?: CustomUserDataType | null
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
          },
          {
            foreignKeyName: 'collections_parent_id_fkey'
            columns: ['parent_id']
            isOneToOne: false
            referencedRelation: 'collections'
            referencedColumns: ['id']
          }
        ]
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
          },
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
      cornercase: {
        Row: {
          'column whitespace': string | null
          array_column: unknown | null
          id: number
        }
        Insert: {
          'column whitespace'?: string | null
          array_column?: unknown | null
          id: number
        }
        Update: {
          'column whitespace'?: string | null
          array_column?: unknown | null
          id?: number
        }
        Relationships: []
      }
      users: {
        Row: {
          age_range: unknown | null
          catchphrase: unknown | null
          data: CustomUserDataType | null
          status: Database['public']['Enums']['user_status'] | null
          username: string
        }
        Insert: {
          age_range?: unknown | null
          catchphrase?: unknown | null
          data?: CustomUserDataType | null
          status?: Database['public']['Enums']['user_status'] | null
          username: string
        }
        Update: {
          age_range?: unknown | null
          catchphrase?: unknown | null
          data?: CustomUserDataType | null
          status?: Database['public']['Enums']['user_status'] | null
          username?: string
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

type PublicSchema = Database[Extract<keyof Database, 'public'>]

export type Tables<
  PublicTableNameOrOptions extends
    | keyof (PublicSchema['Tables'] & PublicSchema['Views'])
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof (Database[PublicTableNameOrOptions['schema']]['Tables'] &
        Database[PublicTableNameOrOptions['schema']]['Views'])
    : never = never
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? (Database[PublicTableNameOrOptions['schema']]['Tables'] &
      Database[PublicTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : PublicTableNameOrOptions extends keyof (PublicSchema['Tables'] & PublicSchema['Views'])
  ? (PublicSchema['Tables'] & PublicSchema['Views'])[PublicTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  PublicTableNameOrOptions extends keyof PublicSchema['Tables'] | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions['schema']]['Tables']
    : never = never
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema['Tables']
  ? PublicSchema['Tables'][PublicTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  PublicTableNameOrOptions extends keyof PublicSchema['Tables'] | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions['schema']]['Tables']
    : never = never
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema['Tables']
  ? PublicSchema['Tables'][PublicTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  PublicEnumNameOrOptions extends keyof PublicSchema['Enums'] | { schema: keyof Database },
  EnumName extends PublicEnumNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicEnumNameOrOptions['schema']]['Enums']
    : never = never
> = PublicEnumNameOrOptions extends { schema: keyof Database }
  ? Database[PublicEnumNameOrOptions['schema']]['Enums'][EnumName]
  : PublicEnumNameOrOptions extends keyof PublicSchema['Enums']
  ? PublicSchema['Enums'][PublicEnumNameOrOptions]
  : never
