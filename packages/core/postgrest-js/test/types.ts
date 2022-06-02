type Json = string | number | boolean | null | { [key: string]: Json } | Json[]

export interface Database {
  public: {
    Tables: {
      users: {
        Required: {
          username: string
        }
        Optional: {
          data: Json | null
          age_range: string | null
          status: 'ONLINE' | 'OFFLINE' | null
          catchphrase: string | null
        }
        Readonly: {}
      }
      channels: {
        Required: {}
        Optional: {
          id: number
          data: Json | null
          slug: string | null
        }
        Readonly: {}
      }
      messages: {
        Required: {
          username: string
          channel_id: number
        }
        Optional: {
          id: number
          data: Json | null
          message: string | null
        }
        Readonly: {}
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
        Required: {
          username: string
        }
        Optional: {
          data: Json | null
          age_range: string | null
          status: 'ONLINE' | 'OFFLINE' | null
        }
        Readonly: {}
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
