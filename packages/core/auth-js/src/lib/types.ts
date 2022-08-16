import { AuthError } from './errors'

/** One of the providers supported by GoTrue. */
export type Provider =
  | 'apple'
  | 'azure'
  | 'bitbucket'
  | 'discord'
  | 'facebook'
  | 'github'
  | 'gitlab'
  | 'google'
  | 'keycloak'
  | 'linkedin'
  | 'notion'
  | 'slack'
  | 'spotify'
  | 'twitch'
  | 'twitter'
  | 'workos'

export type AuthChangeEvent =
  | 'PASSWORD_RECOVERY'
  | 'SIGNED_IN'
  | 'SIGNED_OUT'
  | 'TOKEN_REFRESHED'
  | 'USER_UPDATED'
  | 'USER_DELETED'

export type AuthResponse =
  | {
      data: {
        user: User | null
        session: Session | null
      }
      error: null
    }
  | {
      data: {
        user: null
        session: null
      }
      error: AuthError
    }

export type OAuthResponse =
  | {
      data: {
        provider: Provider
        url: string
      }
      error: null
    }
  | {
      data: {
        provider: Provider
        url: null
      }
      error: AuthError
    }

export type UserResponse =
  | {
      data: {
        user: User
      }
      error: null
    }
  | {
      data: {
        user: null
      }
      error: AuthError
    }

export interface Session {
  provider_token?: string | null
  /**
   * The access token jwt. It is recommended to set the JWT_EXPIRY to a shorter expiry value.
   */
  access_token: string
  /**
   * A one-time used refresh token that never expires.
   */
  refresh_token: string
  /**
   * The number of seconds until the token expires (since it was issued). Returned when a login is confirmed.
   */
  expires_in: number
  /**
   * A timestamp of when the token will expire. Returned when a login is confirmed.
   */
  expires_at?: number
  token_type: string
  user: User
}

export interface UserIdentity {
  id: string
  user_id: string
  identity_data: {
    [key: string]: any
  }
  provider: string
  created_at: string
  last_sign_in_at: string
  updated_at?: string
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
  email_change_sent_at?: string
  new_email?: string
  invited_at?: string
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
  identities?: UserIdentity[]
}

export interface UserAttributes {
  /**
   * The user's email.
   */
  email?: string

  /**
   * The user's phone.
   */
  phone?: string

  /**
   * The user's password.
   */
  password?: string

  /**
   * An email change token.
   */
  email_change_token?: string

  /**
   * A custom data object for user_metadata that a user can modify. Can be any JSON.
   */
  data?: object
}

export interface AdminUserAttributes extends UserAttributes {
  /**
   * A custom data object for user_metadata.
   *
   * Can be any JSON.
   *
   * Only a service role can modify.
   *
   * Note: When using the GoTrueAdminApi and wanting to modify a user's user_metadata,
   * this attribute is used instead of UserAttributes data.
   *
   */
  user_metadata?: object

  /**
   * A custom data object for app_metadata that.
   *
   * Only a service role can modify.
   *
   * Can be any JSON that includes app-specific info, such as identity providers, roles, and other
   * access control information.
   */
  app_metadata?: object

  /**
   * Sets if a user has confirmed their email address.
   *
   * Only a service role can modify.
   */
  email_confirm?: boolean

  /**
   * Sets if a user has confirmed their phone number.
   *
   * Only a service role can modify.
   */
  phone_confirm?: boolean
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

export type SignUpWithPasswordCredentials =
  | {
      /** The user's email address. */
      email: string
      /** The user's password. */
      password: string
      options?: {
        /** The redirect url embedded in the email link */
        emailRedirectTo?: string
        /** The user's metadata. */
        data?: object
        /** Verification token received when the user completes the captcha on the site. */
        captchaToken?: string
      }
    }
  | {
      /** The user's phone number. */
      phone: string
      /** The user's password. */
      password: string
      options?: {
        /** The user's metadata. */
        data?: object
        /** Verification token received when the user completes the captcha on the site. */
        captchaToken?: string
      }
    }
export type SignInWithPasswordCredentials =
  | {
      /** The user's email address. */
      email: string
      /** The user's password. */
      password: string
      options?: {
        /** Verification token received when the user completes the captcha on the site. */
        captchaToken?: string
      }
    }
  | {
      /** The user's phone number. */
      phone: string
      /** The user's password. */
      password: string
      options?: {
        /** Verification token received when the user completes the captcha on the site. */
        captchaToken?: string
      }
    }

export type SignInWithPasswordlessCredentials =
  | {
      /** The user's email address. */
      email: string
      options?: {
        /** The redirect url embedded in the email link */
        emailRedirectTo?: string
        /** If set to false, this method will not create a new user. Defaults to true. */
        shouldCreateUser?: boolean
        /** Verification token received when the user completes the captcha on the site. */
        captchaToken?: string
      }
    }
  | {
      /** The user's phone number. */
      phone: string
      options?: {
        /** If set to false, this method will not create a new user. Defaults to true. */
        shouldCreateUser?: boolean
        /** Verification token received when the user completes the captcha on the site. */
        captchaToken?: string
      }
    }

export type SignInWithOAuthCredentials = {
  /** One of the providers supported by GoTrue. */
  provider: Provider
  options?: {
    /** A URL to send the user to after they are confirmed (OAuth logins only). */
    redirectTo?: string
    /** A space-separated list of scopes granted to the OAuth application. */
    scopes?: string
    /** An object of query params */
    queryParams?: { [key: string]: string }
  }
}

export type VerifyOtpParams = VerifyMobileOtpParams | VerifyEmailOtpParams
export interface VerifyMobileOtpParams {
  /** The user's phone number. */
  phone: string
  /** The otp sent to the user's phone number. */
  token: string
  /** The user's verification type. */
  type: MobileOtpType
}
export interface VerifyEmailOtpParams {
  /** The user's email address. */
  email: string
  /** The otp sent to the user's email address. */
  token: string
  /** The user's verification type. */
  type: EmailOtpType
}

export type MobileOtpType = 'sms' | 'phone_change'
export type EmailOtpType = 'signup' | 'invite' | 'magiclink' | 'recovery' | 'email_change'

/** The link type */
export type GenerateLinkType =
  | 'signup'
  | 'invite'
  | 'magiclink'
  | 'recovery'
  | 'email_change_current'
  | 'email_change_new'

type AnyFunction = (...args: any[]) => any
type MaybePromisify<T> = T | Promise<T>

type PromisifyMethods<T> = {
  [K in keyof T]: T[K] extends AnyFunction
    ? (...args: Parameters<T[K]>) => MaybePromisify<ReturnType<T[K]>>
    : T[K]
}

export type SupportedStorage = PromisifyMethods<Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>>

export type CallRefreshTokenResult =
  | {
      session: Session
      error: null
    }
  | {
      session: null
      error: AuthError
    }
