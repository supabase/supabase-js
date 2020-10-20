export enum Provider {
  BITBUCKET = 'bitbucket',
  GITHUB = 'github',
  GITLAB = 'gitlab',
  GOOGLE = 'google',
}

export enum AuthChangeEvent {
  SIGNED_IN = 'SIGNED_IN',
  SIGNED_OUT = 'SIGNED_OUT',
  USER_UPDATED = 'USER_UPDATED',
}

export interface Session {
  access_token: string
  expires_in: number
  refresh_token: string
  token_type: string
  user: User
}
export interface User {
  id: string
  app_metadata: {
    provider?: string
    [key: string]: any
  }
  user_metadata: {
    [key: string]: any
  }
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

export interface Subscription {
  /**
   * The subscriber UUID. This will be set by the client.
   */
  id: string
  /**
   * The function to call every time there is an event. eg: (eventName) => {}
   */
  callback: (event: AuthChangeEvent, session: Session | null) => void
  /**
   * Call this to remove the listener.
   */
  unsubscribe: () => void
}
