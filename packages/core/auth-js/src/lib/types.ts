import { AuthError } from './errors'
import { Fetch } from './fetch'

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

export type GoTrueClientOptions = {
  /* The URL of the GoTrue server. */
  url?: string
  /* Any additional headers to send to the GoTrue server. */
  headers?: { [key: string]: string }
  /* Optional key name used for storing tokens in local storage. */
  storageKey?: string
  /* Set to "true" if you want to automatically detects OAuth grants in the URL and signs in the user. */
  detectSessionInUrl?: boolean
  /* Set to "true" if you want to automatically refresh the token before expiring. */
  autoRefreshToken?: boolean
  /* Set to "true" if you want to automatically save the user session into local storage. If set to false, session will just be saved in memory. */
  persistSession?: boolean
  /* Provide your own local storage implementation to use instead of the browser's local storage. */
  storage?: SupportedStorage
  /* A custom fetch implementation. */
  fetch?: Fetch
}

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
  /**
   * The oauth provider token. If present, this can be used to make external API requests to the oauth provider used.
   */
  provider_token?: string | null
  /**
   * The oauth provider refresh token. If present, this can be used to refresh the provider_token via the oauth provider's API.
   * Not all oauth providers return a provider refresh token. If the provider_refresh_token is missing, please refer to the oauth provider's documentation for information on how to obtain the provider refresh token.
   */
  provider_refresh_token?: string | null
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

export interface UserAppMetadata {
  provider?: string
  [key: string]: any
}

export interface UserMetadata {
  [key: string]: any
}

export interface User {
  id: string
  app_metadata: UserAppMetadata
  user_metadata: UserMetadata
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
   * A custom data object to store the user's metadata. This maps to the `auth.users.user_metadata` column.
   *
   * The `data` should be a JSON object that includes user-specific info, such as their first and last name.
   *
   */
  data?: object
}

export interface AdminUserAttributes extends UserAttributes {
  /**
   * A custom data object to store the user's metadata. This maps to the `auth.users.user_metadata` column.
   *
   * Only a service role can modify.
   *
   * The `user_metadata` should be a JSON object that includes user-specific info, such as their first and last name.
   *
   * Note: When using the GoTrueAdminApi and wanting to modify a user's metadata,
   * this attribute is used instead of UserAttributes data.
   *
   */
  user_metadata?: object

  /**
   * A custom data object to store the user's application specific metadata. This maps to the `auth.users.app_metadata` column.
   *
   * Only a service role can modify.
   *
   * The `app_metadata` should be a JSON object that includes app-specific info, such as identity providers, roles, and other
   * access control information.
   */
  app_metadata?: object

  /**
   * Confirms the user's email address if set to true.
   *
   * Only a service role can modify.
   */
  email_confirm?: boolean

  /**
   * Confirms the user's phone number if set to true.
   *
   * Only a service role can modify.
   */
  phone_confirm?: boolean

  /**
   * Determines how long a user is banned for.
   *
   * The format for the ban duration follows a strict sequence of decimal numbers with a unit suffix.
   * Valid time units are "ns", "us" (or "µs"), "ms", "s", "m", "h".
   *
   * For example, some possible durations include: '300ms', '2h45m'.
   *
   * Setting the ban duration to 'none' lifts the ban on the user.
   */
  ban_duration?: string | 'none'
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
        /**
         * A custom data object to store the user's metadata. This maps to the `auth.users.user_metadata` column.
         *
         * The `data` should be a JSON object that includes user-specific info, such as their first and last name.
         */
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
        /**
         * A custom data object to store the user's metadata. This maps to the `auth.users.user_metadata` column.
         *
         * The `data` should be a JSON object that includes user-specific info, such as their first and last name.
         */
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
        /**
         * A custom data object to store the user's metadata. This maps to the `auth.users.user_metadata` column.
         *
         * The `data` should be a JSON object that includes user-specific info, such as their first and last name.
         */
        data?: object
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
        /**
         * A custom data object to store the user's metadata. This maps to the `auth.users.user_metadata` column.
         *
         * The `data` should be a JSON object that includes user-specific info, such as their first and last name.
         */
        data?: object
        /** Verification token received when the user completes the captcha on the site. */
        captchaToken?: string
      }
    }

export type SignInWithOAuthCredentials = {
  /** One of the providers supported by GoTrue. */
  provider: Provider
  options?: {
    /** A URL to send the user to after they are confirmed. */
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
  options?: {
    /** A URL to send the user to after they are confirmed. */
    redirectTo?: string
    /** Verification token received when the user completes the captcha on the site. */
    captchaToken?: string
  }
}
export interface VerifyEmailOtpParams {
  /** The user's email address. */
  email: string
  /** The otp sent to the user's email address. */
  token: string
  /** The user's verification type. */
  type: EmailOtpType
  options?: {
    /** A URL to send the user to after they are confirmed. */
    redirectTo?: string
    /** Verification token received when the user completes the captcha on the site. */
    captchaToken?: string
  }
}

export type MobileOtpType = 'sms' | 'phone_change'
export type EmailOtpType = 'signup' | 'invite' | 'magiclink' | 'recovery' | 'email_change'

export type GenerateSignupLinkParams = {
  type: 'signup'
  email: string
  password: string
  options?: Pick<GenerateLinkOptions, 'data' | 'redirectTo'>
}

export type GenerateInviteOrMagiclinkParams = {
  type: 'invite' | 'magiclink'
  /** The user's email */
  email: string
  options?: Pick<GenerateLinkOptions, 'data' | 'redirectTo'>
}

export type GenerateRecoveryLinkParams = {
  type: 'recovery'
  /** The user's email */
  email: string
  options?: Pick<GenerateLinkOptions, 'redirectTo'>
}

export type GenerateEmailChangeLinkParams = {
  type: 'email_change_current' | 'email_change_new'
  /** The user's email */
  email: string
  /**
   * The user's new email. Only required if type is 'email_change_current' or 'email_change_new'.
   */
  newEmail: string
  options?: Pick<GenerateLinkOptions, 'redirectTo'>
}

export interface GenerateLinkOptions {
  /**
   * A custom data object to store the user's metadata. This maps to the `auth.users.user_metadata` column.
   *
   * The `data` should be a JSON object that includes user-specific info, such as their first and last name.
   */
  data?: object
  /** The URL which will be appended to the email link generated. */
  redirectTo?: string
}

export type GenerateLinkParams =
  | GenerateSignupLinkParams
  | GenerateInviteOrMagiclinkParams
  | GenerateRecoveryLinkParams
  | GenerateEmailChangeLinkParams

export type GenerateLinkResponse =
  | {
      data: {
        properties: GenerateLinkProperties
        user: User
      }
      error: null
    }
  | {
      data: {
        properties: null
        user: null
      }
      error: AuthError
    }

/** The properties related to the email link generated  */
export type GenerateLinkProperties = {
  /**
   * The email link to send to the user.
   * The action_link follows the following format: auth/v1/verify?type={verification_type}&token={hashed_token}&redirect_to={redirect_to}
   * */
  action_link: string
  /**
   * The raw email OTP.
   * You should send this in the email if you want your users to verify using an OTP instead of the action link.
   * */
  email_otp: string
  /**
   * The hashed token appended to the action link.
   * */
  hashed_token: string
  /** The URL appended to the action link. */
  redirect_to: string
  /** The verification type that the email link is associated to. */
  verification_type: GenerateLinkType
}

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

export type InitializeResult = { error: AuthError | null }

export type CallRefreshTokenResult =
  | {
      session: Session
      error: null
    }
  | {
      session: null
      error: AuthError
    }
