export type Json = unknown

export type Database = {
  personal: {
    Tables: {
      users: {
        Row: {
          age_range: unknown
          data: Json | null
          status: Database['personal']['Enums']['user_status'] | null
          username: string
        }
        Insert: {
          age_range?: unknown
          data?: Json | null
          status?: Database['personal']['Enums']['user_status'] | null
          username: string
        }
        Update: {
          age_range?: unknown
          data?: Json | null
          status?: Database['personal']['Enums']['user_status'] | null
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
        Args: { name_param: string }
        Returns: Database['personal']['Enums']['user_status']
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
            referencedRelation: 'active_users'
            referencedColumns: ['username']
          },
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
            referencedRelation: 'active_users'
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
            referencedRelation: 'active_users'
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
          },
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
      events: {
        Row: {
          created_at: string
          data: Json | null
          event_type: string | null
          id: number
          days_since_event: number | null
        }
        Insert: {
          created_at?: string
          data?: Json | null
          event_type?: string | null
          id?: number
        }
        Update: {
          created_at?: string
          data?: Json | null
          event_type?: string | null
          id?: number
        }
        Relationships: []
      }
      events_2024: {
        Row: {
          created_at: string
          data: Json | null
          event_type: string | null
          id: number
        }
        Insert: {
          created_at?: string
          data?: Json | null
          event_type?: string | null
          id: number
        }
        Update: {
          created_at?: string
          data?: Json | null
          event_type?: string | null
          id?: number
        }
        Relationships: []
      }
      events_2025: {
        Row: {
          created_at: string
          data: Json | null
          event_type: string | null
          id: number
        }
        Insert: {
          created_at?: string
          data?: Json | null
          event_type?: string | null
          id: number
        }
        Update: {
          created_at?: string
          data?: Json | null
          event_type?: string | null
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
          blurb_message: string | null
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
            referencedRelation: 'active_users'
            referencedColumns: ['username']
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
          shop_geom: unknown
        }
        Insert: {
          address?: string | null
          id: number
          shop_geom?: unknown
        }
        Update: {
          address?: string | null
          id?: number
          shop_geom?: unknown
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
            referencedRelation: 'active_users'
            referencedColumns: ['username']
          },
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
        ]
      }
      users: {
        Row: {
          age_range: unknown
          catchphrase: unknown
          data: Json | null
          status: Database['public']['Enums']['user_status'] | null
          username: string
        }
        Insert: {
          age_range?: unknown
          catchphrase?: unknown
          data?: Json | null
          status?: Database['public']['Enums']['user_status'] | null
          username: string
        }
        Update: {
          age_range?: unknown
          catchphrase?: unknown
          data?: Json | null
          status?: Database['public']['Enums']['user_status'] | null
          username?: string
        }
        Relationships: []
      }
      users_audit: {
        Row: {
          created_at: string | null
          id: number
          previous_value: number | null
          created_ago: number | null
        }
        Insert: {
          created_at?: string | null
          id?: number
          previous_value?: number | null
        }
        Update: {
          created_at?: string | null
          id?: number
          previous_value?: number | null
        }
        Relationships: []
      }
    }
    Views: {
      active_users: {
        Row: {
          age_range: unknown
          catchphrase: unknown
          data: Json | null
          status: Database['public']['Enums']['user_status'] | null
          username: string | null
        }
        Insert: {
          age_range?: unknown
          catchphrase?: unknown
          data?: Json | null
          status?: Database['public']['Enums']['user_status'] | null
          username?: string | null
        }
        Update: {
          age_range?: unknown
          catchphrase?: unknown
          data?: Json | null
          status?: Database['public']['Enums']['user_status'] | null
          username?: string | null
        }
        Relationships: []
      }
      non_updatable_view: {
        Row: {
          username: string | null
        }
        Relationships: []
      }
      recent_messages: {
        Row: {
          channel_id: number | null
          data: Json | null
          id: number | null
          message: string | null
          username: string | null
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
            referencedRelation: 'active_users'
            referencedColumns: ['username']
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
        ]
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
      blurb_message: {
        Args: { '': Database['public']['Tables']['messages']['Row'] }
        Returns: {
          error: true
        } & 'the function public.blurb_message with parameter or with a single unnamed json/jsonb parameter, but no matches were found in the schema cache'
      }
      created_ago: {
        Args: { '': Database['public']['Tables']['users_audit']['Row'] }
        Returns: {
          error: true
        } & 'the function public.created_ago with parameter or with a single unnamed json/jsonb parameter, but no matches were found in the schema cache'
      }
      days_since_event: {
        Args: { '': Database['public']['Tables']['events']['Row'] }
        Returns: {
          error: true
        } & 'the function public.days_since_event with parameter or with a single unnamed json/jsonb parameter, but no matches were found in the schema cache'
      }
      function_returning_row: {
        Args: never
        Returns: {
          age_range: unknown
          catchphrase: unknown
          data: Json | null
          status: Database['public']['Enums']['user_status'] | null
          username: string
        }
        SetofOptions: {
          from: '*'
          to: 'users'
          isOneToOne: true
          isSetofReturn: false
        }
      }
      function_returning_set_of_rows: {
        Args: never
        Returns: {
          age_range: unknown
          catchphrase: unknown
          data: Json | null
          status: Database['public']['Enums']['user_status'] | null
          username: string
        }[]
        SetofOptions: {
          from: '*'
          to: 'users'
          isOneToOne: false
          isSetofReturn: true
        }
      }
      function_returning_single_row: {
        Args: { messages: Database['public']['Tables']['messages']['Row'] }
        Returns: {
          age_range: unknown
          catchphrase: unknown
          data: Json | null
          status: Database['public']['Enums']['user_status'] | null
          username: string
        }
        SetofOptions: {
          from: 'messages'
          to: 'users'
          isOneToOne: true
          isSetofReturn: false
        }
      }
      function_using_setof_rows_one: {
        Args: { user_row: Database['public']['Tables']['users']['Row'] }
        Returns: {
          id: number
          username: string | null
        }
        SetofOptions: {
          from: 'users'
          to: 'user_profiles'
          isOneToOne: true
          isSetofReturn: true
        }
      }
      function_using_table_returns: {
        Args: { user_row: Database['public']['Tables']['users']['Row'] }
        Returns: {
          id: number
          username: string | null
        }
        SetofOptions: {
          from: 'users'
          to: 'user_profiles'
          isOneToOne: true
          isSetofReturn: false
        }
      }
      function_with_array_param: {
        Args: { param: string[] }
        Returns: undefined
      }
      function_with_optional_param: {
        Args: { param?: string }
        Returns: string
      }
      get_active_user_messages: {
        Args: {
          active_user_row: Database['public']['Views']['active_users']['Row']
        }
        Returns: {
          channel_id: number
          data: Json | null
          id: number
          message: string | null
          username: string
        }[]
        SetofOptions: {
          from: 'active_users'
          to: 'messages'
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_messages:
        | {
            Args: { user_row: Database['public']['Tables']['users']['Row'] }
            Returns: {
              channel_id: number
              data: Json | null
              id: number
              message: string | null
              username: string
            }[]
            SetofOptions: {
              from: 'users'
              to: 'messages'
              isOneToOne: false
              isSetofReturn: true
            }
          }
        | {
            Args: {
              channel_row: Database['public']['Tables']['channels']['Row']
            }
            Returns: {
              channel_id: number
              data: Json | null
              id: number
              message: string | null
              username: string
            }[]
            SetofOptions: {
              from: 'channels'
              to: 'messages'
              isOneToOne: false
              isSetofReturn: true
            }
          }
      get_messages_by_username: {
        Args: { search_username: string }
        Returns: {
          channel_id: number
          data: Json | null
          id: number
          message: string | null
          username: string
        }[]
        SetofOptions: {
          from: '*'
          to: 'messages'
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_recent_messages_by_username: {
        Args: { search_username: string }
        Returns: {
          channel_id: number | null
          data: Json | null
          id: number | null
          message: string | null
          username: string | null
        }[]
        SetofOptions: {
          from: '*'
          to: 'recent_messages'
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_status: {
        Args: { name_param: string }
        Returns: Database['public']['Enums']['user_status']
      }
      get_user_first_message: {
        Args: {
          active_user_row: Database['public']['Views']['active_users']['Row']
        }
        Returns: {
          channel_id: number | null
          data: Json | null
          id: number | null
          message: string | null
          username: string | null
        }
        SetofOptions: {
          from: 'active_users'
          to: 'recent_messages'
          isOneToOne: true
          isSetofReturn: true
        }
      }
      get_user_messages: {
        Args: { user_row: Database['public']['Tables']['users']['Row'] }
        Returns: {
          channel_id: number
          data: Json | null
          id: number
          message: string | null
          username: string
        }[]
        SetofOptions: {
          from: 'users'
          to: 'messages'
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_user_profile: {
        Args: { user_row: Database['public']['Tables']['users']['Row'] }
        Returns: {
          id: number
          username: string | null
        }
        SetofOptions: {
          from: 'users'
          to: 'user_profiles'
          isOneToOne: true
          isSetofReturn: false
        }
      }
      get_user_profile_non_nullable: {
        Args: { user_row: Database['public']['Tables']['users']['Row'] }
        Returns: {
          id: number
          username: string | null
        }
        SetofOptions: {
          from: 'users'
          to: 'user_profiles'
          isOneToOne: true
          isSetofReturn: true
        }
      }
      get_user_recent_messages:
        | {
            Args: { user_row: Database['public']['Tables']['users']['Row'] }
            Returns: {
              channel_id: number | null
              data: Json | null
              id: number | null
              message: string | null
              username: string | null
            }[]
            SetofOptions: {
              from: 'users'
              to: 'recent_messages'
              isOneToOne: false
              isSetofReturn: true
            }
          }
        | {
            Args: {
              active_user_row: Database['public']['Views']['active_users']['Row']
            }
            Returns: {
              channel_id: number | null
              data: Json | null
              id: number | null
              message: string | null
              username: string | null
            }[]
            SetofOptions: {
              from: 'active_users'
              to: 'recent_messages'
              isOneToOne: false
              isSetofReturn: true
            }
          }
      get_username_and_status: {
        Args: { name_param: string }
        Returns: {
          status: Database['public']['Enums']['user_status']
          username: string
        }[]
      }
      offline_user: {
        Args: { name_param: string }
        Returns: Database['public']['Enums']['user_status']
      }
      polymorphic_function_with_different_return: {
        Args: { '': string }
        Returns: string
      }
      polymorphic_function_with_no_params_or_unnamed:
        | { Args: never; Returns: number }
        | { Args: { '': string }; Returns: string }
      polymorphic_function_with_unnamed_default:
        | {
            Args: never
            Returns: {
              error: true
            } & 'Could not choose the best candidate function between: public.polymorphic_function_with_unnamed_default(), public.polymorphic_function_with_unnamed_default( => text). Try renaming the parameters or the function itself in the database so function overloading can be resolved'
          }
        | { Args: { ''?: string }; Returns: string }
      polymorphic_function_with_unnamed_default_overload:
        | {
            Args: never
            Returns: {
              error: true
            } & 'Could not choose the best candidate function between: public.polymorphic_function_with_unnamed_default_overload(), public.polymorphic_function_with_unnamed_default_overload( => text). Try renaming the parameters or the function itself in the database so function overloading can be resolved'
          }
        | { Args: { ''?: string }; Returns: string }
      polymorphic_function_with_unnamed_json: {
        Args: { '': Json }
        Returns: number
      }
      polymorphic_function_with_unnamed_jsonb: {
        Args: { '': Json }
        Returns: number
      }
      polymorphic_function_with_unnamed_text: {
        Args: { '': string }
        Returns: number
      }
      postgrest_resolvable_with_override_function:
        | { Args: { a: string }; Returns: number }
        | { Args: { b: number }; Returns: string }
        | {
            Args: { profile_id: number }
            Returns: {
              id: number
              username: string | null
            }[]
            SetofOptions: {
              from: '*'
              to: 'user_profiles'
              isOneToOne: false
              isSetofReturn: true
            }
          }
        | {
            Args: { user_row: Database['public']['Tables']['users']['Row'] }
            Returns: {
              channel_id: number
              data: Json | null
              id: number
              message: string | null
              username: string
            }[]
            SetofOptions: {
              from: 'users'
              to: 'messages'
              isOneToOne: false
              isSetofReturn: true
            }
          }
        | {
            Args: { cid: number; search?: string }
            Returns: {
              channel_id: number
              data: Json | null
              id: number
              message: string | null
              username: string
            }[]
            SetofOptions: {
              from: '*'
              to: 'messages'
              isOneToOne: false
              isSetofReturn: true
            }
          }
        | { Args: never; Returns: undefined }
      postgrest_unresolvable_function:
        | {
            Args: { a: string }
            Returns: {
              error: true
            } & 'Could not choose the best candidate function between: public.postgrest_unresolvable_function(a => int4), public.postgrest_unresolvable_function(a => text). Try renaming the parameters or the function itself in the database so function overloading can be resolved'
          }
        | {
            Args: { a: number }
            Returns: {
              error: true
            } & 'Could not choose the best candidate function between: public.postgrest_unresolvable_function(a => int4), public.postgrest_unresolvable_function(a => text). Try renaming the parameters or the function itself in the database so function overloading can be resolved'
          }
        | { Args: never; Returns: undefined }
      set_users_offline: {
        Args: { name_param: string }
        Returns: {
          age_range: unknown
          catchphrase: unknown
          data: Json | null
          status: Database['public']['Enums']['user_status'] | null
          username: string
        }[]
        SetofOptions: {
          from: '*'
          to: 'users'
          isOneToOne: false
          isSetofReturn: true
        }
      }
      void_func: { Args: never; Returns: undefined }
    }
    Enums: {
      user_status: 'ONLINE' | 'OFFLINE'
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
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
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
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
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
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
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema['Enums']
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema['CompositeTypes']
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
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
