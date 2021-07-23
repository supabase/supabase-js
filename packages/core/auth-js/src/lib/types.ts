export type Provider =
  | 'azure'
  | 'bitbucket'
  | 'facebook'
  | 'github'
  | 'gitlab'
  | 'google'
  | 'twitter'
  | 'apple'
  | 'discord'
  | 'twitch'

export type AuthChangeEvent =
  | 'SIGNED_IN'
  | 'SIGNED_OUT'
  | 'USER_UPDATED'
  | 'USER_DELETED'
  | 'PASSWORD_RECOVERY'

export interface Session {
  provider_token?: string | null
  access_token: string
  /**
   * The number of seconds until the token expires (since it was issued). Returned when a login is confirmed.
   */
  expires_in?: number
  /**
   * A timestamp of when the token will expire. Returned when a login is confirmed.
   */
  expires_at?: number
  refresh_token?: string
  token_type: string
  user: User | null
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
  confirmation_sent_at?: string
  recovery_sent_at?: string
  action_link?: string
  email?: string
  phone?: string
  created_at: string
  confirmed_at?: string
  email_confirmed_at?: string
  phone_confirmed_at?: string
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

export interface CookieOptions {
  // (Optional) The name of the cookie. Defaults to `sb:token`.
  name?: string
  // (Optional) The cookie lifetime (expiration) in seconds. Set to 8 hours by default.
  lifetime?: number
  // (Optional) The cookie domain this should run on. Leave it blank to restrict it to your domain.
  domain?: string
  path?: string
  // (Optional) SameSite configuration for the session cookie. Defaults to 'lax', but can be changed to 'strict' or 'none'. Set it to false if you want to disable the SameSite setting.
  sameSite?: string
}

export interface UserCredentials {
  email?: string
  phone?: string
  password?: string
  refreshToken?: string
  // (Optional) The name of the provider.
  provider?: Provider
}

export interface VerifyOTPParams {
  phone: string
  token: string
}
