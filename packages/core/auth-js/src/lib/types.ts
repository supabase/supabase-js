export interface Session {
  access_token: string
  expires_in: number
  refresh_token: string
  token_type: string
  user: User
}
export interface User {
  id: string
  app_metadata: any
  user_metadata: any
  aud: string
  email?: string
  created_at: string
  confirmed_at?: string
  last_sign_in_at?: string
  role?: string
  updated_at?: string
}


export interface UserAttributes {
  /**
   * The user's email.
   */
  email?: string

  /**
   * The user's password.
   */
  password?: string

  /**
   * An email change token.
   */
  email_change_token?: string

  /**
   * A custom data object. Can be any JSON.
   */
  data?: object
}
