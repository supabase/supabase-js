type Json = string | number | boolean | null | { [key: string]: Json } | Json[]

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          username: string
          data: Json | null
          age_range: string | null
          status: 'ONLINE' | 'OFFLINE' | null
          catchphrase: string | null
        }
        Insert: {
          username: string
          data?: Json | null
          age_range?: string | null
          status?: 'ONLINE' | 'OFFLINE' | null
          catchphrase?: string | null
        }
        Update: {
          username?: string
          data?: Json | null
          age_range?: string | null
          status?: 'ONLINE' | 'OFFLINE' | null
          catchphrase?: string | null
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
        Args: {
          name_param: string
        }
        Returns: 'ONLINE' | 'OFFLINE'
      }
      get_username_and_status: {
        Args: {
          name_param: string
        }
        Returns: {
          username: string
          status: 'ONLINE' | 'OFFLINE' | null
        }[]
      }
      void_func: {
        Args: {}
        Returns: undefined
      }
    }
  }
  personal: {
    Tables: {
      users: {
        Row: {
          username: string
          data: Json | null
          age_range: string | null
          status: 'ONLINE' | 'OFFLINE' | null
        }
        Insert: {
          username: string
          data?: Json | null
          age_range?: string | null
          status?: 'ONLINE' | 'OFFLINE' | null
        }
        Update: {
          username?: string
          data?: Json | null
          age_range?: string | null
          status?: 'ONLINE' | 'OFFLINE' | null
        }
      }
    }
    Functions: {
      get_status: {
        Args: {
          name_param: string
        }
        Returns: 'ONLINE' | 'OFFLINE' | null
      }
    }
  }
}
