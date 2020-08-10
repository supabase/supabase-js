declare module '@supabase/supabase-js' {
  interface User {
    app_metadata: {
      provider: 'email'
      [key: string]: any
    }
    user_metadata: {
      [key: string]: any
    }
    aud: string
    created_at: string
    confirmed_at: string
    email: string
    id: string
    last_sign_in_at: string
    role: string
    updated_at: string
  }

  interface AuthResponse {
    status: number
    body: {
      user: User
      access_token: string
      refresh_token: string
      expires_in: number
      unauthorized: boolean
    }
  }

  interface Auth {
    /**
     * Allow your users to sign up and create a new account.
     * After they have signed up, all interactions using the Supabase JS client will be performed as "that user".
     */
    signup: (email: string, password: string) => Promise<AuthResponse>
    /**
     * If an account is created, users can login to your app.
     * After they have logged in, all interactions using the Supabase JS client will be performed as "that user".
     */
    login: (email: string, password: string) => Promise<AuthResponse>
    /**
     * Get the JSON data for the logged in user.
     */
    user: () => Promise<User>
    /**
     * After calling log out, all interactions using the Supabase JS client will be "anonymous".
     */
    logout: () => Promise<void>
  }

  interface SupabaseClient {
    /**
     * Supabase Auth allows you to create and manage user sessions for access to data that is secured by access policies.
     */
    auth: Auth
  }

  const createClient: (
    /**
     * The unique Supabase URL which is supplied when you create a new project in your project dashboard.
     */
    supabaseUrl: string,
    /**
     * The unique Supabase Key which is supplied when you create a new project in your project dashboard.
     */
    supabaseKey: string,
    options?: {
      autoRefreshToken: boolean
      /**
       * You can switch in between schemas.
       * The schema however would need to be on the list of exposed schemas.
       * Defaults to the 'public' schema.
       * If there is the need to use more than one schema,
       * another instance of .createClient() would need to be instantiated.
       */
      schema: string
    }
  ) => SupabaseClient
}
