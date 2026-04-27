import GoTrueAdminApi from './GoTrueAdminApi'
import {
  AUTO_REFRESH_TICK_DURATION_MS,
  AUTO_REFRESH_TICK_THRESHOLD,
  DEFAULT_HEADERS,
  EXPIRY_MARGIN_MS,
  GOTRUE_URL,
  JWKS_TTL,
  STORAGE_KEY,
} from './lib/constants'
import {
  AuthError,
  AuthImplicitGrantRedirectError,
  AuthInvalidCredentialsError,
  AuthInvalidJwtError,
  AuthInvalidTokenResponseError,
  AuthPKCECodeVerifierMissingError,
  AuthPKCEGrantCodeExchangeError,
  AuthSessionMissingError,
  AuthUnknownError,
  isAuthApiError,
  isAuthError,
  isAuthImplicitGrantRedirectError,
  isAuthRetryableFetchError,
  isAuthSessionMissingError,
} from './lib/errors'
import {
  Fetch,
  _request,
  _sessionResponse,
  _sessionResponsePassword,
  _ssoResponse,
  _userResponse,
} from './lib/fetch'
import {
  assertPasskeyExperimentalEnabled,
  decodeJWT,
  deepClone,
  Deferred,
  generateCallbackId,
  getAlgorithm,
  getCodeChallengeAndMethod,
  getItemAsync,
  insecureUserWarningProxy,
  isBrowser,
  parseParametersFromURL,
  removeItemAsync,
  resolveFetch,
  retryable,
  setItemAsync,
  sleep,
  supportsLocalStorage,
  userNotAvailableProxy,
  validateExp,
} from './lib/helpers'
import { memoryLocalStorageAdapter } from './lib/local-storage'
import { LockAcquireTimeoutError, navigatorLock } from './lib/locks'
import { polyfillGlobalThis } from './lib/polyfills'
import { version } from './lib/version'

import { bytesToBase64URL, stringToUint8Array } from './lib/base64url'
import type {
  AuthChangeEvent,
  AuthenticatorAssuranceLevels,
  AuthFlowType,
  AuthMFAChallengePhoneResponse,
  AuthMFAChallengeResponse,
  AuthMFAChallengeTOTPResponse,
  AuthMFAChallengeWebauthnResponse,
  AuthMFAChallengeWebauthnServerResponse,
  AuthMFAEnrollPhoneResponse,
  AuthMFAEnrollResponse,
  AuthMFAEnrollTOTPResponse,
  AuthMFAEnrollWebauthnResponse,
  AuthMFAGetAuthenticatorAssuranceLevelResponse,
  AuthMFAListFactorsResponse,
  AuthMFAUnenrollResponse,
  AuthMFAVerifyResponse,
  AuthOtpResponse,
  AuthResponse,
  AuthResponsePassword,
  AuthTokenResponse,
  AuthTokenResponsePassword,
  CallRefreshTokenResult,
  EthereumWallet,
  EthereumWeb3Credentials,
  Factor,
  GoTrueClientOptions,
  GoTrueMFAApi,
  InitializeResult,
  JWK,
  JwtHeader,
  JwtPayload,
  LockFunc,
  MFAChallengeAndVerifyParams,
  MFAChallengeParams,
  MFAChallengePhoneParams,
  MFAChallengeTOTPParams,
  MFAChallengeWebauthnParams,
  MFAEnrollParams,
  MFAEnrollPhoneParams,
  MFAEnrollTOTPParams,
  MFAEnrollWebauthnParams,
  MFAUnenrollParams,
  MFAVerifyParams,
  MFAVerifyPhoneParams,
  MFAVerifyTOTPParams,
  MFAVerifyWebauthnParamFields,
  MFAVerifyWebauthnParams,
  OAuthResponse,
  AuthOAuthServerApi,
  AuthOAuthAuthorizationDetailsResponse,
  AuthOAuthConsentResponse,
  AuthOAuthGrantsResponse,
  AuthOAuthRevokeGrantResponse,
  Prettify,
  Provider,
  ResendParams,
  Session,
  SignInAnonymouslyCredentials,
  SignInWithIdTokenCredentials,
  SignInWithOAuthCredentials,
  SignInWithPasswordCredentials,
  SignInWithPasswordlessCredentials,
  SignInWithSSO,
  SignOut,
  SignUpWithPasswordCredentials,
  SolanaWallet,
  SolanaWeb3Credentials,
  SSOResponse,
  StrictOmit,
  Subscription,
  SupportedStorage,
  User,
  UserAttributes,
  UserIdentity,
  UserResponse,
  VerifyOtpParams,
  Web3Credentials,
  AuthPasskeyApi,
  ExperimentalFeatureFlags,
  SignInWithPasskeyCredentials,
  RegisterPasskeyCredentials,
  VerifyPasskeyRegistrationParams,
  StartPasskeyAuthenticationParams,
  VerifyPasskeyAuthenticationParams,
  PasskeyUpdateParams,
  PasskeyDeleteParams,
  AuthPasskeyRegistrationOptionsResponse,
  AuthPasskeyRegistrationVerifyResponse,
  AuthPasskeyAuthenticationOptionsResponse,
  AuthPasskeyAuthenticationVerifyResponse,
  AuthPasskeyListResponse,
  AuthPasskeyUpdateResponse,
  AuthPasskeyDeleteResponse,
} from './lib/types'
import {
  createSiweMessage,
  fromHex,
  getAddress,
  Hex,
  SiweMessage,
  toHex,
} from './lib/web3/ethereum'
import {
  createCredential,
  deserializeCredentialCreationOptions,
  deserializeCredentialRequestOptions,
  getCredential,
  serializeCredentialCreationResponse,
  serializeCredentialRequestResponse,
  browserSupportsWebAuthn,
  webAuthnAbortService,
  WebAuthnApi,
} from './lib/webauthn'
import {
  AuthenticationCredential,
  PublicKeyCredentialJSON,
  RegistrationCredential,
} from './lib/webauthn.dom'

polyfillGlobalThis() // Make "globalThis" available

const DEFAULT_OPTIONS: Omit<
  Required<GoTrueClientOptions>,
  'fetch' | 'storage' | 'userStorage' | 'lock'
> = {
  url: GOTRUE_URL,
  storageKey: STORAGE_KEY,
  autoRefreshToken: true,
  persistSession: true,
  detectSessionInUrl: true,
  headers: DEFAULT_HEADERS,
  flowType: 'implicit',
  debug: false,
  hasCustomAuthorizationHeader: false,
  throwOnError: false,
  lockAcquireTimeout: 5000, // 5 seconds
  skipAutoInitialize: false,
  experimental: {},
}

async function lockNoOp<R>(name: string, acquireTimeout: number, fn: () => Promise<R>): Promise<R> {
  return await fn()
}

/**
 * Caches JWKS values for all clients created in the same environment. This is
 * especially useful for shared-memory execution environments such as Vercel's
 * Fluid Compute, AWS Lambda or Supabase's Edge Functions. Regardless of how
 * many clients are created, if they share the same storage key they will use
 * the same JWKS cache, significantly speeding up getClaims() with asymmetric
 * JWTs.
 */
const GLOBAL_JWKS: { [storageKey: string]: { cachedAt: number; jwks: { keys: JWK[] } } } = {}

export default class GoTrueClient {
  private static nextInstanceID: Record<string, number> = {}

  private instanceID: number

  /**
   * Namespace for the GoTrue admin methods.
   * These methods should only be used in a trusted server-side environment.
   */
  admin: GoTrueAdminApi
  /**
   * Namespace for the MFA methods.
   */
  mfa: GoTrueMFAApi
  /**
   * Namespace for the OAuth 2.1 authorization server methods.
   * Only relevant when the OAuth 2.1 server is enabled in Supabase Auth.
   * Used to implement the authorization code flow on the consent page.
   */
  oauth: AuthOAuthServerApi
  /**
   * Namespace for passkey methods.
   * Includes lower-level two-step registration/authentication and passkey management.
   *
   * Requires `auth.experimental.passkey: true`; otherwise all methods throw.
   */
  passkey: AuthPasskeyApi
  /**
   * The storage key used to identify the values saved in localStorage
   */
  protected storageKey: string

  protected flowType: AuthFlowType

  /**
   * The JWKS used for verifying asymmetric JWTs
   */
  protected get jwks() {
    return GLOBAL_JWKS[this.storageKey]?.jwks ?? { keys: [] }
  }

  protected set jwks(value: { keys: JWK[] }) {
    GLOBAL_JWKS[this.storageKey] = { ...GLOBAL_JWKS[this.storageKey], jwks: value }
  }

  protected get jwks_cached_at() {
    return GLOBAL_JWKS[this.storageKey]?.cachedAt ?? Number.MIN_SAFE_INTEGER
  }

  protected set jwks_cached_at(value: number) {
    GLOBAL_JWKS[this.storageKey] = { ...GLOBAL_JWKS[this.storageKey], cachedAt: value }
  }

  protected autoRefreshToken: boolean
  protected persistSession: boolean
  protected storage: SupportedStorage
  /**
   * @experimental
   */
  protected userStorage: SupportedStorage | null = null
  protected memoryStorage: { [key: string]: string } | null = null
  protected stateChangeEmitters: Map<string | symbol, Subscription> = new Map()
  protected autoRefreshTicker: ReturnType<typeof setInterval> | null = null
  protected autoRefreshTickTimeout: ReturnType<typeof setTimeout> | null = null
  protected visibilityChangedCallback: (() => Promise<any>) | null = null
  protected refreshingDeferred: Deferred<CallRefreshTokenResult> | null = null
  /**
   * Keeps track of the async client initialization.
   * When null or not yet resolved the auth state is `unknown`
   * Once resolved the auth state is known and it's safe to call any further client methods.
   * Keep extra care to never reject or throw uncaught errors
   */
  protected initializePromise: Promise<InitializeResult> | null = null
  protected detectSessionInUrl:
    | boolean
    | ((url: URL, params: { [parameter: string]: string }) => boolean) = true
  protected url: string
  protected headers: {
    [key: string]: string
  }
  protected hasCustomAuthorizationHeader = false
  protected suppressGetSessionWarning = false
  protected fetch: Fetch
  protected lock: LockFunc
  protected lockAcquired = false
  protected pendingInLock: Promise<any>[] = []
  protected throwOnError: boolean
  protected lockAcquireTimeout: number
  /**
   * Opt-in flags for experimental features. Defaults to an empty object.
   * See `GoTrueClientOptions.experimental`.
   */
  protected experimental: ExperimentalFeatureFlags

  /**
   * Used to broadcast state change events to other tabs listening.
   */
  protected broadcastChannel: BroadcastChannel | null = null

  protected logDebugMessages: boolean
  protected logger: (message: string, ...args: any[]) => void = console.log

  /**
   * Create a new client for use in the browser.
   *
   * @example Using supabase-js (recommended)
   * ```ts
   * import { createClient } from '@supabase/supabase-js'
   *
   * const supabase = createClient('https://xyzcompany.supabase.co', 'your-publishable-key')
   * const { data, error } = await supabase.auth.getUser()
   * ```
   *
   * @example Standalone import for bundle-sensitive environments
   * ```ts
   * import { GoTrueClient } from '@supabase/auth-js'
   *
   * const auth = new GoTrueClient({
   *   url: 'https://xyzcompany.supabase.co/auth/v1',
   *   headers: { apikey: 'your-publishable-key' },
   *   storageKey: 'supabase-auth',
   * })
   * ```
   */
  constructor(options: GoTrueClientOptions) {
    const settings = { ...DEFAULT_OPTIONS, ...options }
    this.storageKey = settings.storageKey

    this.instanceID = GoTrueClient.nextInstanceID[this.storageKey] ?? 0
    GoTrueClient.nextInstanceID[this.storageKey] = this.instanceID + 1

    this.logDebugMessages = !!settings.debug
    if (typeof settings.debug === 'function') {
      this.logger = settings.debug
    }

    if (this.instanceID > 0 && isBrowser()) {
      const message = `${this._logPrefix()} Multiple GoTrueClient instances detected in the same browser context. It is not an error, but this should be avoided as it may produce undefined behavior when used concurrently under the same storage key.`
      console.warn(message)
      if (this.logDebugMessages) {
        console.trace(message)
      }
    }

    this.persistSession = settings.persistSession
    this.autoRefreshToken = settings.autoRefreshToken
    this.experimental = settings.experimental ?? {}
    this.admin = new GoTrueAdminApi({
      url: settings.url,
      headers: settings.headers,
      fetch: settings.fetch,
      experimental: this.experimental,
    })

    this.url = settings.url
    this.headers = settings.headers
    this.fetch = resolveFetch(settings.fetch)
    this.lock = settings.lock || lockNoOp
    this.detectSessionInUrl = settings.detectSessionInUrl
    this.flowType = settings.flowType
    this.hasCustomAuthorizationHeader = settings.hasCustomAuthorizationHeader
    this.throwOnError = settings.throwOnError
    this.lockAcquireTimeout = settings.lockAcquireTimeout

    if (settings.lock) {
      this.lock = settings.lock
    } else if (this.persistSession && isBrowser() && globalThis?.navigator?.locks) {
      this.lock = navigatorLock
    } else {
      this.lock = lockNoOp
    }

    if (!this.jwks) {
      this.jwks = { keys: [] }
      this.jwks_cached_at = Number.MIN_SAFE_INTEGER
    }

    this.mfa = {
      verify: this._verify.bind(this),
      enroll: this._enroll.bind(this),
      unenroll: this._unenroll.bind(this),
      challenge: this._challenge.bind(this),
      listFactors: this._listFactors.bind(this),
      challengeAndVerify: this._challengeAndVerify.bind(this),
      getAuthenticatorAssuranceLevel: this._getAuthenticatorAssuranceLevel.bind(this),
      webauthn: new WebAuthnApi(this),
    }

    this.oauth = {
      getAuthorizationDetails: this._getAuthorizationDetails.bind(this),
      approveAuthorization: this._approveAuthorization.bind(this),
      denyAuthorization: this._denyAuthorization.bind(this),
      listGrants: this._listOAuthGrants.bind(this),
      revokeGrant: this._revokeOAuthGrant.bind(this),
    }

    this.passkey = {
      startRegistration: this._startPasskeyRegistration.bind(this),
      verifyRegistration: this._verifyPasskeyRegistration.bind(this),
      startAuthentication: this._startPasskeyAuthentication.bind(this),
      verifyAuthentication: this._verifyPasskeyAuthentication.bind(this),
      list: this._listPasskeys.bind(this),
      update: this._updatePasskey.bind(this),
      delete: this._deletePasskey.bind(this),
    }

    if (this.persistSession) {
      if (settings.storage) {
        this.storage = settings.storage
      } else {
        if (supportsLocalStorage()) {
          this.storage = globalThis.localStorage
        } else {
          this.memoryStorage = {}
          this.storage = memoryLocalStorageAdapter(this.memoryStorage)
        }
      }

      if (settings.userStorage) {
        this.userStorage = settings.userStorage
      }
    } else {
      this.memoryStorage = {}
      this.storage = memoryLocalStorageAdapter(this.memoryStorage)
    }

    if (isBrowser() && globalThis.BroadcastChannel && this.persistSession && this.storageKey) {
      try {
        this.broadcastChannel = new globalThis.BroadcastChannel(this.storageKey)
      } catch (e: any) {
        console.error(
          'Failed to create a new BroadcastChannel, multi-tab state changes will not be available',
          e
        )
      }

      this.broadcastChannel?.addEventListener('message', async (event) => {
        this._debug('received broadcast notification from other tab or client', event)

        try {
          await this._notifyAllSubscribers(event.data.event, event.data.session, false) // broadcast = false so we don't get an endless loop of messages
        } catch (error) {
          this._debug('#broadcastChannel', 'error', error)
        }
      })
    }

    // Only auto-initialize if not explicitly disabled. Skipped in SSR contexts
    // where initialization timing must be controlled. All public methods have
    // lazy initialization, so the client remains fully functional.
    if (!settings.skipAutoInitialize) {
      this.initialize().catch((error) => {
        this._debug('#initialize()', 'error', error)
      })
    }
  }

  /**
   * Returns whether error throwing mode is enabled for this client.
   */
  public isThrowOnErrorEnabled(): boolean {
    return this.throwOnError
  }

  /**
   * Centralizes return handling with optional error throwing. When `throwOnError` is enabled
   * and the provided result contains a non-nullish error, the error is thrown instead of
   * being returned. This ensures consistent behavior across all public API methods.
   */
  private _returnResult<T extends { error: any }>(result: T): T {
    if (this.throwOnError && result && result.error) {
      throw result.error
    }
    return result
  }

  private _logPrefix(): string {
    return (
      'GoTrueClient@' +
      `${this.storageKey}:${this.instanceID} (${version}) ${new Date().toISOString()}`
    )
  }

  private _debug(...args: any[]): GoTrueClient {
    if (this.logDebugMessages) {
      this.logger(this._logPrefix(), ...args)
    }

    return this
  }

  /**
   * Initializes the client session either from the url or from storage.
   * This method is automatically called when instantiating the client, but should also be called
   * manually when checking for an error from an auth redirect (oauth, magiclink, password recovery, etc).
   *
   * @category Auth
   */
  async initialize(): Promise<InitializeResult> {
    if (this.initializePromise) {
      return await this.initializePromise
    }

    this.initializePromise = (async () => {
      return await this._acquireLock(this.lockAcquireTimeout, async () => {
        return await this._initialize()
      })
    })()

    return await this.initializePromise
  }

  /**
   * IMPORTANT:
   * 1. Never throw in this method, as it is called from the constructor
   * 2. Never return a session from this method as it would be cached over
   *    the whole lifetime of the client
   */
  private async _initialize(): Promise<InitializeResult> {
    try {
      let params: { [parameter: string]: string } = {}
      let callbackUrlType = 'none'

      if (isBrowser()) {
        params = parseParametersFromURL(window.location.href)
        if (this._isImplicitGrantCallback(params)) {
          callbackUrlType = 'implicit'
        } else if (await this._isPKCECallback(params)) {
          callbackUrlType = 'pkce'
        }
      }

      /**
       * Attempt to get the session from the URL only if these conditions are fulfilled
       *
       * Note: If the URL isn't one of the callback url types (implicit or pkce),
       * then there could be an existing session so we don't want to prematurely remove it
       */
      if (isBrowser() && this.detectSessionInUrl && callbackUrlType !== 'none') {
        const { data, error } = await this._getSessionFromURL(params, callbackUrlType)
        if (error) {
          this._debug('#_initialize()', 'error detecting session from URL', error)

          if (isAuthImplicitGrantRedirectError(error)) {
            const errorCode = error.details?.code
            if (
              errorCode === 'identity_already_exists' ||
              errorCode === 'identity_not_found' ||
              errorCode === 'single_identity_not_deletable'
            ) {
              return { error }
            }
          }

          // Don't remove existing session on URL login failure.
          // A failed attempt (e.g. reused magic link) shouldn't invalidate a valid session.

          return { error }
        }

        const { session, redirectType } = data

        this._debug(
          '#_initialize()',
          'detected session in URL',
          session,
          'redirect type',
          redirectType
        )

        await this._saveSession(session)

        setTimeout(async () => {
          if (redirectType === 'recovery') {
            await this._notifyAllSubscribers('PASSWORD_RECOVERY', session)
          } else {
            await this._notifyAllSubscribers('SIGNED_IN', session)
          }
        }, 0)

        return { error: null }
      }
      // no login attempt via callback url try to recover session from storage
      await this._recoverAndRefresh()
      return { error: null }
    } catch (error) {
      if (isAuthError(error)) {
        return this._returnResult({ error })
      }

      return this._returnResult({
        error: new AuthUnknownError('Unexpected error during initialization', error),
      })
    } finally {
      await this._handleVisibilityChange()
      this._debug('#_initialize()', 'end')
    }
  }

  /**
   * Creates a new anonymous user.
   *
   * @returns A session where the is_anonymous claim in the access token JWT set to true
   *
   * @category Auth
   *
   * @remarks
   * - Returns an anonymous user
   * - It is recommended to set up captcha for anonymous sign-ins to prevent abuse. You can pass in the captcha token in the `options` param.
   *
   * @example Create an anonymous user
   * ```js
   * const { data, error } = await supabase.auth.signInAnonymously({
   *   options: {
   *     captchaToken
   *   }
   * });
   * ```
   *
   * @exampleResponse Create an anonymous user
   * ```json
   * {
   *   "data": {
   *     "user": {
   *       "id": "11111111-1111-1111-1111-111111111111",
   *       "aud": "authenticated",
   *       "role": "authenticated",
   *       "email": "",
   *       "phone": "",
   *       "last_sign_in_at": "2024-01-01T00:00:00Z",
   *       "app_metadata": {},
   *       "user_metadata": {},
   *       "identities": [],
   *       "created_at": "2024-01-01T00:00:00Z",
   *       "updated_at": "2024-01-01T00:00:00Z",
   *       "is_anonymous": true
   *     },
   *     "session": {
   *       "access_token": "<ACCESS_TOKEN>",
   *       "token_type": "bearer",
   *       "expires_in": 3600,
   *       "expires_at": 1700000000,
   *       "refresh_token": "<REFRESH_TOKEN>",
   *       "user": {
   *         "id": "11111111-1111-1111-1111-111111111111",
   *         "aud": "authenticated",
   *         "role": "authenticated",
   *         "email": "",
   *         "phone": "",
   *         "last_sign_in_at": "2024-01-01T00:00:00Z",
   *         "app_metadata": {},
   *         "user_metadata": {},
   *         "identities": [],
   *         "created_at": "2024-01-01T00:00:00Z",
   *         "updated_at": "2024-01-01T00:00:00Z",
   *         "is_anonymous": true
   *       }
   *     }
   *   },
   *   "error": null
   * }
   * ```
   *
   * @example Create an anonymous user with custom user metadata
   * ```js
   * const { data, error } = await supabase.auth.signInAnonymously({
   *   options: {
   *     data
   *   }
   * })
   * ```
   */
  async signInAnonymously(credentials?: SignInAnonymouslyCredentials): Promise<AuthResponse> {
    try {
      const res = await _request(this.fetch, 'POST', `${this.url}/signup`, {
        headers: this.headers,
        body: {
          data: credentials?.options?.data ?? {},
          gotrue_meta_security: { captcha_token: credentials?.options?.captchaToken },
        },
        xform: _sessionResponse,
      })
      const { data, error } = res

      if (error || !data) {
        return this._returnResult({ data: { user: null, session: null }, error: error })
      }
      const session: Session | null = data.session
      const user: User | null = data.user

      if (data.session) {
        await this._saveSession(data.session)
        await this._notifyAllSubscribers('SIGNED_IN', session)
      }

      return this._returnResult({ data: { user, session }, error: null })
    } catch (error) {
      if (isAuthError(error)) {
        return this._returnResult({ data: { user: null, session: null }, error })
      }

      throw error
    }
  }

  /**
   * Creates a new user.
   *
   * Be aware that if a user account exists in the system you may get back an
   * error message that attempts to hide this information from the user.
   * This method has support for PKCE via email signups. The PKCE flow cannot be used when autoconfirm is enabled.
   *
   * @returns A logged-in session if the server has "autoconfirm" ON
   * @returns A user if the server has "autoconfirm" OFF
   *
   * @category Auth
   *
   * @remarks
   * - By default, the user needs to verify their email address before logging in. To turn this off, disable **Confirm email** in [your project](/dashboard/project/_/auth/providers).
   * - **Confirm email** determines if users need to confirm their email address after signing up.
   *   - If **Confirm email** is enabled, a `user` is returned but `session` is null.
   *   - If **Confirm email** is disabled, both a `user` and a `session` are returned.
   * - When the user confirms their email address, they are redirected to the [`SITE_URL`](/docs/guides/auth/redirect-urls#use-wildcards-in-redirect-urls) by default. You can modify your `SITE_URL` or add additional redirect URLs in [your project](/dashboard/project/_/auth/url-configuration).
   * - If signUp() is called for an existing confirmed user:
   *   - When both **Confirm email** and **Confirm phone** (even when phone provider is disabled) are enabled in [your project](/dashboard/project/_/auth/providers), an obfuscated/fake user object is returned.
   *   - When either **Confirm email** or **Confirm phone** (even when phone provider is disabled) is disabled, the error message, `User already registered` is returned.
   * - To fetch the currently logged-in user, refer to [`getUser()`](/docs/reference/javascript/auth-getuser).
   *
   * @example Sign up with an email and password
   * ```js
   * const { data, error } = await supabase.auth.signUp({
   *   email: 'example@email.com',
   *   password: 'example-password',
   * })
   * ```
   *
   * @exampleResponse Sign up with an email and password
   * ```json
   * // Some fields may be null if "confirm email" is enabled.
   * {
   *   "data": {
   *     "user": {
   *       "id": "11111111-1111-1111-1111-111111111111",
   *       "aud": "authenticated",
   *       "role": "authenticated",
   *       "email": "example@email.com",
   *       "email_confirmed_at": "2024-01-01T00:00:00Z",
   *       "phone": "",
   *       "last_sign_in_at": "2024-01-01T00:00:00Z",
   *       "app_metadata": {
   *         "provider": "email",
   *         "providers": [
   *           "email"
   *         ]
   *       },
   *       "user_metadata": {},
   *       "identities": [
   *         {
   *           "identity_id": "22222222-2222-2222-2222-222222222222",
   *           "id": "11111111-1111-1111-1111-111111111111",
   *           "user_id": "11111111-1111-1111-1111-111111111111",
   *           "identity_data": {
   *             "email": "example@email.com",
   *             "email_verified": false,
   *             "phone_verified": false,
   *             "sub": "11111111-1111-1111-1111-111111111111"
   *           },
   *           "provider": "email",
   *           "last_sign_in_at": "2024-01-01T00:00:00Z",
   *           "created_at": "2024-01-01T00:00:00Z",
   *           "updated_at": "2024-01-01T00:00:00Z",
   *           "email": "example@email.com"
   *         }
   *       ],
   *       "created_at": "2024-01-01T00:00:00Z",
   *       "updated_at": "2024-01-01T00:00:00Z"
   *     },
   *     "session": {
   *       "access_token": "<ACCESS_TOKEN>",
   *       "token_type": "bearer",
   *       "expires_in": 3600,
   *       "expires_at": 1700000000,
   *       "refresh_token": "<REFRESH_TOKEN>",
   *       "user": {
   *         "id": "11111111-1111-1111-1111-111111111111",
   *         "aud": "authenticated",
   *         "role": "authenticated",
   *         "email": "example@email.com",
   *         "email_confirmed_at": "2024-01-01T00:00:00Z",
   *         "phone": "",
   *         "last_sign_in_at": "2024-01-01T00:00:00Z",
   *         "app_metadata": {
   *           "provider": "email",
   *           "providers": [
   *             "email"
   *           ]
   *         },
   *         "user_metadata": {},
   *         "identities": [
   *           {
   *             "identity_id": "22222222-2222-2222-2222-222222222222",
   *             "id": "11111111-1111-1111-1111-111111111111",
   *             "user_id": "11111111-1111-1111-1111-111111111111",
   *             "identity_data": {
   *               "email": "example@email.com",
   *               "email_verified": false,
   *               "phone_verified": false,
   *               "sub": "11111111-1111-1111-1111-111111111111"
   *             },
   *             "provider": "email",
   *             "last_sign_in_at": "2024-01-01T00:00:00Z",
   *             "created_at": "2024-01-01T00:00:00Z",
   *             "updated_at": "2024-01-01T00:00:00Z",
   *             "email": "example@email.com"
   *           }
   *         ],
   *         "created_at": "2024-01-01T00:00:00Z",
   *         "updated_at": "2024-01-01T00:00:00Z"
   *       }
   *     }
   *   },
   *   "error": null
   * }
   * ```
   *
   * @example Sign up with a phone number and password (SMS)
   * ```js
   * const { data, error } = await supabase.auth.signUp({
   *   phone: '123456789',
   *   password: 'example-password',
   *   options: {
   *     channel: 'sms'
   *   }
   * })
   * ```
   *
   * @exampleDescription Sign up with a phone number and password (whatsapp)
   * The user will be sent a WhatsApp message which contains a OTP. By default, a given user can only request a OTP once every 60 seconds. Note that a user will need to have a valid WhatsApp account that is linked to Twilio in order to use this feature.
   *
   * @example Sign up with a phone number and password (whatsapp)
   * ```js
   * const { data, error } = await supabase.auth.signUp({
   *   phone: '123456789',
   *   password: 'example-password',
   *   options: {
   *     channel: 'whatsapp'
   *   }
   * })
   * ```
   *
   * @example Sign up with additional user metadata
   * ```js
   * const { data, error } = await supabase.auth.signUp(
   *   {
   *     email: 'example@email.com',
   *     password: 'example-password',
   *     options: {
   *       data: {
   *         first_name: 'John',
   *         age: 27,
   *       }
   *     }
   *   }
   * )
   * ```
   *
   * @exampleDescription Sign up with a redirect URL
   * - See [redirect URLs and wildcards](/docs/guides/auth/redirect-urls#use-wildcards-in-redirect-urls) to add additional redirect URLs to your project.
   *
   * @example Sign up with a redirect URL
   * ```js
   * const { data, error } = await supabase.auth.signUp(
   *   {
   *     email: 'example@email.com',
   *     password: 'example-password',
   *     options: {
   *       emailRedirectTo: 'https://example.com/welcome'
   *     }
   *   }
   * )
   * ```
   */
  async signUp(credentials: SignUpWithPasswordCredentials): Promise<AuthResponse> {
    try {
      let res: AuthResponse
      if ('email' in credentials) {
        const { email, password, options } = credentials
        let codeChallenge: string | null = null
        let codeChallengeMethod: string | null = null
        if (this.flowType === 'pkce') {
          ;[codeChallenge, codeChallengeMethod] = await getCodeChallengeAndMethod(
            this.storage,
            this.storageKey
          )
        }
        res = await _request(this.fetch, 'POST', `${this.url}/signup`, {
          headers: this.headers,
          redirectTo: options?.emailRedirectTo,
          body: {
            email,
            password,
            data: options?.data ?? {},
            gotrue_meta_security: { captcha_token: options?.captchaToken },
            code_challenge: codeChallenge,
            code_challenge_method: codeChallengeMethod,
          },
          xform: _sessionResponse,
        })
      } else if ('phone' in credentials) {
        const { phone, password, options } = credentials
        res = await _request(this.fetch, 'POST', `${this.url}/signup`, {
          headers: this.headers,
          body: {
            phone,
            password,
            data: options?.data ?? {},
            channel: options?.channel ?? 'sms',
            gotrue_meta_security: { captcha_token: options?.captchaToken },
          },
          xform: _sessionResponse,
        })
      } else {
        throw new AuthInvalidCredentialsError(
          'You must provide either an email or phone number and a password'
        )
      }

      const { data, error } = res

      if (error || !data) {
        await removeItemAsync(this.storage, `${this.storageKey}-code-verifier`)
        return this._returnResult({ data: { user: null, session: null }, error: error })
      }

      const session: Session | null = data.session
      const user: User | null = data.user

      if (data.session) {
        await this._saveSession(data.session)
        await this._notifyAllSubscribers('SIGNED_IN', session)
      }

      return this._returnResult({ data: { user, session }, error: null })
    } catch (error) {
      await removeItemAsync(this.storage, `${this.storageKey}-code-verifier`)
      if (isAuthError(error)) {
        return this._returnResult({ data: { user: null, session: null }, error })
      }

      throw error
    }
  }

  /**
   * Log in an existing user with an email and password or phone and password.
   *
   * Be aware that you may get back an error message that will not distinguish
   * between the cases where the account does not exist or that the
   * email/phone and password combination is wrong or that the account can only
   * be accessed via social login.
   *
   * @category Auth
   *
   * @remarks
   * - Requires either an email and password or a phone number and password.
   *
   * @example Sign in with email and password
   * ```js
   * const { data, error } = await supabase.auth.signInWithPassword({
   *   email: 'example@email.com',
   *   password: 'example-password',
   * })
   * ```
   *
   * @exampleResponse Sign in with email and password
   * ```json
   * {
   *   "data": {
   *     "user": {
   *       "id": "11111111-1111-1111-1111-111111111111",
   *       "aud": "authenticated",
   *       "role": "authenticated",
   *       "email": "example@email.com",
   *       "email_confirmed_at": "2024-01-01T00:00:00Z",
   *       "phone": "",
   *       "last_sign_in_at": "2024-01-01T00:00:00Z",
   *       "app_metadata": {
   *         "provider": "email",
   *         "providers": [
   *           "email"
   *         ]
   *       },
   *       "user_metadata": {},
   *       "identities": [
   *         {
   *           "identity_id": "22222222-2222-2222-2222-222222222222",
   *           "id": "11111111-1111-1111-1111-111111111111",
   *           "user_id": "11111111-1111-1111-1111-111111111111",
   *           "identity_data": {
   *             "email": "example@email.com",
   *             "email_verified": false,
   *             "phone_verified": false,
   *             "sub": "11111111-1111-1111-1111-111111111111"
   *           },
   *           "provider": "email",
   *           "last_sign_in_at": "2024-01-01T00:00:00Z",
   *           "created_at": "2024-01-01T00:00:00Z",
   *           "updated_at": "2024-01-01T00:00:00Z",
   *           "email": "example@email.com"
   *         }
   *       ],
   *       "created_at": "2024-01-01T00:00:00Z",
   *       "updated_at": "2024-01-01T00:00:00Z"
   *     },
   *     "session": {
   *       "access_token": "<ACCESS_TOKEN>",
   *       "token_type": "bearer",
   *       "expires_in": 3600,
   *       "expires_at": 1700000000,
   *       "refresh_token": "<REFRESH_TOKEN>",
   *       "user": {
   *         "id": "11111111-1111-1111-1111-111111111111",
   *         "aud": "authenticated",
   *         "role": "authenticated",
   *         "email": "example@email.com",
   *         "email_confirmed_at": "2024-01-01T00:00:00Z",
   *         "phone": "",
   *         "last_sign_in_at": "2024-01-01T00:00:00Z",
   *         "app_metadata": {
   *           "provider": "email",
   *           "providers": [
   *             "email"
   *           ]
   *         },
   *         "user_metadata": {},
   *         "identities": [
   *           {
   *             "identity_id": "22222222-2222-2222-2222-222222222222",
   *             "id": "11111111-1111-1111-1111-111111111111",
   *             "user_id": "11111111-1111-1111-1111-111111111111",
   *             "identity_data": {
   *               "email": "example@email.com",
   *               "email_verified": false,
   *               "phone_verified": false,
   *               "sub": "11111111-1111-1111-1111-111111111111"
   *             },
   *             "provider": "email",
   *             "last_sign_in_at": "2024-01-01T00:00:00Z",
   *             "created_at": "2024-01-01T00:00:00Z",
   *             "updated_at": "2024-01-01T00:00:00Z",
   *             "email": "example@email.com"
   *           }
   *         ],
   *         "created_at": "2024-01-01T00:00:00Z",
   *         "updated_at": "2024-01-01T00:00:00Z"
   *       }
   *     }
   *   },
   *   "error": null
   * }
   * ```
   *
   * @example Sign in with phone and password
   * ```js
   * const { data, error } = await supabase.auth.signInWithPassword({
   *   phone: '+13334445555',
   *   password: 'some-password',
   * })
   * ```
   */
  async signInWithPassword(
    credentials: SignInWithPasswordCredentials
  ): Promise<AuthTokenResponsePassword> {
    try {
      let res: AuthResponsePassword
      if ('email' in credentials) {
        const { email, password, options } = credentials
        res = await _request(this.fetch, 'POST', `${this.url}/token?grant_type=password`, {
          headers: this.headers,
          body: {
            email,
            password,
            gotrue_meta_security: { captcha_token: options?.captchaToken },
          },
          xform: _sessionResponsePassword,
        })
      } else if ('phone' in credentials) {
        const { phone, password, options } = credentials
        res = await _request(this.fetch, 'POST', `${this.url}/token?grant_type=password`, {
          headers: this.headers,
          body: {
            phone,
            password,
            gotrue_meta_security: { captcha_token: options?.captchaToken },
          },
          xform: _sessionResponsePassword,
        })
      } else {
        throw new AuthInvalidCredentialsError(
          'You must provide either an email or phone number and a password'
        )
      }
      const { data, error } = res

      if (error) {
        return this._returnResult({ data: { user: null, session: null }, error })
      } else if (!data || !data.session || !data.user) {
        const invalidTokenError = new AuthInvalidTokenResponseError()
        return this._returnResult({ data: { user: null, session: null }, error: invalidTokenError })
      }
      if (data.session) {
        await this._saveSession(data.session)
        await this._notifyAllSubscribers('SIGNED_IN', data.session)
      }
      return this._returnResult({
        data: {
          user: data.user,
          session: data.session,
          ...(data.weak_password ? { weakPassword: data.weak_password } : null),
        },
        error,
      })
    } catch (error) {
      if (isAuthError(error)) {
        return this._returnResult({ data: { user: null, session: null }, error })
      }
      throw error
    }
  }

  /**
   * Log in an existing user via a third-party provider.
   * This method supports the PKCE flow.
   *
   * @category Auth
   *
   * @remarks
   * - This method is used for signing in using [Social Login (OAuth) providers](/docs/guides/auth#configure-third-party-providers).
   * - It works by redirecting your application to the provider's authorization screen, before bringing back the user to your app.
   *
   * @example Sign in using a third-party provider
   * ```js
   * const { data, error } = await supabase.auth.signInWithOAuth({
   *   provider: 'github'
   * })
   * ```
   *
   * @exampleResponse Sign in using a third-party provider
   * ```json
   * {
   *   data: {
   *     provider: 'github',
   *     url: <PROVIDER_URL_TO_REDIRECT_TO>
   *   },
   *   error: null
   * }
   * ```
   *
   * @exampleDescription Sign in using a third-party provider with redirect
   * - When the OAuth provider successfully authenticates the user, they are redirected to the URL specified in the `redirectTo` parameter. This parameter defaults to the [`SITE_URL`](/docs/guides/auth/redirect-urls#use-wildcards-in-redirect-urls). It does not redirect the user immediately after invoking this method.
   * - See [redirect URLs and wildcards](/docs/guides/auth/redirect-urls#use-wildcards-in-redirect-urls) to add additional redirect URLs to your project.
   *
   * @example Sign in using a third-party provider with redirect
   * ```js
   * const { data, error } = await supabase.auth.signInWithOAuth({
   *   provider: 'github',
   *   options: {
   *     redirectTo: 'https://example.com/welcome'
   *   }
   * })
   * ```
   *
   * @exampleDescription Sign in with scopes and access provider tokens
   * If you need additional access from an OAuth provider, in order to access provider specific APIs in the name of the user, you can do this by passing in the scopes the user should authorize for your application. Note that the `scopes` option takes in **a space-separated list** of scopes.
   *
   * Because OAuth sign-in often includes redirects, you should register an `onAuthStateChange` callback immediately after you create the Supabase client. This callback will listen for the presence of `provider_token` and `provider_refresh_token` properties on the `session` object and store them in local storage. The client library will emit these values **only once** immediately after the user signs in. You can then access them by looking them up in local storage, or send them to your backend servers for further processing.
   *
   * Finally, make sure you remove them from local storage on the `SIGNED_OUT` event. If the OAuth provider supports token revocation, make sure you call those APIs either from the frontend or schedule them to be called on the backend.
   *
   * @example Sign in with scopes and access provider tokens
   * ```js
   * // Register this immediately after calling createClient!
   * // Because signInWithOAuth causes a redirect, you need to fetch the
   * // provider tokens from the callback.
   * supabase.auth.onAuthStateChange((event, session) => {
   *   if (session && session.provider_token) {
   *     window.localStorage.setItem('oauth_provider_token', session.provider_token)
   *   }
   *
   *   if (session && session.provider_refresh_token) {
   *     window.localStorage.setItem('oauth_provider_refresh_token', session.provider_refresh_token)
   *   }
   *
   *   if (event === 'SIGNED_OUT') {
   *     window.localStorage.removeItem('oauth_provider_token')
   *     window.localStorage.removeItem('oauth_provider_refresh_token')
   *   }
   * })
   *
   * // Call this on your Sign in with GitHub button to initiate OAuth
   * // with GitHub with the requested elevated scopes.
   * await supabase.auth.signInWithOAuth({
   *   provider: 'github',
   *   options: {
   *     scopes: 'repo gist notifications'
   *   }
   * })
   * ```
   */
  async signInWithOAuth(credentials: SignInWithOAuthCredentials): Promise<OAuthResponse> {
    return await this._handleProviderSignIn(credentials.provider, {
      redirectTo: credentials.options?.redirectTo,
      scopes: credentials.options?.scopes,
      queryParams: credentials.options?.queryParams,
      skipBrowserRedirect: credentials.options?.skipBrowserRedirect,
    })
  }

  /**
   * Log in an existing user by exchanging an Auth Code issued during the PKCE flow.
   *
   * @category Auth
   *
   * @remarks
   * - Used when `flowType` is set to `pkce` in client options.
   *
   * @example Exchange Auth Code
   * ```js
   * supabase.auth.exchangeCodeForSession('34e770dd-9ff9-416c-87fa-43b31d7ef225')
   * ```
   *
   * @exampleResponse Exchange Auth Code
   * ```json
   * {
   *   "data": {
   *     session: {
   *       access_token: '<ACCESS_TOKEN>',
   *       token_type: 'bearer',
   *       expires_in: 3600,
   *       expires_at: 1700000000,
   *       refresh_token: '<REFRESH_TOKEN>',
   *       user: {
   *         id: '11111111-1111-1111-1111-111111111111',
   *         aud: 'authenticated',
   *         role: 'authenticated',
   *         email: 'example@email.com'
   *         email_confirmed_at: '2024-01-01T00:00:00Z',
   *         phone: '',
   *         confirmation_sent_at: '2024-01-01T00:00:00Z',
   *         confirmed_at: '2024-01-01T00:00:00Z',
   *         last_sign_in_at: '2024-01-01T00:00:00Z',
   *         app_metadata: {
   *           "provider": "email",
   *           "providers": [
   *             "email",
   *             "<OTHER_PROVIDER>"
   *           ]
   *         },
   *         user_metadata: {
   *           email: 'email@email.com',
   *           email_verified: true,
   *           full_name: 'User Name',
   *           iss: '<ISS>',
   *           name: 'User Name',
   *           phone_verified: false,
   *           provider_id: '<PROVIDER_ID>',
   *           sub: '<SUB>'
   *         },
   *         identities: [
   *           {
   *             "identity_id": "22222222-2222-2222-2222-222222222222",
   *             "id": "11111111-1111-1111-1111-111111111111",
   *             "user_id": "11111111-1111-1111-1111-111111111111",
   *             "identity_data": {
   *               "email": "example@email.com",
   *               "email_verified": false,
   *               "phone_verified": false,
   *               "sub": "11111111-1111-1111-1111-111111111111"
   *             },
   *             "provider": "email",
   *             "last_sign_in_at": "2024-01-01T00:00:00Z",
   *             "created_at": "2024-01-01T00:00:00Z",
   *             "updated_at": "2024-01-01T00:00:00Z",
   *             "email": "email@example.com"
   *           },
   *           {
   *             "identity_id": "33333333-3333-3333-3333-333333333333",
   *             "id": "<ID>",
   *             "user_id": "<USER_ID>",
   *             "identity_data": {
   *               "email": "example@email.com",
   *               "email_verified": true,
   *               "full_name": "User Name",
   *               "iss": "<ISS>",
   *               "name": "User Name",
   *               "phone_verified": false,
   *               "provider_id": "<PROVIDER_ID>",
   *               "sub": "<SUB>"
   *             },
   *             "provider": "<PROVIDER>",
   *             "last_sign_in_at": "2024-01-01T00:00:00Z",
   *             "created_at": "2024-01-01T00:00:00Z",
   *             "updated_at": "2024-01-01T00:00:00Z",
   *             "email": "example@email.com"
   *           }
   *         ],
   *         created_at: '2024-01-01T00:00:00Z',
   *         updated_at: '2024-01-01T00:00:00Z',
   *         is_anonymous: false
   *       },
   *       provider_token: '<PROVIDER_TOKEN>',
   *       provider_refresh_token: '<PROVIDER_REFRESH_TOKEN>'
   *     },
   *     user: {
   *       id: '11111111-1111-1111-1111-111111111111',
   *       aud: 'authenticated',
   *       role: 'authenticated',
   *       email: 'example@email.com',
   *       email_confirmed_at: '2024-01-01T00:00:00Z',
   *       phone: '',
   *       confirmation_sent_at: '2024-01-01T00:00:00Z',
   *       confirmed_at: '2024-01-01T00:00:00Z',
   *       last_sign_in_at: '2024-01-01T00:00:00Z',
   *       app_metadata: {
   *         provider: 'email',
   *         providers: [
   *           "email",
   *           "<OTHER_PROVIDER>"
   *         ]
   *       },
   *       user_metadata: {
   *         email: 'email@email.com',
   *         email_verified: true,
   *         full_name: 'User Name',
   *         iss: '<ISS>',
   *         name: 'User Name',
   *         phone_verified: false,
   *         provider_id: '<PROVIDER_ID>',
   *         sub: '<SUB>'
   *       },
   *       identities: [
   *         {
   *           "identity_id": "22222222-2222-2222-2222-222222222222",
   *           "id": "11111111-1111-1111-1111-111111111111",
   *           "user_id": "11111111-1111-1111-1111-111111111111",
   *           "identity_data": {
   *             "email": "example@email.com",
   *             "email_verified": false,
   *             "phone_verified": false,
   *             "sub": "11111111-1111-1111-1111-111111111111"
   *           },
   *           "provider": "email",
   *           "last_sign_in_at": "2024-01-01T00:00:00Z",
   *           "created_at": "2024-01-01T00:00:00Z",
   *           "updated_at": "2024-01-01T00:00:00Z",
   *           "email": "email@example.com"
   *         },
   *         {
   *           "identity_id": "33333333-3333-3333-3333-333333333333",
   *           "id": "<ID>",
   *           "user_id": "<USER_ID>",
   *           "identity_data": {
   *             "email": "example@email.com",
   *             "email_verified": true,
   *             "full_name": "User Name",
   *             "iss": "<ISS>",
   *             "name": "User Name",
   *             "phone_verified": false,
   *             "provider_id": "<PROVIDER_ID>",
   *             "sub": "<SUB>"
   *           },
   *           "provider": "<PROVIDER>",
   *           "last_sign_in_at": "2024-01-01T00:00:00Z",
   *           "created_at": "2024-01-01T00:00:00Z",
   *           "updated_at": "2024-01-01T00:00:00Z",
   *           "email": "example@email.com"
   *         }
   *       ],
   *       created_at: '2024-01-01T00:00:00Z',
   *       updated_at: '2024-01-01T00:00:00Z',
   *       is_anonymous: false
   *     },
   *     redirectType: null
   *   },
   *   "error": null
   * }
   * ```
   */
  async exchangeCodeForSession(authCode: string): Promise<AuthTokenResponse> {
    await this.initializePromise

    return this._acquireLock(this.lockAcquireTimeout, async () => {
      return this._exchangeCodeForSession(authCode)
    })
  }

  /**
   * Signs in a user by verifying a message signed by the user's private key.
   * Supports Ethereum (via Sign-In-With-Ethereum) & Solana (Sign-In-With-Solana) standards,
   * both of which derive from the EIP-4361 standard
   * With slight variation on Solana's side.
   * @reference https://eips.ethereum.org/EIPS/eip-4361
   *
   * @category Auth
   *
   * @remarks
   * - Uses a Web3 (Ethereum, Solana) wallet to sign a user in.
   * - Read up on the [potential for abuse](/docs/guides/auth/auth-web3#potential-for-abuse) before using it.
   *
   * @example Sign in with Solana or Ethereum (Window API)
   * ```js
   *   // uses window.ethereum for the wallet
   *   const { data, error } = await supabase.auth.signInWithWeb3({
   *     chain: 'ethereum',
   *     statement: 'I accept the Terms of Service at https://example.com/tos'
   *   })
   *
   *   // uses window.solana for the wallet
   *   const { data, error } = await supabase.auth.signInWithWeb3({
   *     chain: 'solana',
   *     statement: 'I accept the Terms of Service at https://example.com/tos'
   *   })
   * ```
   *
   * @example Sign in with Ethereum (Message and Signature)
   * ```js
   *   const { data, error } = await supabase.auth.signInWithWeb3({
   *     chain: 'ethereum',
   *     message: '<sign in with ethereum message>',
   *     signature: '<hex of the ethereum signature over the message>',
   *   })
   * ```
   *
   * @example Sign in with Solana (Brave)
   * ```js
   *   const { data, error } = await supabase.auth.signInWithWeb3({
   *     chain: 'solana',
   *     statement: 'I accept the Terms of Service at https://example.com/tos',
   *     wallet: window.braveSolana
   *   })
   * ```
   *
   * @example Sign in with Solana (Wallet Adapter)
   * ```jsx
   *   function SignInButton() {
   *   const wallet = useWallet()
   *
   *   return (
   *     <>
   *       {wallet.connected ? (
   *         <button
   *           onClick={() => {
   *             supabase.auth.signInWithWeb3({
   *               chain: 'solana',
   *               statement: 'I accept the Terms of Service at https://example.com/tos',
   *               wallet,
   *             })
   *           }}
   *         >
   *           Sign in with Solana
   *         </button>
   *       ) : (
   *         <WalletMultiButton />
   *       )}
   *     </>
   *   )
   * }
   *
   * function App() {
   *   const endpoint = clusterApiUrl('devnet')
   *   const wallets = useMemo(() => [], [])
   *
   *   return (
   *     <ConnectionProvider endpoint={endpoint}>
   *       <WalletProvider wallets={wallets}>
   *         <WalletModalProvider>
   *           <SignInButton />
   *         </WalletModalProvider>
   *       </WalletProvider>
   *     </ConnectionProvider>
   *   )
   * }
   * ```
   */
  async signInWithWeb3(credentials: Web3Credentials): Promise<
    | {
        data: { session: Session; user: User }
        error: null
      }
    | { data: { session: null; user: null }; error: AuthError }
  > {
    const { chain } = credentials

    switch (chain) {
      case 'ethereum':
        return await this.signInWithEthereum(credentials)
      case 'solana':
        return await this.signInWithSolana(credentials)
      default:
        throw new Error(`@supabase/auth-js: Unsupported chain "${chain}"`)
    }
  }

  private async signInWithEthereum(
    credentials: EthereumWeb3Credentials
  ): Promise<
    | { data: { session: Session; user: User }; error: null }
    | { data: { session: null; user: null }; error: AuthError }
  > {
    // TODO: flatten type
    let message: string
    let signature: Hex

    if ('message' in credentials) {
      message = credentials.message
      signature = credentials.signature
    } else {
      const { chain, wallet, statement, options } = credentials

      let resolvedWallet: EthereumWallet

      if (!isBrowser()) {
        if (typeof wallet !== 'object' || !options?.url) {
          throw new Error(
            '@supabase/auth-js: Both wallet and url must be specified in non-browser environments.'
          )
        }

        resolvedWallet = wallet
      } else if (typeof wallet === 'object') {
        resolvedWallet = wallet
      } else {
        const windowAny = window as any

        if (
          'ethereum' in windowAny &&
          typeof windowAny.ethereum === 'object' &&
          'request' in windowAny.ethereum &&
          typeof windowAny.ethereum.request === 'function'
        ) {
          resolvedWallet = windowAny.ethereum
        } else {
          throw new Error(
            `@supabase/auth-js: No compatible Ethereum wallet interface on the window object (window.ethereum) detected. Make sure the user already has a wallet installed and connected for this app. Prefer passing the wallet interface object directly to signInWithWeb3({ chain: 'ethereum', wallet: resolvedUserWallet }) instead.`
          )
        }
      }

      const url = new URL(options?.url ?? window.location.href)

      const accounts = await resolvedWallet
        .request({
          method: 'eth_requestAccounts',
        })
        .then((accs) => accs as string[])
        .catch(() => {
          throw new Error(
            `@supabase/auth-js: Wallet method eth_requestAccounts is missing or invalid`
          )
        })

      if (!accounts || accounts.length === 0) {
        throw new Error(
          `@supabase/auth-js: No accounts available. Please ensure the wallet is connected.`
        )
      }

      const address = getAddress(accounts[0])

      let chainId = options?.signInWithEthereum?.chainId
      if (!chainId) {
        const chainIdHex = await resolvedWallet.request({
          method: 'eth_chainId',
        })
        chainId = fromHex(chainIdHex as Hex)
      }

      const siweMessage: SiweMessage = {
        domain: url.host,
        address: address,
        statement: statement,
        uri: url.href,
        version: '1',
        chainId: chainId,
        nonce: options?.signInWithEthereum?.nonce,
        issuedAt: options?.signInWithEthereum?.issuedAt ?? new Date(),
        expirationTime: options?.signInWithEthereum?.expirationTime,
        notBefore: options?.signInWithEthereum?.notBefore,
        requestId: options?.signInWithEthereum?.requestId,
        resources: options?.signInWithEthereum?.resources,
      }

      message = createSiweMessage(siweMessage)

      // Sign message
      signature = (await resolvedWallet.request({
        method: 'personal_sign',
        params: [toHex(message), address],
      })) as Hex
    }

    try {
      const { data, error } = await _request(
        this.fetch,
        'POST',
        `${this.url}/token?grant_type=web3`,
        {
          headers: this.headers,
          body: {
            chain: 'ethereum',
            message,
            signature,
            ...(credentials.options?.captchaToken
              ? { gotrue_meta_security: { captcha_token: credentials.options?.captchaToken } }
              : null),
          },
          xform: _sessionResponse,
        }
      )
      if (error) {
        throw error
      }
      if (!data || !data.session || !data.user) {
        const invalidTokenError = new AuthInvalidTokenResponseError()
        return this._returnResult({ data: { user: null, session: null }, error: invalidTokenError })
      }
      if (data.session) {
        await this._saveSession(data.session)
        await this._notifyAllSubscribers('SIGNED_IN', data.session)
      }
      return this._returnResult({ data: { ...data }, error })
    } catch (error) {
      if (isAuthError(error)) {
        return this._returnResult({ data: { user: null, session: null }, error })
      }

      throw error
    }
  }

  private async signInWithSolana(credentials: SolanaWeb3Credentials) {
    let message: string
    let signature: Uint8Array

    if ('message' in credentials) {
      message = credentials.message
      signature = credentials.signature
    } else {
      const { chain, wallet, statement, options } = credentials

      let resolvedWallet: SolanaWallet

      if (!isBrowser()) {
        if (typeof wallet !== 'object' || !options?.url) {
          throw new Error(
            '@supabase/auth-js: Both wallet and url must be specified in non-browser environments.'
          )
        }

        resolvedWallet = wallet
      } else if (typeof wallet === 'object') {
        resolvedWallet = wallet
      } else {
        const windowAny = window as any

        if (
          'solana' in windowAny &&
          typeof windowAny.solana === 'object' &&
          (('signIn' in windowAny.solana && typeof windowAny.solana.signIn === 'function') ||
            ('signMessage' in windowAny.solana &&
              typeof windowAny.solana.signMessage === 'function'))
        ) {
          resolvedWallet = windowAny.solana
        } else {
          throw new Error(
            `@supabase/auth-js: No compatible Solana wallet interface on the window object (window.solana) detected. Make sure the user already has a wallet installed and connected for this app. Prefer passing the wallet interface object directly to signInWithWeb3({ chain: 'solana', wallet: resolvedUserWallet }) instead.`
          )
        }
      }

      const url = new URL(options?.url ?? window.location.href)

      if ('signIn' in resolvedWallet && resolvedWallet.signIn) {
        const output = await resolvedWallet.signIn({
          issuedAt: new Date().toISOString(),

          ...options?.signInWithSolana,

          // non-overridable properties
          version: '1',
          domain: url.host,
          uri: url.href,

          ...(statement ? { statement } : null),
        })

        let outputToProcess: any

        if (Array.isArray(output) && output[0] && typeof output[0] === 'object') {
          outputToProcess = output[0]
        } else if (
          output &&
          typeof output === 'object' &&
          'signedMessage' in output &&
          'signature' in output
        ) {
          outputToProcess = output
        } else {
          throw new Error('@supabase/auth-js: Wallet method signIn() returned unrecognized value')
        }

        if (
          'signedMessage' in outputToProcess &&
          'signature' in outputToProcess &&
          (typeof outputToProcess.signedMessage === 'string' ||
            outputToProcess.signedMessage instanceof Uint8Array) &&
          outputToProcess.signature instanceof Uint8Array
        ) {
          message =
            typeof outputToProcess.signedMessage === 'string'
              ? outputToProcess.signedMessage
              : new TextDecoder().decode(outputToProcess.signedMessage)
          signature = outputToProcess.signature
        } else {
          throw new Error(
            '@supabase/auth-js: Wallet method signIn() API returned object without signedMessage and signature fields'
          )
        }
      } else {
        if (
          !('signMessage' in resolvedWallet) ||
          typeof resolvedWallet.signMessage !== 'function' ||
          !('publicKey' in resolvedWallet) ||
          typeof resolvedWallet !== 'object' ||
          !resolvedWallet.publicKey ||
          !('toBase58' in resolvedWallet.publicKey) ||
          typeof resolvedWallet.publicKey.toBase58 !== 'function'
        ) {
          throw new Error(
            '@supabase/auth-js: Wallet does not have a compatible signMessage() and publicKey.toBase58() API'
          )
        }

        message = [
          `${url.host} wants you to sign in with your Solana account:`,
          resolvedWallet.publicKey.toBase58(),
          ...(statement ? ['', statement, ''] : ['']),
          'Version: 1',
          `URI: ${url.href}`,
          `Issued At: ${options?.signInWithSolana?.issuedAt ?? new Date().toISOString()}`,
          ...(options?.signInWithSolana?.notBefore
            ? [`Not Before: ${options.signInWithSolana.notBefore}`]
            : []),
          ...(options?.signInWithSolana?.expirationTime
            ? [`Expiration Time: ${options.signInWithSolana.expirationTime}`]
            : []),
          ...(options?.signInWithSolana?.chainId
            ? [`Chain ID: ${options.signInWithSolana.chainId}`]
            : []),
          ...(options?.signInWithSolana?.nonce ? [`Nonce: ${options.signInWithSolana.nonce}`] : []),
          ...(options?.signInWithSolana?.requestId
            ? [`Request ID: ${options.signInWithSolana.requestId}`]
            : []),
          ...(options?.signInWithSolana?.resources?.length
            ? [
                'Resources',
                ...options.signInWithSolana.resources.map((resource) => `- ${resource}`),
              ]
            : []),
        ].join('\n')

        const maybeSignature = await resolvedWallet.signMessage(
          new TextEncoder().encode(message),
          'utf8'
        )

        if (!maybeSignature || !(maybeSignature instanceof Uint8Array)) {
          throw new Error(
            '@supabase/auth-js: Wallet signMessage() API returned an recognized value'
          )
        }

        signature = maybeSignature
      }
    }

    try {
      const { data, error } = await _request(
        this.fetch,
        'POST',
        `${this.url}/token?grant_type=web3`,
        {
          headers: this.headers,
          body: {
            chain: 'solana',
            message,
            signature: bytesToBase64URL(signature),

            ...(credentials.options?.captchaToken
              ? { gotrue_meta_security: { captcha_token: credentials.options?.captchaToken } }
              : null),
          },
          xform: _sessionResponse,
        }
      )
      if (error) {
        throw error
      }
      if (!data || !data.session || !data.user) {
        const invalidTokenError = new AuthInvalidTokenResponseError()
        return this._returnResult({ data: { user: null, session: null }, error: invalidTokenError })
      }
      if (data.session) {
        await this._saveSession(data.session)
        await this._notifyAllSubscribers('SIGNED_IN', data.session)
      }
      return this._returnResult({ data: { ...data }, error })
    } catch (error) {
      if (isAuthError(error)) {
        return this._returnResult({ data: { user: null, session: null }, error })
      }

      throw error
    }
  }

  private async _exchangeCodeForSession(authCode: string): Promise<
    | {
        data: { session: Session; user: User; redirectType: string | null }
        error: null
      }
    | { data: { session: null; user: null; redirectType: null }; error: AuthError }
  > {
    const storageItem = await getItemAsync(this.storage, `${this.storageKey}-code-verifier`)
    const [codeVerifier, redirectType] = ((storageItem ?? '') as string).split('/')

    try {
      if (!codeVerifier && this.flowType === 'pkce') {
        throw new AuthPKCECodeVerifierMissingError()
      }

      const { data, error } = await _request(
        this.fetch,
        'POST',
        `${this.url}/token?grant_type=pkce`,
        {
          headers: this.headers,
          body: {
            auth_code: authCode,
            code_verifier: codeVerifier,
          },
          xform: _sessionResponse,
        }
      )
      await removeItemAsync(this.storage, `${this.storageKey}-code-verifier`)
      if (error) {
        throw error
      }
      if (!data || !data.session || !data.user) {
        const invalidTokenError = new AuthInvalidTokenResponseError()
        return this._returnResult({
          data: { user: null, session: null, redirectType: null },
          error: invalidTokenError,
        })
      }
      if (data.session) {
        await this._saveSession(data.session)
        await this._notifyAllSubscribers(
          redirectType === 'recovery' ? 'PASSWORD_RECOVERY' : 'SIGNED_IN',
          data.session
        )
      }
      return this._returnResult({ data: { ...data, redirectType: redirectType ?? null }, error })
    } catch (error) {
      await removeItemAsync(this.storage, `${this.storageKey}-code-verifier`)
      if (isAuthError(error)) {
        return this._returnResult({
          data: { user: null, session: null, redirectType: null },
          error,
        })
      }
      throw error
    }
  }

  /**
   * Allows signing in with an OIDC ID token. The authentication provider used
   * should be enabled and configured.
   *
   * @category Auth
   *
   * @remarks
   * - Use an ID token to sign in.
   * - Especially useful when implementing sign in using native platform dialogs in mobile or desktop apps using Sign in with Apple or Sign in with Google on iOS and Android.
   * - You can also use Google's [One Tap](https://developers.google.com/identity/gsi/web/guides/display-google-one-tap) and [Automatic sign-in](https://developers.google.com/identity/gsi/web/guides/automatic-sign-in-sign-out) via this API.
   *
   * @example Sign In using ID Token
   * ```js
   * const { data, error } = await supabase.auth.signInWithIdToken({
   *   provider: 'google',
   *   token: 'your-id-token'
   * })
   * ```
   *
   * @exampleResponse Sign In using ID Token
   * ```json
   * {
   *   "data": {
   *     "user": {
   *       "id": "11111111-1111-1111-1111-111111111111",
   *       "aud": "authenticated",
   *       "role": "authenticated",
   *       "last_sign_in_at": "2024-01-01T00:00:00Z",
   *       "app_metadata": {
   *         ...
   *       },
   *       "user_metadata": {
   *         ...
   *       },
   *       "identities": [
   *         {
   *           "identity_id": "22222222-2222-2222-2222-222222222222",
   *           "provider": "google",
   *         }
   *       ],
   *       "created_at": "2024-01-01T00:00:00Z",
   *       "updated_at": "2024-01-01T00:00:00Z",
   *     },
   *     "session": {
   *       "access_token": "<ACCESS_TOKEN>",
   *       "token_type": "bearer",
   *       "expires_in": 3600,
   *       "expires_at": 1700000000,
   *       "refresh_token": "<REFRESH_TOKEN>",
   *       "user": {
   *         "id": "11111111-1111-1111-1111-111111111111",
   *         "aud": "authenticated",
   *         "role": "authenticated",
   *         "last_sign_in_at": "2024-01-01T00:00:00Z",
   *         "app_metadata": {
   *           ...
   *         },
   *         "user_metadata": {
   *           ...
   *         },
   *         "identities": [
   *           {
   *             "identity_id": "22222222-2222-2222-2222-222222222222",
   *             "provider": "google",
   *           }
   *         ],
   *         "created_at": "2024-01-01T00:00:00Z",
   *         "updated_at": "2024-01-01T00:00:00Z",
   *       }
   *     }
   *   },
   *   "error": null
   * }
   * ```
   */
  async signInWithIdToken(credentials: SignInWithIdTokenCredentials): Promise<AuthTokenResponse> {
    try {
      const { options, provider, token, access_token, nonce } = credentials

      const res = await _request(this.fetch, 'POST', `${this.url}/token?grant_type=id_token`, {
        headers: this.headers,
        body: {
          provider,
          id_token: token,
          access_token,
          nonce,
          gotrue_meta_security: { captcha_token: options?.captchaToken },
        },
        xform: _sessionResponse,
      })

      const { data, error } = res
      if (error) {
        return this._returnResult({ data: { user: null, session: null }, error })
      } else if (!data || !data.session || !data.user) {
        const invalidTokenError = new AuthInvalidTokenResponseError()
        return this._returnResult({ data: { user: null, session: null }, error: invalidTokenError })
      }
      if (data.session) {
        await this._saveSession(data.session)
        await this._notifyAllSubscribers('SIGNED_IN', data.session)
      }
      return this._returnResult({ data, error })
    } catch (error) {
      if (isAuthError(error)) {
        return this._returnResult({ data: { user: null, session: null }, error })
      }
      throw error
    }
  }

  /**
   * Log in a user using magiclink or a one-time password (OTP).
   *
   * If the `{{ .ConfirmationURL }}` variable is specified in the email template, a magiclink will be sent.
   * If the `{{ .Token }}` variable is specified in the email template, an OTP will be sent.
   * If you're using phone sign-ins, only an OTP will be sent. You won't be able to send a magiclink for phone sign-ins.
   *
   * Be aware that you may get back an error message that will not distinguish
   * between the cases where the account does not exist or, that the account
   * can only be accessed via social login.
   *
   * Do note that you will need to configure a Whatsapp sender on Twilio
   * if you are using phone sign in with the 'whatsapp' channel. The whatsapp
   * channel is not supported on other providers
   * at this time.
   * This method supports PKCE when an email is passed.
   *
   * @category Auth
   *
   * @remarks
   * - Requires either an email or phone number.
   * - This method is used for passwordless sign-ins where a OTP is sent to the user's email or phone number.
   * - If the user doesn't exist, `signInWithOtp()` will signup the user instead. To restrict this behavior, you can set `shouldCreateUser` in `SignInWithPasswordlessCredentials.options` to `false`.
   * - If you're using an email, you can configure whether you want the user to receive a magiclink or a OTP.
   * - If you're using phone, you can configure whether you want the user to receive a OTP.
   * - The magic link's destination URL is determined by the [`SITE_URL`](/docs/guides/auth/redirect-urls#use-wildcards-in-redirect-urls).
   * - See [redirect URLs and wildcards](/docs/guides/auth/redirect-urls#use-wildcards-in-redirect-urls) to add additional redirect URLs to your project.
   * - Magic links and OTPs share the same implementation. To send users a one-time code instead of a magic link, [modify the magic link email template](/dashboard/project/_/auth/templates) to include `{{ .Token }}` instead of `{{ .ConfirmationURL }}`.
   * - See our [Twilio Phone Auth Guide](/docs/guides/auth/phone-login?showSMSProvider=Twilio) for details about configuring WhatsApp sign in.
   *
   * @exampleDescription Sign in with email
   * The user will be sent an email which contains either a magiclink or a OTP or both. By default, a given user can only request a OTP once every 60 seconds.
   *
   * @example Sign in with email
   * ```js
   * const { data, error } = await supabase.auth.signInWithOtp({
   *   email: 'example@email.com',
   *   options: {
   *     emailRedirectTo: 'https://example.com/welcome'
   *   }
   * })
   * ```
   *
   * @exampleResponse Sign in with email
   * ```json
   * {
   *   "data": {
   *     "user": null,
   *     "session": null
   *   },
   *   "error": null
   * }
   * ```
   *
   * @exampleDescription Sign in with SMS OTP
   * The user will be sent a SMS which contains a OTP. By default, a given user can only request a OTP once every 60 seconds.
   *
   * @example Sign in with SMS OTP
   * ```js
   * const { data, error } = await supabase.auth.signInWithOtp({
   *   phone: '+13334445555',
   * })
   * ```
   *
   * @exampleDescription Sign in with WhatsApp OTP
   * The user will be sent a WhatsApp message which contains a OTP. By default, a given user can only request a OTP once every 60 seconds. Note that a user will need to have a valid WhatsApp account that is linked to Twilio in order to use this feature.
   *
   * @example Sign in with WhatsApp OTP
   * ```js
   * const { data, error } = await supabase.auth.signInWithOtp({
   *   phone: '+13334445555',
   *   options: {
   *     channel:'whatsapp',
   *   }
   * })
   * ```
   */
  async signInWithOtp(credentials: SignInWithPasswordlessCredentials): Promise<AuthOtpResponse> {
    try {
      if ('email' in credentials) {
        const { email, options } = credentials
        let codeChallenge: string | null = null
        let codeChallengeMethod: string | null = null
        if (this.flowType === 'pkce') {
          ;[codeChallenge, codeChallengeMethod] = await getCodeChallengeAndMethod(
            this.storage,
            this.storageKey
          )
        }
        const { error } = await _request(this.fetch, 'POST', `${this.url}/otp`, {
          headers: this.headers,
          body: {
            email,
            data: options?.data ?? {},
            create_user: options?.shouldCreateUser ?? true,
            gotrue_meta_security: { captcha_token: options?.captchaToken },
            code_challenge: codeChallenge,
            code_challenge_method: codeChallengeMethod,
          },
          redirectTo: options?.emailRedirectTo,
        })
        return this._returnResult({ data: { user: null, session: null }, error })
      }
      if ('phone' in credentials) {
        const { phone, options } = credentials
        const { data, error } = await _request(this.fetch, 'POST', `${this.url}/otp`, {
          headers: this.headers,
          body: {
            phone,
            data: options?.data ?? {},
            create_user: options?.shouldCreateUser ?? true,
            gotrue_meta_security: { captcha_token: options?.captchaToken },
            channel: options?.channel ?? 'sms',
          },
        })
        return this._returnResult({
          data: { user: null, session: null, messageId: data?.message_id },
          error,
        })
      }
      throw new AuthInvalidCredentialsError('You must provide either an email or phone number.')
    } catch (error) {
      await removeItemAsync(this.storage, `${this.storageKey}-code-verifier`)
      if (isAuthError(error)) {
        return this._returnResult({ data: { user: null, session: null }, error })
      }

      throw error
    }
  }

  /**
   * Log in a user given a User supplied OTP or TokenHash received through mobile or email.
   *
   * @category Auth
   *
   * @remarks
   * - The `verifyOtp` method takes in different verification types.
   * - If a phone number is used, the type can either be:
   *   1. `sms` – Used when verifying a one-time password (OTP) sent via SMS during sign-up or sign-in.
   *   2. `phone_change` – Used when verifying an OTP sent to a new phone number during a phone number update process.
   * - If an email address is used, the type can be one of the following (note: `signup` and `magiclink` types are deprecated):
   *   1. `email` – Used when verifying an OTP sent to the user's email during sign-up or sign-in.
   *   2. `recovery` – Used when verifying an OTP sent for account recovery, typically after a password reset request.
   *   3. `invite` – Used when verifying an OTP sent as part of an invitation to join a project or organization.
   *   4. `email_change` – Used when verifying an OTP sent to a new email address during an email update process.
   * - The verification type used should be determined based on the corresponding auth method called before `verifyOtp` to sign up / sign-in a user.
   * - The `TokenHash` is contained in the [email templates](/docs/guides/auth/auth-email-templates) and can be used to sign in.  You may wish to use the hash for the PKCE flow for Server Side Auth. Read [the Password-based Auth guide](/docs/guides/auth/passwords) for more details.
   *
   * @example Verify Signup One-Time Password (OTP)
   * ```js
   * const { data, error } = await supabase.auth.verifyOtp({ email, token, type: 'email'})
   * ```
   *
   * @exampleResponse Verify Signup One-Time Password (OTP)
   * ```json
   * {
   *   "data": {
   *     "user": {
   *       "id": "11111111-1111-1111-1111-111111111111",
   *       "aud": "authenticated",
   *       "role": "authenticated",
   *       "email": "example@email.com",
   *       "email_confirmed_at": "2024-01-01T00:00:00Z",
   *       "phone": "",
   *       "confirmed_at": "2024-01-01T00:00:00Z",
   *       "recovery_sent_at": "2024-01-01T00:00:00Z",
   *       "last_sign_in_at": "2024-01-01T00:00:00Z",
   *       "app_metadata": {
   *         "provider": "email",
   *         "providers": [
   *           "email"
   *         ]
   *       },
   *       "user_metadata": {
   *         "email": "example@email.com",
   *         "email_verified": false,
   *         "phone_verified": false,
   *         "sub": "11111111-1111-1111-1111-111111111111"
   *       },
   *       "identities": [
   *         {
   *           "identity_id": "22222222-2222-2222-2222-222222222222",
   *           "id": "11111111-1111-1111-1111-111111111111",
   *           "user_id": "11111111-1111-1111-1111-111111111111",
   *           "identity_data": {
   *             "email": "example@email.com",
   *             "email_verified": false,
   *             "phone_verified": false,
   *             "sub": "11111111-1111-1111-1111-111111111111"
   *           },
   *           "provider": "email",
   *           "last_sign_in_at": "2024-01-01T00:00:00Z",
   *           "created_at": "2024-01-01T00:00:00Z",
   *           "updated_at": "2024-01-01T00:00:00Z",
   *           "email": "example@email.com"
   *         }
   *       ],
   *       "created_at": "2024-01-01T00:00:00Z",
   *       "updated_at": "2024-01-01T00:00:00Z",
   *       "is_anonymous": false
   *     },
   *     "session": {
   *       "access_token": "<ACCESS_TOKEN>",
   *       "token_type": "bearer",
   *       "expires_in": 3600,
   *       "expires_at": 1700000000,
   *       "refresh_token": "<REFRESH_TOKEN>",
   *       "user": {
   *         "id": "11111111-1111-1111-1111-111111111111",
   *         "aud": "authenticated",
   *         "role": "authenticated",
   *         "email": "example@email.com",
   *         "email_confirmed_at": "2024-01-01T00:00:00Z",
   *         "phone": "",
   *         "confirmed_at": "2024-01-01T00:00:00Z",
   *         "recovery_sent_at": "2024-01-01T00:00:00Z",
   *         "last_sign_in_at": "2024-01-01T00:00:00Z",
   *         "app_metadata": {
   *           "provider": "email",
   *           "providers": [
   *             "email"
   *           ]
   *         },
   *         "user_metadata": {
   *           "email": "example@email.com",
   *           "email_verified": false,
   *           "phone_verified": false,
   *           "sub": "11111111-1111-1111-1111-111111111111"
   *         },
   *         "identities": [
   *           {
   *             "identity_id": "22222222-2222-2222-2222-222222222222",
   *             "id": "11111111-1111-1111-1111-111111111111",
   *             "user_id": "11111111-1111-1111-1111-111111111111",
   *             "identity_data": {
   *               "email": "example@email.com",
   *               "email_verified": false,
   *               "phone_verified": false,
   *               "sub": "11111111-1111-1111-1111-111111111111"
   *             },
   *             "provider": "email",
   *             "last_sign_in_at": "2024-01-01T00:00:00Z",
   *             "created_at": "2024-01-01T00:00:00Z",
   *             "updated_at": "2024-01-01T00:00:00Z",
   *             "email": "example@email.com"
   *           }
   *         ],
   *         "created_at": "2024-01-01T00:00:00Z",
   *         "updated_at": "2024-01-01T00:00:00Z",
   *         "is_anonymous": false
   *       }
   *     }
   *   },
   *   "error": null
   * }
   * ```
   *
   * @example Verify SMS One-Time Password (OTP)
   * ```js
   * const { data, error } = await supabase.auth.verifyOtp({ phone, token, type: 'sms'})
   * ```
   *
   * @example Verify Email Auth (Token Hash)
   * ```js
   * const { data, error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: 'email'})
   * ```
   */
  async verifyOtp(params: VerifyOtpParams): Promise<AuthResponse> {
    try {
      let redirectTo: string | undefined = undefined
      let captchaToken: string | undefined = undefined
      if ('options' in params) {
        redirectTo = params.options?.redirectTo
        captchaToken = params.options?.captchaToken
      }
      const { data, error } = await _request(this.fetch, 'POST', `${this.url}/verify`, {
        headers: this.headers,
        body: {
          ...params,
          gotrue_meta_security: { captcha_token: captchaToken },
        },
        redirectTo,
        xform: _sessionResponse,
      })

      if (error) {
        throw error
      }
      if (!data) {
        const tokenVerificationError = new Error('An error occurred on token verification.')
        throw tokenVerificationError
      }

      const session: Session | null = data.session
      const user: User = data.user

      if (session?.access_token) {
        await this._saveSession(session as Session)
        await this._notifyAllSubscribers(
          params.type == 'recovery' ? 'PASSWORD_RECOVERY' : 'SIGNED_IN',
          session
        )
      }

      return this._returnResult({ data: { user, session }, error: null })
    } catch (error) {
      if (isAuthError(error)) {
        return this._returnResult({ data: { user: null, session: null }, error })
      }

      throw error
    }
  }

  /**
   * Attempts a single-sign on using an enterprise Identity Provider. A
   * successful SSO attempt will redirect the current page to the identity
   * provider authorization page. The redirect URL is implementation and SSO
   * protocol specific.
   *
   * You can use it by providing a SSO domain. Typically you can extract this
   * domain by asking users for their email address. If this domain is
   * registered on the Auth instance the redirect will use that organization's
   * currently active SSO Identity Provider for the login.
   *
   * If you have built an organization-specific login page, you can use the
   * organization's SSO Identity Provider UUID directly instead.
   *
   * @category Auth
   *
   * @remarks
   * - Before you can call this method you need to [establish a connection](/docs/guides/auth/sso/auth-sso-saml#managing-saml-20-connections) to an identity provider. Use the [CLI commands](/docs/reference/cli/supabase-sso) to do this.
   * - If you've associated an email domain to the identity provider, you can use the `domain` property to start a sign-in flow.
   * - In case you need to use a different way to start the authentication flow with an identity provider, you can use the `providerId` property. For example:
   *     - Mapping specific user email addresses with an identity provider.
   *     - Using different hints to identity the identity provider to be used by the user, like a company-specific page, IP address or other tracking information.
   *
   * @example Sign in with email domain
   * ```js
   *   // You can extract the user's email domain and use it to trigger the
   *   // authentication flow with the correct identity provider.
   *
   *   const { data, error } = await supabase.auth.signInWithSSO({
   *     domain: 'company.com'
   *   })
   *
   *   if (data?.url) {
   *     // redirect the user to the identity provider's authentication flow
   *     window.location.href = data.url
   *   }
   * ```
   *
   * @example Sign in with provider UUID
   * ```js
   *   // Useful when you need to map a user's sign in request according
   *   // to different rules that can't use email domains.
   *
   *   const { data, error } = await supabase.auth.signInWithSSO({
   *     providerId: '21648a9d-8d5a-4555-a9d1-d6375dc14e92'
   *   })
   *
   *   if (data?.url) {
   *     // redirect the user to the identity provider's authentication flow
   *     window.location.href = data.url
   *   }
   * ```
   */
  async signInWithSSO(params: SignInWithSSO): Promise<SSOResponse> {
    try {
      let codeChallenge: string | null = null
      let codeChallengeMethod: string | null = null
      if (this.flowType === 'pkce') {
        ;[codeChallenge, codeChallengeMethod] = await getCodeChallengeAndMethod(
          this.storage,
          this.storageKey
        )
      }

      const result = await _request(this.fetch, 'POST', `${this.url}/sso`, {
        body: {
          ...('providerId' in params ? { provider_id: params.providerId } : null),
          ...('domain' in params ? { domain: params.domain } : null),
          redirect_to: params.options?.redirectTo ?? undefined,
          ...(params?.options?.captchaToken
            ? { gotrue_meta_security: { captcha_token: params.options.captchaToken } }
            : null),
          skip_http_redirect: true, // fetch does not handle redirects
          code_challenge: codeChallenge,
          code_challenge_method: codeChallengeMethod,
        },
        headers: this.headers,
        xform: _ssoResponse,
      })

      // Automatically redirect in browser unless skipBrowserRedirect is true
      if (result.data?.url && isBrowser() && !params.options?.skipBrowserRedirect) {
        window.location.assign(result.data.url)
      }

      return this._returnResult(result)
    } catch (error) {
      await removeItemAsync(this.storage, `${this.storageKey}-code-verifier`)
      if (isAuthError(error)) {
        return this._returnResult({ data: null, error })
      }
      throw error
    }
  }

  /**
   * Sends a reauthentication OTP to the user's email or phone number.
   * Requires the user to be signed-in.
   *
   * @category Auth
   *
   * @remarks
   * - This method is used together with `updateUser()` when a user's password needs to be updated.
   * - If you require your user to reauthenticate before updating their password, you need to enable the **Secure password change** option in your [project's email provider settings](/dashboard/project/_/auth/providers).
   * - A user is only require to reauthenticate before updating their password if **Secure password change** is enabled and the user **hasn't recently signed in**. A user is deemed recently signed in if the session was created in the last 24 hours.
   * - This method will send a nonce to the user's email. If the user doesn't have a confirmed email address, the method will send the nonce to the user's confirmed phone number instead.
   * - After receiving the OTP, include it as the `nonce` in your `updateUser()` call to finalize the password change.
   *
   * @exampleDescription Send reauthentication nonce
   * Sends a reauthentication nonce to the user's email or phone number.
   *
   * @example Send reauthentication nonce
   * ```js
   * const { error } = await supabase.auth.reauthenticate()
   * ```
   */
  async reauthenticate(): Promise<AuthResponse> {
    await this.initializePromise

    return await this._acquireLock(this.lockAcquireTimeout, async () => {
      return await this._reauthenticate()
    })
  }

  private async _reauthenticate(): Promise<AuthResponse> {
    try {
      return await this._useSession(async (result) => {
        const {
          data: { session },
          error: sessionError,
        } = result
        if (sessionError) throw sessionError
        if (!session) throw new AuthSessionMissingError()

        const { error } = await _request(this.fetch, 'GET', `${this.url}/reauthenticate`, {
          headers: this.headers,
          jwt: session.access_token,
        })
        return this._returnResult({ data: { user: null, session: null }, error })
      })
    } catch (error) {
      if (isAuthError(error)) {
        return this._returnResult({ data: { user: null, session: null }, error })
      }
      throw error
    }
  }

  /**
   * Resends an existing signup confirmation email, email change email, SMS OTP or phone change OTP.
   *
   * @category Auth
   *
   * @remarks
   * - Resends a signup confirmation, email change or phone change email to the user.
   * - Passwordless sign-ins can be resent by calling the `signInWithOtp()` method again.
   * - Password recovery emails can be resent by calling the `resetPasswordForEmail()` method again.
   * - This method will only resend an email or phone OTP to the user if there was an initial signup, email change or phone change request being made(note: For existing users signing in with OTP, you should use `signInWithOtp()` again to resend the OTP).
   * - You can specify a redirect url when you resend an email link using the `emailRedirectTo` option.
   *
   * @exampleDescription Resend an email signup confirmation
   * Resends the email signup confirmation to the user
   *
   * @example Resend an email signup confirmation
   * ```js
   * const { error } = await supabase.auth.resend({
   *   type: 'signup',
   *   email: 'email@example.com',
   *   options: {
   *     emailRedirectTo: 'https://example.com/welcome'
   *   }
   * })
   * ```
   *
   * @exampleDescription Resend a phone signup confirmation
   * Resends the phone signup confirmation email to the user
   *
   * @example Resend a phone signup confirmation
   * ```js
   * const { error } = await supabase.auth.resend({
   *   type: 'sms',
   *   phone: '1234567890'
   * })
   * ```
   *
   * @exampleDescription Resend email change email
   * Resends the email change email to the user
   *
   * @example Resend email change email
   * ```js
   * const { error } = await supabase.auth.resend({
   *   type: 'email_change',
   *   email: 'email@example.com'
   * })
   * ```
   *
   * @exampleDescription Resend phone change OTP
   * Resends the phone change OTP to the user
   *
   * @example Resend phone change OTP
   * ```js
   * const { error } = await supabase.auth.resend({
   *   type: 'phone_change',
   *   phone: '1234567890'
   * })
   * ```
   */
  async resend(credentials: ResendParams): Promise<AuthOtpResponse> {
    try {
      const endpoint = `${this.url}/resend`
      if ('email' in credentials) {
        const { email, type, options } = credentials
        const { error } = await _request(this.fetch, 'POST', endpoint, {
          headers: this.headers,
          body: {
            email,
            type,
            gotrue_meta_security: { captcha_token: options?.captchaToken },
          },
          redirectTo: options?.emailRedirectTo,
        })
        return this._returnResult({ data: { user: null, session: null }, error })
      } else if ('phone' in credentials) {
        const { phone, type, options } = credentials
        const { data, error } = await _request(this.fetch, 'POST', endpoint, {
          headers: this.headers,
          body: {
            phone,
            type,
            gotrue_meta_security: { captcha_token: options?.captchaToken },
          },
        })
        return this._returnResult({
          data: { user: null, session: null, messageId: data?.message_id },
          error,
        })
      }
      throw new AuthInvalidCredentialsError(
        'You must provide either an email or phone number and a type'
      )
    } catch (error) {
      if (isAuthError(error)) {
        return this._returnResult({ data: { user: null, session: null }, error })
      }
      throw error
    }
  }

  /**
   * Returns the session, refreshing it if necessary.
   *
   * The session returned can be null if the session is not detected which can happen in the event a user is not signed-in or has logged out.
   *
   * **IMPORTANT:** This method loads values directly from the storage attached
   * to the client. If that storage is based on request cookies for example,
   * the values in it may not be authentic and therefore it's strongly advised
   * against using this method and its results in such circumstances. A warning
   * will be emitted if this is detected. Use {@link #getUser()} instead.
   *
   * @category Auth
   *
   * @remarks
   * - Since the introduction of [asymmetric JWT signing keys](/docs/guides/auth/signing-keys), this method is considered low-level and we encourage you to use `getClaims()` or `getUser()` instead.
   * - Retrieves the current [user session](/docs/guides/auth/sessions) from the storage medium (local storage, cookies).
   * - The session contains an access token (signed JWT), a refresh token and the user object.
   * - If the session's access token is expired or is about to expire, this method will use the refresh token to refresh the session.
   * - When using in a browser, or you've called `startAutoRefresh()` in your environment (React Native, etc.) this function always returns a valid access token without refreshing the session itself, as this is done in the background. This function returns very fast.
   * - **IMPORTANT SECURITY NOTICE:** If using an insecure storage medium, such as cookies or request headers, the user object returned by this function **must not be trusted**. Always verify the JWT using `getClaims()` or your own JWT verification library to securely establish the user's identity and access. You can also use `getUser()` to fetch the user object directly from the Auth server for this purpose.
   * - When using in a browser, this function is synchronized across all tabs using the [LockManager](https://developer.mozilla.org/en-US/docs/Web/API/LockManager) API. In other environments make sure you've defined a proper `lock` property, if necessary, to make sure there are no race conditions while the session is being refreshed.
   *
   * @example Get the session data
   * ```js
   * const { data, error } = await supabase.auth.getSession()
   * ```
   *
   * @exampleResponse Get the session data
   * ```json
   * {
   *   "data": {
   *     "session": {
   *       "access_token": "<ACCESS_TOKEN>",
   *       "token_type": "bearer",
   *       "expires_in": 3600,
   *       "expires_at": 1700000000,
   *       "refresh_token": "<REFRESH_TOKEN>",
   *       "user": {
   *         "id": "11111111-1111-1111-1111-111111111111",
   *         "aud": "authenticated",
   *         "role": "authenticated",
   *         "email": "example@email.com",
   *         "email_confirmed_at": "2024-01-01T00:00:00Z",
   *         "phone": "",
   *         "last_sign_in_at": "2024-01-01T00:00:00Z",
   *         "app_metadata": {
   *           "provider": "email",
   *           "providers": [
   *             "email"
   *           ]
   *         },
   *         "user_metadata": {
   *           "email": "example@email.com",
   *           "email_verified": false,
   *           "phone_verified": false,
   *           "sub": "11111111-1111-1111-1111-111111111111"
   *         },
   *         "identities": [
   *           {
   *             "identity_id": "22222222-2222-2222-2222-222222222222",
   *             "id": "11111111-1111-1111-1111-111111111111",
   *             "user_id": "11111111-1111-1111-1111-111111111111",
   *             "identity_data": {
   *               "email": "example@email.com",
   *               "email_verified": false,
   *               "phone_verified": false,
   *               "sub": "11111111-1111-1111-1111-111111111111"
   *             },
   *             "provider": "email",
   *             "last_sign_in_at": "2024-01-01T00:00:00Z",
   *             "created_at": "2024-01-01T00:00:00Z",
   *             "updated_at": "2024-01-01T00:00:00Z",
   *             "email": "example@email.com"
   *           }
   *         ],
   *         "created_at": "2024-01-01T00:00:00Z",
   *         "updated_at": "2024-01-01T00:00:00Z",
   *         "is_anonymous": false
   *       }
   *     }
   *   },
   *   "error": null
   * }
   * ```
   */
  async getSession() {
    await this.initializePromise

    const result = await this._acquireLock(this.lockAcquireTimeout, async () => {
      return this._useSession(async (result) => {
        return result
      })
    })

    return result
  }

  /**
   * Acquires a global lock based on the storage key.
   */
  private async _acquireLock<R>(acquireTimeout: number, fn: () => Promise<R>): Promise<R> {
    this._debug('#_acquireLock', 'begin', acquireTimeout)

    try {
      if (this.lockAcquired) {
        const last = this.pendingInLock.length
          ? this.pendingInLock[this.pendingInLock.length - 1]
          : Promise.resolve()

        const result = (async () => {
          await last
          return await fn()
        })()

        this.pendingInLock.push(
          (async () => {
            try {
              await result
            } catch (e: any) {
              // we just care if it finished
            }
          })()
        )

        return result
      }

      return await this.lock(`lock:${this.storageKey}`, acquireTimeout, async () => {
        this._debug('#_acquireLock', 'lock acquired for storage key', this.storageKey)

        try {
          this.lockAcquired = true

          const result = fn()

          this.pendingInLock.push(
            (async () => {
              try {
                await result
              } catch (e: any) {
                // we just care if it finished
              }
            })()
          )

          await result

          // keep draining the queue until there's nothing to wait on
          while (this.pendingInLock.length) {
            const waitOn = [...this.pendingInLock]

            await Promise.all(waitOn)

            this.pendingInLock.splice(0, waitOn.length)
          }

          return await result
        } finally {
          this._debug('#_acquireLock', 'lock released for storage key', this.storageKey)

          this.lockAcquired = false
        }
      })
    } finally {
      this._debug('#_acquireLock', 'end')
    }
  }

  /**
   * Use instead of {@link #getSession} inside the library. It is
   * semantically usually what you want, as getting a session involves some
   * processing afterwards that requires only one client operating on the
   * session at once across multiple tabs or processes.
   */
  private async _useSession<R>(
    fn: (
      result:
        | {
            data: {
              session: Session
            }
            error: null
          }
        | {
            data: {
              session: null
            }
            error: AuthError
          }
        | {
            data: {
              session: null
            }
            error: null
          }
    ) => Promise<R>
  ): Promise<R> {
    this._debug('#_useSession', 'begin')

    try {
      // the use of __loadSession here is the only correct use of the function!
      const result = await this.__loadSession()

      return await fn(result)
    } finally {
      this._debug('#_useSession', 'end')
    }
  }

  /**
   * NEVER USE DIRECTLY!
   *
   * Always use {@link #_useSession}.
   */
  private async __loadSession(): Promise<
    | {
        data: {
          session: Session
        }
        error: null
      }
    | {
        data: {
          session: null
        }
        error: AuthError
      }
    | {
        data: {
          session: null
        }
        error: null
      }
  > {
    this._debug('#__loadSession()', 'begin')

    if (!this.lockAcquired) {
      this._debug('#__loadSession()', 'used outside of an acquired lock!', new Error().stack)
    }

    try {
      let currentSession: Session | null = null

      const maybeSession = await getItemAsync(this.storage, this.storageKey)

      this._debug('#getSession()', 'session from storage', maybeSession)

      if (maybeSession !== null) {
        if (this._isValidSession(maybeSession)) {
          currentSession = maybeSession
        } else {
          this._debug('#getSession()', 'session from storage is not valid')
          await this._removeSession()
        }
      }

      if (!currentSession) {
        return { data: { session: null }, error: null }
      }

      // A session is considered expired before the access token _actually_
      // expires. When the autoRefreshToken option is off (or when the tab is
      // in the background), very eager users of getSession() -- like
      // realtime-js -- might send a valid JWT which will expire by the time it
      // reaches the server.
      const hasExpired = currentSession.expires_at
        ? currentSession.expires_at * 1000 - Date.now() < EXPIRY_MARGIN_MS
        : false

      this._debug(
        '#__loadSession()',
        `session has${hasExpired ? '' : ' not'} expired`,
        'expires_at',
        currentSession.expires_at
      )

      if (!hasExpired) {
        if (this.userStorage) {
          const maybeUser: { user?: User | null } | null = (await getItemAsync(
            this.userStorage,
            this.storageKey + '-user'
          )) as any

          if (maybeUser?.user) {
            currentSession.user = maybeUser.user
          } else {
            currentSession.user = userNotAvailableProxy()
          }
        }

        // Wrap the user object with a warning proxy on the server
        // This warns when properties of the user are accessed, not when session.user itself is accessed
        if (
          this.storage.isServer &&
          currentSession.user &&
          !(currentSession.user as any).__isUserNotAvailableProxy
        ) {
          const suppressWarningRef = { value: this.suppressGetSessionWarning }
          currentSession.user = insecureUserWarningProxy(currentSession.user, suppressWarningRef)

          // Update the client-level suppression flag when the proxy suppresses the warning
          if (suppressWarningRef.value) {
            this.suppressGetSessionWarning = true
          }
        }

        return { data: { session: currentSession }, error: null }
      }

      const { data: session, error } = await this._callRefreshToken(currentSession.refresh_token)
      if (error) {
        return this._returnResult({ data: { session: null }, error })
      }

      return this._returnResult({ data: { session }, error: null })
    } finally {
      this._debug('#__loadSession()', 'end')
    }
  }

  /**
   * Gets the current user details if there is an existing session. This method
   * performs a network request to the Supabase Auth server, so the returned
   * value is authentic and can be used to base authorization rules on.
   *
   * @param jwt Takes in an optional access token JWT. If no JWT is provided, the JWT from the current session is used.
   *
   * @category Auth
   *
   * @remarks
   * - This method fetches the user object from the database instead of local session.
   * - This method is useful for checking if the user is authorized because it validates the user's access token JWT on the server.
   * - Should always be used when checking for user authorization on the server. On the client, you can instead use `getSession().session.user` for faster results. `getSession` is insecure on the server.
   *
   * @example Get the logged in user with the current existing session
   * ```js
   * const { data: { user } } = await supabase.auth.getUser()
   * ```
   *
   * @exampleResponse Get the logged in user with the current existing session
   * ```json
   * {
   *   "data": {
   *     "user": {
   *       "id": "11111111-1111-1111-1111-111111111111",
   *       "aud": "authenticated",
   *       "role": "authenticated",
   *       "email": "example@email.com",
   *       "email_confirmed_at": "2024-01-01T00:00:00Z",
   *       "phone": "",
   *       "confirmed_at": "2024-01-01T00:00:00Z",
   *       "last_sign_in_at": "2024-01-01T00:00:00Z",
   *       "app_metadata": {
   *         "provider": "email",
   *         "providers": [
   *           "email"
   *         ]
   *       },
   *       "user_metadata": {
   *         "email": "example@email.com",
   *         "email_verified": false,
   *         "phone_verified": false,
   *         "sub": "11111111-1111-1111-1111-111111111111"
   *       },
   *       "identities": [
   *         {
   *           "identity_id": "22222222-2222-2222-2222-222222222222",
   *           "id": "11111111-1111-1111-1111-111111111111",
   *           "user_id": "11111111-1111-1111-1111-111111111111",
   *           "identity_data": {
   *             "email": "example@email.com",
   *             "email_verified": false,
   *             "phone_verified": false,
   *             "sub": "11111111-1111-1111-1111-111111111111"
   *           },
   *           "provider": "email",
   *           "last_sign_in_at": "2024-01-01T00:00:00Z",
   *           "created_at": "2024-01-01T00:00:00Z",
   *           "updated_at": "2024-01-01T00:00:00Z",
   *           "email": "example@email.com"
   *         }
   *       ],
   *       "created_at": "2024-01-01T00:00:00Z",
   *       "updated_at": "2024-01-01T00:00:00Z",
   *       "is_anonymous": false
   *     }
   *   },
   *   "error": null
   * }
   * ```
   *
   * @example Get the logged in user with a custom access token jwt
   * ```js
   * const { data: { user } } = await supabase.auth.getUser(jwt)
   * ```
   */
  async getUser(jwt?: string): Promise<UserResponse> {
    if (jwt) {
      return await this._getUser(jwt)
    }

    await this.initializePromise

    const result = await this._acquireLock(this.lockAcquireTimeout, async () => {
      return await this._getUser()
    })

    if (result.data.user) {
      this.suppressGetSessionWarning = true
    }

    return result
  }

  private async _getUser(jwt?: string): Promise<UserResponse> {
    try {
      if (jwt) {
        return await _request(this.fetch, 'GET', `${this.url}/user`, {
          headers: this.headers,
          jwt: jwt,
          xform: _userResponse,
        })
      }

      return await this._useSession(async (result) => {
        const { data, error } = result
        if (error) {
          throw error
        }

        // returns an error if there is no access_token or custom authorization header
        if (!data.session?.access_token && !this.hasCustomAuthorizationHeader) {
          return { data: { user: null }, error: new AuthSessionMissingError() }
        }

        return await _request(this.fetch, 'GET', `${this.url}/user`, {
          headers: this.headers,
          jwt: data.session?.access_token ?? undefined,
          xform: _userResponse,
        })
      })
    } catch (error) {
      if (isAuthError(error)) {
        if (isAuthSessionMissingError(error)) {
          // JWT contains a `session_id` which does not correspond to an active
          // session in the database, indicating the user is signed out.

          await this._removeSession()
          await removeItemAsync(this.storage, `${this.storageKey}-code-verifier`)
        }

        return this._returnResult({ data: { user: null }, error })
      }

      throw error
    }
  }

  /**
   * Updates user data for a logged in user.
   *
   * @category Auth
   *
   * @remarks
   * - In order to use the `updateUser()` method, the user needs to be signed in first.
   * - By default, email updates sends a confirmation link to both the user's current and new email.
   * To only send a confirmation link to the user's new email, disable **Secure email change** in your project's [email auth provider settings](/dashboard/project/_/auth/providers).
   *
   * @exampleDescription Update the email for an authenticated user
   * Sends a "Confirm Email Change" email to the new address. If **Secure Email Change** is enabled (default), confirmation is also required from the **old email** before the change is applied. To skip dual confirmation and apply the change after only the new email is verified, disable **Secure Email Change** in the [Email Auth Provider settings](/dashboard/project/_/auth/providers?provider=Email).
   *
   * @example Update the email for an authenticated user
   * ```js
   * const { data, error } = await supabase.auth.updateUser({
   *   email: 'new@email.com'
   * })
   * ```
   *
   * @exampleResponse Update the email for an authenticated user
   * ```json
   * {
   *   "data": {
   *     "user": {
   *       "id": "11111111-1111-1111-1111-111111111111",
   *       "aud": "authenticated",
   *       "role": "authenticated",
   *       "email": "example@email.com",
   *       "email_confirmed_at": "2024-01-01T00:00:00Z",
   *       "phone": "",
   *       "confirmed_at": "2024-01-01T00:00:00Z",
   *       "new_email": "new@email.com",
   *       "email_change_sent_at": "2024-01-01T00:00:00Z",
   *       "last_sign_in_at": "2024-01-01T00:00:00Z",
   *       "app_metadata": {
   *         "provider": "email",
   *         "providers": [
   *           "email"
   *         ]
   *       },
   *       "user_metadata": {
   *         "email": "example@email.com",
   *         "email_verified": false,
   *         "phone_verified": false,
   *         "sub": "11111111-1111-1111-1111-111111111111"
   *       },
   *       "identities": [
   *         {
   *           "identity_id": "22222222-2222-2222-2222-222222222222",
   *           "id": "11111111-1111-1111-1111-111111111111",
   *           "user_id": "11111111-1111-1111-1111-111111111111",
   *           "identity_data": {
   *             "email": "example@email.com",
   *             "email_verified": false,
   *             "phone_verified": false,
   *             "sub": "11111111-1111-1111-1111-111111111111"
   *           },
   *           "provider": "email",
   *           "last_sign_in_at": "2024-01-01T00:00:00Z",
   *           "created_at": "2024-01-01T00:00:00Z",
   *           "updated_at": "2024-01-01T00:00:00Z",
   *           "email": "example@email.com"
   *         }
   *       ],
   *       "created_at": "2024-01-01T00:00:00Z",
   *       "updated_at": "2024-01-01T00:00:00Z",
   *       "is_anonymous": false
   *     }
   *   },
   *   "error": null
   * }
   * ```
   *
   * @exampleDescription Update the phone number for an authenticated user
   * Sends a one-time password (OTP) to the new phone number.
   *
   * @example Update the phone number for an authenticated user
   * ```js
   * const { data, error } = await supabase.auth.updateUser({
   *   phone: '123456789'
   * })
   * ```
   *
   * @example Update the password for an authenticated user
   * ```js
   * const { data, error } = await supabase.auth.updateUser({
   *   password: 'new password'
   * })
   * ```
   *
   * @exampleDescription Update the user's metadata
   * Updates the user's custom metadata.
   *
   * **Note**: The `data` field maps to the `auth.users.raw_user_meta_data` column in your Supabase database. When calling `getUser()`, the data will be available as `user.user_metadata`.
   *
   * @example Update the user's metadata
   * ```js
   * const { data, error } = await supabase.auth.updateUser({
   *   data: { hello: 'world' }
   * })
   * ```
   *
   * @exampleDescription Update the user's password with a nonce
   * If **Secure password change** is enabled in your [project's email provider settings](/dashboard/project/_/auth/providers), updating the user's password would require a nonce if the user **hasn't recently signed in**. The nonce is sent to the user's email or phone number. A user is deemed recently signed in if the session was created in the last 24 hours.
   *
   * @example Update the user's password with a nonce
   * ```js
   * const { data, error } = await supabase.auth.updateUser({
   *   password: 'new password',
   *   nonce: '123456'
   * })
   * ```
   */
  async updateUser(
    attributes: UserAttributes,
    options: {
      emailRedirectTo?: string | undefined
    } = {}
  ): Promise<UserResponse> {
    await this.initializePromise

    return await this._acquireLock(this.lockAcquireTimeout, async () => {
      return await this._updateUser(attributes, options)
    })
  }

  protected async _updateUser(
    attributes: UserAttributes,
    options: {
      emailRedirectTo?: string | undefined
    } = {}
  ): Promise<UserResponse> {
    try {
      return await this._useSession(async (result) => {
        const { data: sessionData, error: sessionError } = result
        if (sessionError) {
          throw sessionError
        }
        if (!sessionData.session) {
          throw new AuthSessionMissingError()
        }
        const session: Session = sessionData.session
        let codeChallenge: string | null = null
        let codeChallengeMethod: string | null = null
        if (this.flowType === 'pkce' && attributes.email != null) {
          ;[codeChallenge, codeChallengeMethod] = await getCodeChallengeAndMethod(
            this.storage,
            this.storageKey
          )
        }

        const { data, error: userError } = await _request(this.fetch, 'PUT', `${this.url}/user`, {
          headers: this.headers,
          redirectTo: options?.emailRedirectTo,
          body: {
            ...attributes,
            code_challenge: codeChallenge,
            code_challenge_method: codeChallengeMethod,
          },
          jwt: session.access_token,
          xform: _userResponse,
        })
        if (userError) {
          throw userError
        }
        session.user = data.user as User
        await this._saveSession(session)
        await this._notifyAllSubscribers('USER_UPDATED', session)
        return this._returnResult({ data: { user: session.user }, error: null })
      })
    } catch (error) {
      await removeItemAsync(this.storage, `${this.storageKey}-code-verifier`)
      if (isAuthError(error)) {
        return this._returnResult({ data: { user: null }, error })
      }

      throw error
    }
  }

  /**
   * Sets the session data from the current session. If the current session is expired, setSession will take care of refreshing it to obtain a new session.
   * If the refresh token or access token in the current session is invalid, an error will be thrown.
   * @param currentSession The current session that minimally contains an access token and refresh token.
   *
   * @category Auth
   *
   * @remarks
   * - This method sets the session using an `access_token` and `refresh_token`.
   * - If successful, a `SIGNED_IN` event is emitted.
   *
   * @exampleDescription Set the session
   * Sets the session data from an access_token and refresh_token, then returns an auth response or error.
   *
   * @example Set the session
   * ```js
   *   const { data, error } = await supabase.auth.setSession({
   *     access_token,
   *     refresh_token
   *   })
   * ```
   *
   * @exampleResponse Set the session
   * ```json
   * {
   *   "data": {
   *     "user": {
   *       "id": "11111111-1111-1111-1111-111111111111",
   *       "aud": "authenticated",
   *       "role": "authenticated",
   *       "email": "example@email.com",
   *       "email_confirmed_at": "2024-01-01T00:00:00Z",
   *       "phone": "",
   *       "confirmed_at": "2024-01-01T00:00:00Z",
   *       "last_sign_in_at": "2024-01-01T00:00:00Z",
   *       "app_metadata": {
   *         "provider": "email",
   *         "providers": [
   *           "email"
   *         ]
   *       },
   *       "user_metadata": {
   *         "email": "example@email.com",
   *         "email_verified": false,
   *         "phone_verified": false,
   *         "sub": "11111111-1111-1111-1111-111111111111"
   *       },
   *       "identities": [
   *         {
   *           "identity_id": "22222222-2222-2222-2222-222222222222",
   *           "id": "11111111-1111-1111-1111-111111111111",
   *           "user_id": "11111111-1111-1111-1111-111111111111",
   *           "identity_data": {
   *             "email": "example@email.com",
   *             "email_verified": false,
   *             "phone_verified": false,
   *             "sub": "11111111-1111-1111-1111-111111111111"
   *           },
   *           "provider": "email",
   *           "last_sign_in_at": "2024-01-01T00:00:00Z",
   *           "created_at": "2024-01-01T00:00:00Z",
   *           "updated_at": "2024-01-01T00:00:00Z",
   *           "email": "example@email.com"
   *         }
   *       ],
   *       "created_at": "2024-01-01T00:00:00Z",
   *       "updated_at": "2024-01-01T00:00:00Z",
   *       "is_anonymous": false
   *     },
   *     "session": {
   *       "access_token": "<ACCESS_TOKEN>",
   *       "refresh_token": "<REFRESH_TOKEN>",
   *       "user": {
   *         "id": "11111111-1111-1111-1111-111111111111",
   *         "aud": "authenticated",
   *         "role": "authenticated",
   *         "email": "example@email.com",
   *         "email_confirmed_at": "2024-01-01T00:00:00Z",
   *         "phone": "",
   *         "confirmed_at": "2024-01-01T00:00:00Z",
   *         "last_sign_in_at": "11111111-1111-1111-1111-111111111111",
   *         "app_metadata": {
   *           "provider": "email",
   *           "providers": [
   *             "email"
   *           ]
   *         },
   *         "user_metadata": {
   *           "email": "example@email.com",
   *           "email_verified": false,
   *           "phone_verified": false,
   *           "sub": "11111111-1111-1111-1111-111111111111"
   *         },
   *         "identities": [
   *           {
   *             "identity_id": "2024-01-01T00:00:00Z",
   *             "id": "11111111-1111-1111-1111-111111111111",
   *             "user_id": "11111111-1111-1111-1111-111111111111",
   *             "identity_data": {
   *               "email": "example@email.com",
   *               "email_verified": false,
   *               "phone_verified": false,
   *               "sub": "11111111-1111-1111-1111-111111111111"
   *             },
   *             "provider": "email",
   *             "last_sign_in_at": "2024-01-01T00:00:00Z",
   *             "created_at": "2024-01-01T00:00:00Z",
   *             "updated_at": "2024-01-01T00:00:00Z",
   *             "email": "example@email.com"
   *           }
   *         ],
   *         "created_at": "2024-01-01T00:00:00Z",
   *         "updated_at": "2024-01-01T00:00:00Z",
   *         "is_anonymous": false
   *       },
   *       "token_type": "bearer",
   *       "expires_in": 3500,
   *       "expires_at": 1700000000
   *     }
   *   },
   *   "error": null
   * }
   * ```
   */
  async setSession(currentSession: {
    access_token: string
    refresh_token: string
  }): Promise<AuthResponse> {
    await this.initializePromise

    return await this._acquireLock(this.lockAcquireTimeout, async () => {
      return await this._setSession(currentSession)
    })
  }

  protected async _setSession(currentSession: {
    access_token: string
    refresh_token: string
  }): Promise<AuthResponse> {
    try {
      if (!currentSession.access_token || !currentSession.refresh_token) {
        throw new AuthSessionMissingError()
      }

      const timeNow = Date.now() / 1000
      let expiresAt = timeNow
      let hasExpired = true
      let session: Session | null = null
      const { payload } = decodeJWT(currentSession.access_token)
      if (payload.exp) {
        expiresAt = payload.exp
        hasExpired = expiresAt <= timeNow
      }

      if (hasExpired) {
        const { data: refreshedSession, error } = await this._callRefreshToken(
          currentSession.refresh_token
        )
        if (error) {
          return this._returnResult({ data: { user: null, session: null }, error: error })
        }

        if (!refreshedSession) {
          return { data: { user: null, session: null }, error: null }
        }
        session = refreshedSession
      } else {
        const { data, error } = await this._getUser(currentSession.access_token)
        if (error) {
          return this._returnResult({ data: { user: null, session: null }, error })
        }
        session = {
          access_token: currentSession.access_token,
          refresh_token: currentSession.refresh_token,
          user: data.user,
          token_type: 'bearer',
          expires_in: expiresAt - timeNow,
          expires_at: expiresAt,
        }
        await this._saveSession(session)
        await this._notifyAllSubscribers('SIGNED_IN', session)
      }

      return this._returnResult({ data: { user: session.user, session }, error: null })
    } catch (error) {
      if (isAuthError(error)) {
        return this._returnResult({ data: { session: null, user: null }, error })
      }

      throw error
    }
  }

  /**
   * Returns a new session, regardless of expiry status.
   * Takes in an optional current session. If not passed in, then refreshSession() will attempt to retrieve it from getSession().
   * If the current session's refresh token is invalid, an error will be thrown.
   * @param currentSession The current session. If passed in, it must contain a refresh token.
   *
   * @category Auth
   *
   * @remarks
   * - This method will refresh and return a new session whether the current one is expired or not.
   *
   * @example Refresh session using the current session
   * ```js
   * const { data, error } = await supabase.auth.refreshSession()
   * const { session, user } = data
   * ```
   *
   * @exampleResponse Refresh session using the current session
   * ```json
   * {
   *   "data": {
   *     "user": {
   *       "id": "11111111-1111-1111-1111-111111111111",
   *       "aud": "authenticated",
   *       "role": "authenticated",
   *       "email": "example@email.com",
   *       "email_confirmed_at": "2024-01-01T00:00:00Z",
   *       "phone": "",
   *       "confirmed_at": "2024-01-01T00:00:00Z",
   *       "last_sign_in_at": "2024-01-01T00:00:00Z",
   *       "app_metadata": {
   *         "provider": "email",
   *         "providers": [
   *           "email"
   *         ]
   *       },
   *       "user_metadata": {
   *         "email": "example@email.com",
   *         "email_verified": false,
   *         "phone_verified": false,
   *         "sub": "11111111-1111-1111-1111-111111111111"
   *       },
   *       "identities": [
   *         {
   *           "identity_id": "22222222-2222-2222-2222-222222222222",
   *           "id": "11111111-1111-1111-1111-111111111111",
   *           "user_id": "11111111-1111-1111-1111-111111111111",
   *           "identity_data": {
   *             "email": "example@email.com",
   *             "email_verified": false,
   *             "phone_verified": false,
   *             "sub": "11111111-1111-1111-1111-111111111111"
   *           },
   *           "provider": "email",
   *           "last_sign_in_at": "2024-01-01T00:00:00Z",
   *           "created_at": "2024-01-01T00:00:00Z",
   *           "updated_at": "2024-01-01T00:00:00Z",
   *           "email": "example@email.com"
   *         }
   *       ],
   *       "created_at": "2024-01-01T00:00:00Z",
   *       "updated_at": "2024-01-01T00:00:00Z",
   *       "is_anonymous": false
   *     },
   *     "session": {
   *       "access_token": "<ACCESS_TOKEN>",
   *       "token_type": "bearer",
   *       "expires_in": 3600,
   *       "expires_at": 1700000000,
   *       "refresh_token": "<REFRESH_TOKEN>",
   *       "user": {
   *         "id": "11111111-1111-1111-1111-111111111111",
   *         "aud": "authenticated",
   *         "role": "authenticated",
   *         "email": "example@email.com",
   *         "email_confirmed_at": "2024-01-01T00:00:00Z",
   *         "phone": "",
   *         "confirmed_at": "2024-01-01T00:00:00Z",
   *         "last_sign_in_at": "2024-01-01T00:00:00Z",
   *         "app_metadata": {
   *           "provider": "email",
   *           "providers": [
   *             "email"
   *           ]
   *         },
   *         "user_metadata": {
   *           "email": "example@email.com",
   *           "email_verified": false,
   *           "phone_verified": false,
   *           "sub": "11111111-1111-1111-1111-111111111111"
   *         },
   *         "identities": [
   *           {
   *             "identity_id": "22222222-2222-2222-2222-222222222222",
   *             "id": "11111111-1111-1111-1111-111111111111",
   *             "user_id": "11111111-1111-1111-1111-111111111111",
   *             "identity_data": {
   *               "email": "example@email.com",
   *               "email_verified": false,
   *               "phone_verified": false,
   *               "sub": "11111111-1111-1111-1111-111111111111"
   *             },
   *             "provider": "email",
   *             "last_sign_in_at": "2024-01-01T00:00:00Z",
   *             "created_at": "2024-01-01T00:00:00Z",
   *             "updated_at": "2024-01-01T00:00:00Z",
   *             "email": "example@email.com"
   *           }
   *         ],
   *         "created_at": "2024-01-01T00:00:00Z",
   *         "updated_at": "2024-01-01T00:00:00Z",
   *         "is_anonymous": false
   *       }
   *     }
   *   },
   *   "error": null
   * }
   * ```
   *
   * @example Refresh session using a refresh token
   * ```js
   * const { data, error } = await supabase.auth.refreshSession({ refresh_token })
   * const { session, user } = data
   * ```
   */
  async refreshSession(currentSession?: { refresh_token: string }): Promise<AuthResponse> {
    await this.initializePromise

    return await this._acquireLock(this.lockAcquireTimeout, async () => {
      return await this._refreshSession(currentSession)
    })
  }

  protected async _refreshSession(currentSession?: {
    refresh_token: string
  }): Promise<AuthResponse> {
    try {
      return await this._useSession(async (result) => {
        if (!currentSession) {
          const { data, error } = result
          if (error) {
            throw error
          }

          currentSession = data.session ?? undefined
        }

        if (!currentSession?.refresh_token) {
          throw new AuthSessionMissingError()
        }

        const { data: session, error } = await this._callRefreshToken(currentSession.refresh_token)
        if (error) {
          return this._returnResult({ data: { user: null, session: null }, error: error })
        }

        if (!session) {
          return this._returnResult({ data: { user: null, session: null }, error: null })
        }

        return this._returnResult({ data: { user: session.user, session }, error: null })
      })
    } catch (error) {
      if (isAuthError(error)) {
        return this._returnResult({ data: { user: null, session: null }, error })
      }

      throw error
    }
  }

  /**
   * Gets the session data from a URL string
   */
  private async _getSessionFromURL(
    params: { [parameter: string]: string },
    callbackUrlType: string
  ): Promise<
    | {
        data: { session: Session; redirectType: string | null }
        error: null
      }
    | { data: { session: null; redirectType: null }; error: AuthError }
  > {
    try {
      if (!isBrowser()) throw new AuthImplicitGrantRedirectError('No browser detected.')

      // If there's an error in the URL, it doesn't matter what flow it is, we just return the error.
      if (params.error || params.error_description || params.error_code) {
        // The error class returned implies that the redirect is from an implicit grant flow
        // but it could also be from a redirect error from a PKCE flow.
        throw new AuthImplicitGrantRedirectError(
          params.error_description || 'Error in URL with unspecified error_description',
          {
            error: params.error || 'unspecified_error',
            code: params.error_code || 'unspecified_code',
          }
        )
      }

      // Checks for mismatches between the flowType initialised in the client and the URL parameters
      switch (callbackUrlType) {
        case 'implicit':
          if (this.flowType === 'pkce') {
            throw new AuthPKCEGrantCodeExchangeError('Not a valid PKCE flow url.')
          }
          break
        case 'pkce':
          if (this.flowType === 'implicit') {
            throw new AuthImplicitGrantRedirectError('Not a valid implicit grant flow url.')
          }
          break
        default:
        // there's no mismatch so we continue
      }

      // Since this is a redirect for PKCE, we attempt to retrieve the code from the URL for the code exchange
      if (callbackUrlType === 'pkce') {
        this._debug('#_initialize()', 'begin', 'is PKCE flow', true)
        if (!params.code) throw new AuthPKCEGrantCodeExchangeError('No code detected.')
        const { data, error } = await this._exchangeCodeForSession(params.code)
        if (error) throw error

        const url = new URL(window.location.href)
        url.searchParams.delete('code')

        window.history.replaceState(window.history.state, '', url.toString())

        return {
          data: { session: data.session, redirectType: data.redirectType ?? null },
          error: null,
        }
      }

      const {
        provider_token,
        provider_refresh_token,
        access_token,
        refresh_token,
        expires_in,
        expires_at,
        token_type,
      } = params

      if (!access_token || !expires_in || !refresh_token || !token_type) {
        throw new AuthImplicitGrantRedirectError('No session defined in URL')
      }

      const timeNow = Math.round(Date.now() / 1000)
      const expiresIn = parseInt(expires_in)
      let expiresAt = timeNow + expiresIn

      if (expires_at) {
        expiresAt = parseInt(expires_at)
      }

      const actuallyExpiresIn = expiresAt - timeNow
      if (actuallyExpiresIn * 1000 <= AUTO_REFRESH_TICK_DURATION_MS) {
        console.warn(
          `@supabase/gotrue-js: Session as retrieved from URL expires in ${actuallyExpiresIn}s, should have been closer to ${expiresIn}s`
        )
      }

      const issuedAt = expiresAt - expiresIn
      if (timeNow - issuedAt >= 120) {
        console.warn(
          '@supabase/gotrue-js: Session as retrieved from URL was issued over 120s ago, URL could be stale',
          issuedAt,
          expiresAt,
          timeNow
        )
      } else if (timeNow - issuedAt < 0) {
        console.warn(
          '@supabase/gotrue-js: Session as retrieved from URL was issued in the future? Check the device clock for skew',
          issuedAt,
          expiresAt,
          timeNow
        )
      }

      const { data, error } = await this._getUser(access_token)
      if (error) throw error

      const session: Session = {
        provider_token,
        provider_refresh_token,
        access_token,
        expires_in: expiresIn,
        expires_at: expiresAt,
        refresh_token,
        token_type: token_type as 'bearer',
        user: data.user,
      }

      // Remove tokens from URL
      window.location.hash = ''
      this._debug('#_getSessionFromURL()', 'clearing window.location.hash')

      return this._returnResult({ data: { session, redirectType: params.type }, error: null })
    } catch (error) {
      if (isAuthError(error)) {
        return this._returnResult({ data: { session: null, redirectType: null }, error })
      }

      throw error
    }
  }

  /**
   * Checks if the current URL contains parameters given by an implicit oauth grant flow (https://www.rfc-editor.org/rfc/rfc6749.html#section-4.2)
   *
   * If `detectSessionInUrl` is a function, it will be called with the URL and params to determine
   * if the URL should be processed as a Supabase auth callback. This allows users to exclude
   * URLs from other OAuth providers (e.g., Facebook Login) that also return access_token in the fragment.
   */
  private _isImplicitGrantCallback(params: { [parameter: string]: string }): boolean {
    if (typeof this.detectSessionInUrl === 'function') {
      return this.detectSessionInUrl(new URL(window.location.href), params)
    }
    return Boolean(params.access_token || params.error_description)
  }

  /**
   * Checks if the current URL and backing storage contain parameters given by a PKCE flow
   */
  private async _isPKCECallback(params: { [parameter: string]: string }): Promise<boolean> {
    const currentStorageContent = await getItemAsync(
      this.storage,
      `${this.storageKey}-code-verifier`
    )

    return !!(params.code && currentStorageContent)
  }

  /**
   * Inside a browser context, `signOut()` will remove the logged in user from the browser session and log them out - removing all items from localstorage and then trigger a `"SIGNED_OUT"` event.
   *
   * For server-side management, you can revoke all refresh tokens for a user by passing a user's JWT through to `auth.api.signOut(JWT: string)`.
   * There is no way to revoke a user's access token jwt until it expires. It is recommended to set a shorter expiry on the jwt for this reason.
   *
   * If using `others` scope, no `SIGNED_OUT` event is fired!
   *
   * @category Auth
   *
   * @remarks
   * - In order to use the `signOut()` method, the user needs to be signed in first.
   * - By default, `signOut()` uses the global scope, which signs out all other sessions that the user is logged into as well. Customize this behavior by passing a scope parameter.
   * - Since Supabase Auth uses JWTs for authentication, the access token JWT will be valid until it's expired. When the user signs out, Supabase revokes the refresh token and deletes the JWT from the client-side. This does not revoke the JWT and it will still be valid until it expires.
   *
   * @example Sign out (all sessions)
   * ```js
   * const { error } = await supabase.auth.signOut()
   * ```
   *
   * @example Sign out (current session)
   * ```js
   * const { error } = await supabase.auth.signOut({ scope: 'local' })
   * ```
   *
   * @example Sign out (other sessions)
   * ```js
   * const { error } = await supabase.auth.signOut({ scope: 'others' })
   * ```
   */
  async signOut(options: SignOut = { scope: 'global' }): Promise<{ error: AuthError | null }> {
    await this.initializePromise

    return await this._acquireLock(this.lockAcquireTimeout, async () => {
      return await this._signOut(options)
    })
  }

  protected async _signOut(
    { scope }: SignOut = { scope: 'global' }
  ): Promise<{ error: AuthError | null }> {
    return await this._useSession(async (result) => {
      const { data, error: sessionError } = result
      if (sessionError && !isAuthSessionMissingError(sessionError)) {
        return this._returnResult({ error: sessionError })
      }
      const accessToken = data.session?.access_token
      if (accessToken) {
        const { error } = await this.admin.signOut(accessToken, scope)
        if (error) {
          // ignore 404s since user might not exist anymore
          // ignore 401s since an invalid or expired JWT should sign out the current session
          if (
            !(
              (isAuthApiError(error) &&
                (error.status === 404 || error.status === 401 || error.status === 403)) ||
              isAuthSessionMissingError(error)
            )
          ) {
            return this._returnResult({ error })
          }
        }
      }
      if (scope !== 'others') {
        await this._removeSession()
        await removeItemAsync(this.storage, `${this.storageKey}-code-verifier`)
      }
      return this._returnResult({ error: null })
    })
  }

  /**
   * Receive a notification every time an auth event happens.
   * Safe to use without an async function as callback.
   *
   * @param callback A callback function to be invoked when an auth event happens.
   */
  onAuthStateChange(callback: (event: AuthChangeEvent, session: Session | null) => void): {
    data: { subscription: Subscription }
  }

  /**
   * Avoid using an async function inside `onAuthStateChange` as you might end
   * up with a deadlock. The callback function runs inside an exclusive lock,
   * so calling other Supabase Client APIs that also try to acquire the
   * exclusive lock, might cause a deadlock. This behavior is observable across
   * tabs. In the next major library version, this behavior will not be supported.
   *
   * Receive a notification every time an auth event happens.
   *
   * @param callback A callback function to be invoked when an auth event happens.
   * @deprecated Due to the possibility of deadlocks with async functions as callbacks, use the version without an async function.
   */
  onAuthStateChange(callback: (event: AuthChangeEvent, session: Session | null) => Promise<void>): {
    data: { subscription: Subscription }
  }

  /**  *
   * @category Auth
   *
   * @remarks
   * - Subscribes to important events occurring on the user's session.
   * - Use on the frontend/client. It is less useful on the server.
   * - Events are emitted across tabs to keep your application's UI up-to-date. Some events can fire very frequently, based on the number of tabs open. Use a quick and efficient callback function, and defer or debounce as many operations as you can to be performed outside of the callback.
   * - **Important:** A callback can be an `async` function and it runs synchronously during the processing of the changes causing the event. You can easily create a dead-lock by using `await` on a call to another method of the Supabase library.
   *   - Avoid using `async` functions as callbacks.
   *   - Limit the number of `await` calls in `async` callbacks.
   *   - Do not use other Supabase functions in the callback function. If you must, dispatch the functions once the callback has finished executing. Use this as a quick way to achieve this:
   *     ```js
   *     supabase.auth.onAuthStateChange((event, session) => {
   *       setTimeout(async () => {
   *         // await on other Supabase function here
   *         // this runs right after the callback has finished
   *       }, 0)
   *     })
   *     ```
   * - Emitted events:
   *   - `INITIAL_SESSION`
   *     - Emitted right after the Supabase client is constructed and the initial session from storage is loaded.
   *   - `SIGNED_IN`
   *     - Emitted each time a user session is confirmed or re-established, including on user sign in and when refocusing a tab.
   *     - Avoid making assumptions as to when this event is fired, this may occur even when the user is already signed in. Instead, check the user object attached to the event to see if a new user has signed in and update your application's UI.
   *     - This event can fire very frequently depending on the number of tabs open in your application.
   *   - `SIGNED_OUT`
   *     - Emitted when the user signs out. This can be after:
   *       - A call to `supabase.auth.signOut()`.
   *       - After the user's session has expired for any reason:
   *         - User has signed out on another device.
   *         - The session has reached its timebox limit or inactivity timeout.
   *         - User has signed in on another device with single session per user enabled.
   *         - Check the [User Sessions](/docs/guides/auth/sessions) docs for more information.
   *     - Use this to clean up any local storage your application has associated with the user.
   *   - `TOKEN_REFRESHED`
   *     - Emitted each time a new access and refresh token are fetched for the signed in user.
   *     - It's best practice and highly recommended to extract the access token (JWT) and store it in memory for further use in your application.
   *       - Avoid frequent calls to `supabase.auth.getSession()` for the same purpose.
   *     - There is a background process that keeps track of when the session should be refreshed so you will always receive valid tokens by listening to this event.
   *     - The frequency of this event is related to the JWT expiry limit configured on your project.
   *   - `USER_UPDATED`
   *     - Emitted each time the `supabase.auth.updateUser()` method finishes successfully. Listen to it to update your application's UI based on new profile information.
   *   - `PASSWORD_RECOVERY`
   *     - Emitted instead of the `SIGNED_IN` event when the user lands on a page that includes a password recovery link in the URL.
   *     - Use it to show a UI to the user where they can [reset their password](/docs/guides/auth/passwords#resetting-a-users-password-forgot-password).
   *
   * @example Listen to auth changes
   * ```js
   * const { data } = supabase.auth.onAuthStateChange((event, session) => {
   *   console.log(event, session)
   *
   *   if (event === 'INITIAL_SESSION') {
   *     // handle initial session
   *   } else if (event === 'SIGNED_IN') {
   *     // handle sign in event
   *   } else if (event === 'SIGNED_OUT') {
   *     // handle sign out event
   *   } else if (event === 'PASSWORD_RECOVERY') {
   *     // handle password recovery event
   *   } else if (event === 'TOKEN_REFRESHED') {
   *     // handle token refreshed event
   *   } else if (event === 'USER_UPDATED') {
   *     // handle user updated event
   *   }
   * })
   *
   * // call unsubscribe to remove the callback
   * data.subscription.unsubscribe()
   * ```
   *
   * @exampleDescription Listen to sign out
   * Make sure you clear out any local data, such as local and session storage, after the client library has detected the user's sign out.
   *
   * @example Listen to sign out
   * ```js
   * supabase.auth.onAuthStateChange((event, session) => {
   *   if (event === 'SIGNED_OUT') {
   *     console.log('SIGNED_OUT', session)
   *
   *     // clear local and session storage
   *     [
   *       window.localStorage,
   *       window.sessionStorage,
   *     ].forEach((storage) => {
   *       Object.entries(storage)
   *         .forEach(([key]) => {
   *           storage.removeItem(key)
   *         })
   *     })
   *   }
   * })
   * ```
   *
   * @exampleDescription Store OAuth provider tokens on sign in
   * When using [OAuth (Social Login)](/docs/guides/auth/social-login) you sometimes wish to get access to the provider's access token and refresh token, in order to call provider APIs in the name of the user.
   *
   * For example, if you are using [Sign in with Google](/docs/guides/auth/social-login/auth-google) you may want to use the provider token to call Google APIs on behalf of the user. Supabase Auth does not keep track of the provider access and refresh token, but does return them for you once, immediately after sign in. You can use the `onAuthStateChange` method to listen for the presence of the provider tokens and store them in local storage. You can further send them to your server's APIs for use on the backend.
   *
   * Finally, make sure you remove them from local storage on the `SIGNED_OUT` event. If the OAuth provider supports token revocation, make sure you call those APIs either from the frontend or schedule them to be called on the backend.
   *
   * @example Store OAuth provider tokens on sign in
   * ```js
   * // Register this immediately after calling createClient!
   * // Because signInWithOAuth causes a redirect, you need to fetch the
   * // provider tokens from the callback.
   * supabase.auth.onAuthStateChange((event, session) => {
   *   if (session && session.provider_token) {
   *     window.localStorage.setItem('oauth_provider_token', session.provider_token)
   *   }
   *
   *   if (session && session.provider_refresh_token) {
   *     window.localStorage.setItem('oauth_provider_refresh_token', session.provider_refresh_token)
   *   }
   *
   *   if (event === 'SIGNED_OUT') {
   *     window.localStorage.removeItem('oauth_provider_token')
   *     window.localStorage.removeItem('oauth_provider_refresh_token')
   *   }
   * })
   * ```
   *
   * @exampleDescription Use React Context for the User's session
   * Instead of relying on `supabase.auth.getSession()` within your React components, you can use a [React Context](https://react.dev/reference/react/createContext) to store the latest session information from the `onAuthStateChange` callback and access it that way.
   *
   * @example Use React Context for the User's session
   * ```js
   * const SessionContext = React.createContext(null)
   *
   * function main() {
   *   const [session, setSession] = React.useState(null)
   *
   *   React.useEffect(() => {
   *     const {data: { subscription }} = supabase.auth.onAuthStateChange(
   *       (event, session) => {
   *         if (event === 'SIGNED_OUT') {
   *           setSession(null)
   *         } else if (session) {
   *           setSession(session)
   *         }
   *       })
   *
   *     return () => {
   *       subscription.unsubscribe()
   *     }
   *   }, [])
   *
   *   return (
   *     <SessionContext.Provider value={session}>
   *       <App />
   *     </SessionContext.Provider>
   *   )
   * }
   * ```
   *
   * @example Listen to password recovery events
   * ```js
   * supabase.auth.onAuthStateChange((event, session) => {
   *   if (event === 'PASSWORD_RECOVERY') {
   *     console.log('PASSWORD_RECOVERY', session)
   *     // show screen to update user's password
   *     showPasswordResetScreen(true)
   *   }
   * })
   * ```
   *
   * @example Listen to sign in
   * ```js
   * supabase.auth.onAuthStateChange((event, session) => {
   *   if (event === 'SIGNED_IN') console.log('SIGNED_IN', session)
   * })
   * ```
   *
   * @example Listen to token refresh
   * ```js
   * supabase.auth.onAuthStateChange((event, session) => {
   *   if (event === 'TOKEN_REFRESHED') console.log('TOKEN_REFRESHED', session)
   * })
   * ```
   *
   * @example Listen to user updates
   * ```js
   * supabase.auth.onAuthStateChange((event, session) => {
   *   if (event === 'USER_UPDATED') console.log('USER_UPDATED', session)
   * })
   * ```
   */
  onAuthStateChange(
    callback: (event: AuthChangeEvent, session: Session | null) => void | Promise<void>
  ): {
    data: { subscription: Subscription }
  } {
    const id: string | symbol = generateCallbackId()
    const subscription: Subscription = {
      id,
      callback,
      unsubscribe: () => {
        this._debug('#unsubscribe()', 'state change callback with id removed', id)

        this.stateChangeEmitters.delete(id)
      },
    }

    this._debug('#onAuthStateChange()', 'registered callback with id', id)

    this.stateChangeEmitters.set(id, subscription)
    ;(async () => {
      await this.initializePromise

      await this._acquireLock(this.lockAcquireTimeout, async () => {
        this._emitInitialSession(id)
      })
    })()

    return { data: { subscription } }
  }

  private async _emitInitialSession(id: string | symbol): Promise<void> {
    return await this._useSession(async (result) => {
      try {
        const {
          data: { session },
          error,
        } = result
        if (error) throw error

        await this.stateChangeEmitters.get(id)?.callback('INITIAL_SESSION', session)
        this._debug('INITIAL_SESSION', 'callback id', id, 'session', session)
      } catch (err) {
        await this.stateChangeEmitters.get(id)?.callback('INITIAL_SESSION', null)
        this._debug('INITIAL_SESSION', 'callback id', id, 'error', err)
        if (isAuthSessionMissingError(err)) {
          console.warn(err)
        } else {
          console.error(err)
        }
      }
    })
  }

  /**
   * Sends a password reset request to an email address. This method supports the PKCE flow.
   *
   * @param email The email address of the user.
   * @param options.redirectTo The URL to send the user to after they click the password reset link.
   * @param options.captchaToken Verification token received when the user completes the captcha on the site.
   *
   * @category Auth
   *
   * @remarks
   * - The password reset flow consist of 2 broad steps: (i) Allow the user to login via the password reset link; (ii) Update the user's password.
   * - The `resetPasswordForEmail()` only sends a password reset link to the user's email.
   * To update the user's password, see [`updateUser()`](/docs/reference/javascript/auth-updateuser).
   * - A `PASSWORD_RECOVERY` event will be emitted when the password recovery link is clicked.
   * You can use [`onAuthStateChange()`](/docs/reference/javascript/auth-onauthstatechange) to listen and invoke a callback function on these events.
   * - When the user clicks the reset link in the email they are redirected back to your application.
   * You can configure the URL that the user is redirected to with the `redirectTo` parameter.
   * See [redirect URLs and wildcards](/docs/guides/auth/redirect-urls#use-wildcards-in-redirect-urls) to add additional redirect URLs to your project.
   * - After the user has been redirected successfully, prompt them for a new password and call `updateUser()`:
   * ```js
   * const { data, error } = await supabase.auth.updateUser({
   *   password: new_password
   * })
   * ```
   *
   * @example Reset password
   * ```js
   * const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
   *   redirectTo: 'https://example.com/update-password',
   * })
   * ```
   *
   * @exampleResponse Reset password
   * ```json
   * {
   *   data: {}
   *   error: null
   * }
   * ```
   *
   * @example Reset password (React)
   * ```js
   * /**
   *  * Step 1: Send the user an email to get a password reset token.
   *  * This email contains a link which sends the user back to your application.
   *  *\/
   * const { data, error } = await supabase.auth
   *   .resetPasswordForEmail('user@email.com')
   *
   * /**
   *  * Step 2: Once the user is redirected back to your application,
   *  * ask the user to reset their password.
   *  *\/
   *  useEffect(() => {
   *    supabase.auth.onAuthStateChange(async (event, session) => {
   *      if (event == "PASSWORD_RECOVERY") {
   *        const newPassword = prompt("What would you like your new password to be?");
   *        const { data, error } = await supabase.auth
   *          .updateUser({ password: newPassword })
   *
   *        if (data) alert("Password updated successfully!")
   *        if (error) alert("There was an error updating your password.")
   *      }
   *    })
   *  }, [])
   * ```
   */
  async resetPasswordForEmail(
    email: string,
    options: {
      redirectTo?: string
      captchaToken?: string
    } = {}
  ): Promise<
    | {
        data: {}
        error: null
      }
    | { data: null; error: AuthError }
  > {
    let codeChallenge: string | null = null
    let codeChallengeMethod: string | null = null

    if (this.flowType === 'pkce') {
      ;[codeChallenge, codeChallengeMethod] = await getCodeChallengeAndMethod(
        this.storage,
        this.storageKey,
        true // isPasswordRecovery
      )
    }
    try {
      return await _request(this.fetch, 'POST', `${this.url}/recover`, {
        body: {
          email,
          code_challenge: codeChallenge,
          code_challenge_method: codeChallengeMethod,
          gotrue_meta_security: { captcha_token: options.captchaToken },
        },
        headers: this.headers,
        redirectTo: options.redirectTo,
      })
    } catch (error) {
      await removeItemAsync(this.storage, `${this.storageKey}-code-verifier`)
      if (isAuthError(error)) {
        return this._returnResult({ data: null, error })
      }

      throw error
    }
  }

  /**
   * Gets all the identities linked to a user.
   *
   * @category Auth
   *
   * @remarks
   * - The user needs to be signed in to call `getUserIdentities()`.
   *
   * @example Returns a list of identities linked to the user
   * ```js
   * const { data, error } = await supabase.auth.getUserIdentities()
   * ```
   *
   * @exampleResponse Returns a list of identities linked to the user
   * ```json
   * {
   *   "data": {
   *     "identities": [
   *       {
   *         "identity_id": "22222222-2222-2222-2222-222222222222",
   *         "id": "2024-01-01T00:00:00Z",
   *         "user_id": "2024-01-01T00:00:00Z",
   *         "identity_data": {
   *           "email": "example@email.com",
   *           "email_verified": false,
   *           "phone_verified": false,
   *           "sub": "11111111-1111-1111-1111-111111111111"
   *         },
   *         "provider": "email",
   *         "last_sign_in_at": "2024-01-01T00:00:00Z",
   *         "created_at": "2024-01-01T00:00:00Z",
   *         "updated_at": "2024-01-01T00:00:00Z",
   *         "email": "example@email.com"
   *       }
   *     ]
   *   },
   *   "error": null
   * }
   * ```
   */
  async getUserIdentities(): Promise<
    | {
        data: {
          identities: UserIdentity[]
        }
        error: null
      }
    | { data: null; error: AuthError }
  > {
    try {
      const { data, error } = await this.getUser()
      if (error) throw error
      return this._returnResult({ data: { identities: data.user.identities ?? [] }, error: null })
    } catch (error) {
      if (isAuthError(error)) {
        return this._returnResult({ data: null, error })
      }
      throw error
    }
  }

  /**
   * Links an oauth identity to an existing user.
   * This method supports the PKCE flow.
   */
  async linkIdentity(credentials: SignInWithOAuthCredentials): Promise<OAuthResponse>

  /**
   * Links an OIDC identity to an existing user.
   */
  async linkIdentity(credentials: SignInWithIdTokenCredentials): Promise<AuthTokenResponse>

  /**  *
   * @category Auth
   *
   * @remarks
   * - The **Enable Manual Linking** option must be enabled from your [project's authentication settings](/dashboard/project/_/auth/providers).
   * - The user needs to be signed in to call `linkIdentity()`.
   * - If the candidate identity is already linked to the existing user or another user, `linkIdentity()` will fail.
   * - If `linkIdentity` is run in the browser, the user is automatically redirected to the returned URL. On the server, you should handle the redirect.
   *
   * @example Link an identity to a user
   * ```js
   * const { data, error } = await supabase.auth.linkIdentity({
   *   provider: 'github'
   * })
   * ```
   *
   * @exampleResponse Link an identity to a user
   * ```json
   * {
   *   data: {
   *     provider: 'github',
   *     url: <PROVIDER_URL_TO_REDIRECT_TO>
   *   },
   *   error: null
   * }
   * ```
   */
  async linkIdentity(credentials: any): Promise<any> {
    if ('token' in credentials) {
      return this.linkIdentityIdToken(credentials)
    }

    return this.linkIdentityOAuth(credentials)
  }

  private async linkIdentityOAuth(credentials: SignInWithOAuthCredentials): Promise<OAuthResponse> {
    try {
      const { data, error } = await this._useSession(async (result) => {
        const { data, error } = result
        if (error) throw error
        const url: string = await this._getUrlForProvider(
          `${this.url}/user/identities/authorize`,
          credentials.provider,
          {
            redirectTo: credentials.options?.redirectTo,
            scopes: credentials.options?.scopes,
            queryParams: credentials.options?.queryParams,
            skipBrowserRedirect: true,
          }
        )
        return await _request(this.fetch, 'GET', url, {
          headers: this.headers,
          jwt: data.session?.access_token ?? undefined,
        })
      })
      if (error) throw error
      if (isBrowser() && !credentials.options?.skipBrowserRedirect) {
        window.location.assign(data?.url)
      }
      return this._returnResult({
        data: { provider: credentials.provider, url: data?.url },
        error: null,
      })
    } catch (error) {
      if (isAuthError(error)) {
        return this._returnResult({ data: { provider: credentials.provider, url: null }, error })
      }
      throw error
    }
  }

  private async linkIdentityIdToken(
    credentials: SignInWithIdTokenCredentials
  ): Promise<AuthTokenResponse> {
    return await this._useSession(async (result) => {
      try {
        const {
          error: sessionError,
          data: { session },
        } = result
        if (sessionError) throw sessionError

        const { options, provider, token, access_token, nonce } = credentials

        const res = await _request(this.fetch, 'POST', `${this.url}/token?grant_type=id_token`, {
          headers: this.headers,
          jwt: session?.access_token ?? undefined,
          body: {
            provider,
            id_token: token,
            access_token,
            nonce,
            link_identity: true,
            gotrue_meta_security: { captcha_token: options?.captchaToken },
          },
          xform: _sessionResponse,
        })

        const { data, error } = res
        if (error) {
          return this._returnResult({ data: { user: null, session: null }, error })
        } else if (!data || !data.session || !data.user) {
          return this._returnResult({
            data: { user: null, session: null },
            error: new AuthInvalidTokenResponseError(),
          })
        }
        if (data.session) {
          await this._saveSession(data.session)
          await this._notifyAllSubscribers('USER_UPDATED', data.session)
        }
        return this._returnResult({ data, error })
      } catch (error) {
        await removeItemAsync(this.storage, `${this.storageKey}-code-verifier`)
        if (isAuthError(error)) {
          return this._returnResult({ data: { user: null, session: null }, error })
        }
        throw error
      }
    })
  }

  /**
   * Unlinks an identity from a user by deleting it. The user will no longer be able to sign in with that identity once it's unlinked.
   *
   * @category Auth
   *
   * @remarks
   * - The **Enable Manual Linking** option must be enabled from your [project's authentication settings](/dashboard/project/_/auth/providers).
   * - The user needs to be signed in to call `unlinkIdentity()`.
   * - The user must have at least 2 identities in order to unlink an identity.
   * - The identity to be unlinked must belong to the user.
   *
   * @example Unlink an identity
   * ```js
   * // retrieve all identities linked to a user
   * const identities = await supabase.auth.getUserIdentities()
   *
   * // find the google identity
   * const googleIdentity = identities.find(
   *   identity => identity.provider === 'google'
   * )
   *
   * // unlink the google identity
   * const { error } = await supabase.auth.unlinkIdentity(googleIdentity)
   * ```
   */
  async unlinkIdentity(identity: UserIdentity): Promise<
    | {
        data: {}
        error: null
      }
    | { data: null; error: AuthError }
  > {
    try {
      return await this._useSession(async (result) => {
        const { data, error } = result
        if (error) {
          throw error
        }
        return await _request(
          this.fetch,
          'DELETE',
          `${this.url}/user/identities/${identity.identity_id}`,
          {
            headers: this.headers,
            jwt: data.session?.access_token ?? undefined,
          }
        )
      })
    } catch (error) {
      if (isAuthError(error)) {
        return this._returnResult({ data: null, error })
      }
      throw error
    }
  }

  /**
   * Generates a new JWT.
   * @param refreshToken A valid refresh token that was returned on login.
   */
  private async _refreshAccessToken(refreshToken: string): Promise<AuthResponse> {
    const debugName = `#_refreshAccessToken(${refreshToken.substring(0, 5)}...)`
    this._debug(debugName, 'begin')

    try {
      const startedAt = Date.now()

      // will attempt to refresh the token with exponential backoff
      return await retryable(
        async (attempt) => {
          if (attempt > 0) {
            await sleep(200 * Math.pow(2, attempt - 1)) // 200, 400, 800, ...
          }

          this._debug(debugName, 'refreshing attempt', attempt)

          return await _request(this.fetch, 'POST', `${this.url}/token?grant_type=refresh_token`, {
            body: { refresh_token: refreshToken },
            headers: this.headers,
            xform: _sessionResponse,
          })
        },
        (attempt, error) => {
          const nextBackOffInterval = 200 * Math.pow(2, attempt)
          return (
            error &&
            isAuthRetryableFetchError(error) &&
            // retryable only if the request can be sent before the backoff overflows the tick duration
            Date.now() + nextBackOffInterval - startedAt < AUTO_REFRESH_TICK_DURATION_MS
          )
        }
      )
    } catch (error) {
      this._debug(debugName, 'error', error)

      if (isAuthError(error)) {
        return this._returnResult({ data: { session: null, user: null }, error })
      }
      throw error
    } finally {
      this._debug(debugName, 'end')
    }
  }

  private _isValidSession(maybeSession: unknown): maybeSession is Session {
    const isValidSession =
      typeof maybeSession === 'object' &&
      maybeSession !== null &&
      'access_token' in maybeSession &&
      'refresh_token' in maybeSession &&
      'expires_at' in maybeSession

    return isValidSession
  }

  private async _handleProviderSignIn(
    provider: Provider,
    options: {
      redirectTo?: string
      scopes?: string
      queryParams?: { [key: string]: string }
      skipBrowserRedirect?: boolean
    }
  ) {
    const url: string = await this._getUrlForProvider(`${this.url}/authorize`, provider, {
      redirectTo: options.redirectTo,
      scopes: options.scopes,
      queryParams: options.queryParams,
    })

    this._debug('#_handleProviderSignIn()', 'provider', provider, 'options', options, 'url', url)

    // try to open on the browser
    if (isBrowser() && !options.skipBrowserRedirect) {
      window.location.assign(url)
    }

    return { data: { provider, url }, error: null }
  }

  /**
   * Recovers the session from LocalStorage and refreshes the token
   * Note: this method is async to accommodate for AsyncStorage e.g. in React native.
   */
  private async _recoverAndRefresh() {
    const debugName = '#_recoverAndRefresh()'
    this._debug(debugName, 'begin')

    try {
      const currentSession = (await getItemAsync(this.storage, this.storageKey)) as Session | null

      if (currentSession && this.userStorage) {
        let maybeUser: { user: User | null } | null = (await getItemAsync(
          this.userStorage,
          this.storageKey + '-user'
        )) as any

        if (!this.storage.isServer && Object.is(this.storage, this.userStorage) && !maybeUser) {
          // storage and userStorage are the same storage medium, for example
          // window.localStorage if userStorage does not have the user from
          // storage stored, store it first thereby migrating the user object
          // from storage -> userStorage

          maybeUser = { user: currentSession.user }
          await setItemAsync(this.userStorage, this.storageKey + '-user', maybeUser)
        }

        currentSession.user = maybeUser?.user ?? userNotAvailableProxy()
      } else if (currentSession && !currentSession.user) {
        // user storage is not set, let's check if it was previously enabled so
        // we bring back the storage as it should be

        if (!currentSession.user) {
          // test if userStorage was previously enabled and the storage medium was the same, to move the user back under the same key
          const separateUser: { user: User | null } | null = (await getItemAsync(
            this.storage,
            this.storageKey + '-user'
          )) as any

          if (separateUser && separateUser?.user) {
            currentSession.user = separateUser.user

            await removeItemAsync(this.storage, this.storageKey + '-user')
            await setItemAsync(this.storage, this.storageKey, currentSession)
          } else {
            currentSession.user = userNotAvailableProxy()
          }
        }
      }

      this._debug(debugName, 'session from storage', currentSession)

      if (!this._isValidSession(currentSession)) {
        this._debug(debugName, 'session is not valid')
        if (currentSession !== null) {
          await this._removeSession()
        }

        return
      }

      const expiresWithMargin =
        (currentSession.expires_at ?? Infinity) * 1000 - Date.now() < EXPIRY_MARGIN_MS

      this._debug(
        debugName,
        `session has${expiresWithMargin ? '' : ' not'} expired with margin of ${EXPIRY_MARGIN_MS}s`
      )

      if (expiresWithMargin) {
        if (this.autoRefreshToken && currentSession.refresh_token) {
          const { error } = await this._callRefreshToken(currentSession.refresh_token)

          if (error) {
            console.error(error)

            if (!isAuthRetryableFetchError(error)) {
              this._debug(
                debugName,
                'refresh failed with a non-retryable error, removing the session',
                error
              )
              await this._removeSession()
            }
          }
        }
      } else if (
        currentSession.user &&
        (currentSession.user as any).__isUserNotAvailableProxy === true
      ) {
        // If we have a proxy user, try to get the real user data
        try {
          const { data, error: userError } = await this._getUser(currentSession.access_token)

          if (!userError && data?.user) {
            currentSession.user = data.user
            await this._saveSession(currentSession)
            await this._notifyAllSubscribers('SIGNED_IN', currentSession)
          } else {
            this._debug(debugName, 'could not get user data, skipping SIGNED_IN notification')
          }
        } catch (getUserError) {
          console.error('Error getting user data:', getUserError)
          this._debug(
            debugName,
            'error getting user data, skipping SIGNED_IN notification',
            getUserError
          )
        }
      } else {
        // no need to persist currentSession again, as we just loaded it from
        // local storage; persisting it again may overwrite a value saved by
        // another client with access to the same local storage
        await this._notifyAllSubscribers('SIGNED_IN', currentSession)
      }
    } catch (err) {
      this._debug(debugName, 'error', err)

      console.error(err)
      return
    } finally {
      this._debug(debugName, 'end')
    }
  }

  private async _callRefreshToken(refreshToken: string): Promise<CallRefreshTokenResult> {
    if (!refreshToken) {
      throw new AuthSessionMissingError()
    }

    // refreshing is already in progress
    if (this.refreshingDeferred) {
      return this.refreshingDeferred.promise
    }

    const debugName = `#_callRefreshToken(${refreshToken.substring(0, 5)}...)`

    this._debug(debugName, 'begin')

    try {
      this.refreshingDeferred = new Deferred<CallRefreshTokenResult>()

      const { data, error } = await this._refreshAccessToken(refreshToken)
      if (error) throw error
      if (!data.session) throw new AuthSessionMissingError()

      await this._saveSession(data.session)
      await this._notifyAllSubscribers('TOKEN_REFRESHED', data.session)

      const result = { data: data.session, error: null }

      this.refreshingDeferred.resolve(result)

      return result
    } catch (error) {
      this._debug(debugName, 'error', error)

      if (isAuthError(error)) {
        const result = { data: null, error }

        if (!isAuthRetryableFetchError(error)) {
          await this._removeSession()
        }

        this.refreshingDeferred?.resolve(result)

        return result
      }

      this.refreshingDeferred?.reject(error)
      throw error
    } finally {
      this.refreshingDeferred = null
      this._debug(debugName, 'end')
    }
  }

  private async _notifyAllSubscribers(
    event: AuthChangeEvent,
    session: Session | null,
    broadcast = true
  ) {
    const debugName = `#_notifyAllSubscribers(${event})`
    this._debug(debugName, 'begin', session, `broadcast = ${broadcast}`)

    try {
      if (this.broadcastChannel && broadcast) {
        this.broadcastChannel.postMessage({ event, session })
      }

      const errors: any[] = []
      const promises = Array.from(this.stateChangeEmitters.values()).map(async (x) => {
        try {
          await x.callback(event, session)
        } catch (e: any) {
          errors.push(e)
        }
      })

      await Promise.all(promises)

      if (errors.length > 0) {
        for (let i = 0; i < errors.length; i += 1) {
          console.error(errors[i])
        }

        throw errors[0]
      }
    } finally {
      this._debug(debugName, 'end')
    }
  }

  /**
   * set currentSession and currentUser
   * process to _startAutoRefreshToken if possible
   */
  private async _saveSession(session: Session) {
    this._debug('#_saveSession()', session)
    // _saveSession is always called whenever a new session has been acquired
    // so we can safely suppress the warning returned by future getSession calls
    this.suppressGetSessionWarning = true
    await removeItemAsync(this.storage, `${this.storageKey}-code-verifier`)
    // Create a shallow copy to work with, to avoid mutating the original session object if it's used elsewhere
    const sessionToProcess = { ...session }

    const userIsProxy =
      sessionToProcess.user && (sessionToProcess.user as any).__isUserNotAvailableProxy === true
    if (this.userStorage) {
      if (!userIsProxy && sessionToProcess.user) {
        // If it's a real user object, save it to userStorage.
        await setItemAsync(this.userStorage, this.storageKey + '-user', {
          user: sessionToProcess.user,
        })
      } else if (userIsProxy) {
        // If it's the proxy, it means user was not found in userStorage.
        // We should ensure no stale user data for this key exists in userStorage if we were to save null,
        // or simply not save the proxy. For now, we don't save the proxy here.
        // If there's a need to clear userStorage if user becomes proxy, that logic would go here.
      }

      // Prepare the main session data for primary storage: remove the user property before cloning
      // This is important because the original session.user might be the proxy
      const mainSessionData: Omit<Session, 'user'> & { user?: User } = { ...sessionToProcess }
      delete mainSessionData.user // Remove user (real or proxy) before cloning for main storage

      const clonedMainSessionData = deepClone(mainSessionData)
      await setItemAsync(this.storage, this.storageKey, clonedMainSessionData)
    } else {
      // No userStorage is configured.
      // In this case, session.user should ideally not be a proxy.
      // If it were, structuredClone would fail. This implies an issue elsewhere if user is a proxy here
      const clonedSession = deepClone(sessionToProcess) // sessionToProcess still has its original user property
      await setItemAsync(this.storage, this.storageKey, clonedSession)
    }
  }

  private async _removeSession() {
    this._debug('#_removeSession()')

    this.suppressGetSessionWarning = false

    await removeItemAsync(this.storage, this.storageKey)
    await removeItemAsync(this.storage, this.storageKey + '-code-verifier')
    await removeItemAsync(this.storage, this.storageKey + '-user')

    if (this.userStorage) {
      await removeItemAsync(this.userStorage, this.storageKey + '-user')
    }

    await this._notifyAllSubscribers('SIGNED_OUT', null)
  }

  /**
   * Removes any registered visibilitychange callback.
   *
   * {@see #startAutoRefresh}
   * {@see #stopAutoRefresh}
   */
  private _removeVisibilityChangedCallback() {
    this._debug('#_removeVisibilityChangedCallback()')

    const callback = this.visibilityChangedCallback
    this.visibilityChangedCallback = null

    try {
      if (callback && isBrowser() && window?.removeEventListener) {
        window.removeEventListener('visibilitychange', callback)
      }
    } catch (e) {
      console.error('removing visibilitychange callback failed', e)
    }
  }

  /**
   * This is the private implementation of {@link #startAutoRefresh}. Use this
   * within the library.
   */
  private async _startAutoRefresh() {
    await this._stopAutoRefresh()

    this._debug('#_startAutoRefresh()')

    const ticker = setInterval(() => this._autoRefreshTokenTick(), AUTO_REFRESH_TICK_DURATION_MS)
    this.autoRefreshTicker = ticker

    if (ticker && typeof ticker === 'object' && typeof ticker.unref === 'function') {
      // ticker is a NodeJS Timeout object that has an `unref` method
      // https://nodejs.org/api/timers.html#timeoutunref
      // When auto refresh is used in NodeJS (like for testing) the
      // `setInterval` is preventing the process from being marked as
      // finished and tests run endlessly. This can be prevented by calling
      // `unref()` on the returned object.
      ticker.unref()
      // @ts-expect-error TS has no context of Deno
    } else if (typeof Deno !== 'undefined' && typeof Deno.unrefTimer === 'function') {
      // similar like for NodeJS, but with the Deno API
      // https://deno.land/api@latest?unstable&s=Deno.unrefTimer
      // @ts-expect-error TS has no context of Deno
      Deno.unrefTimer(ticker)
    }

    // run the tick immediately, but in the next pass of the event loop so that
    // #_initialize can be allowed to complete without recursively waiting on
    // itself
    const timeout = setTimeout(async () => {
      await this.initializePromise
      await this._autoRefreshTokenTick()
    }, 0)
    this.autoRefreshTickTimeout = timeout

    if (timeout && typeof timeout === 'object' && typeof timeout.unref === 'function') {
      timeout.unref()
      // @ts-expect-error TS has no context of Deno
    } else if (typeof Deno !== 'undefined' && typeof Deno.unrefTimer === 'function') {
      // @ts-expect-error TS has no context of Deno
      Deno.unrefTimer(timeout)
    }
  }

  /**
   * This is the private implementation of {@link #stopAutoRefresh}. Use this
   * within the library.
   */
  private async _stopAutoRefresh() {
    this._debug('#_stopAutoRefresh()')

    const ticker = this.autoRefreshTicker
    this.autoRefreshTicker = null

    if (ticker) {
      clearInterval(ticker)
    }

    const timeout = this.autoRefreshTickTimeout
    this.autoRefreshTickTimeout = null

    if (timeout) {
      clearTimeout(timeout)
    }
  }

  /**
   * Starts an auto-refresh process in the background. The session is checked
   * every few seconds. Close to the time of expiration a process is started to
   * refresh the session. If refreshing fails it will be retried for as long as
   * necessary.
   *
   * If you set the {@link GoTrueClientOptions#autoRefreshToken} you don't need
   * to call this function, it will be called for you.
   *
   * On browsers the refresh process works only when the tab/window is in the
   * foreground to conserve resources as well as prevent race conditions and
   * flooding auth with requests. If you call this method any managed
   * visibility change callback will be removed and you must manage visibility
   * changes on your own.
   *
   * On non-browser platforms the refresh process works *continuously* in the
   * background, which may not be desirable. You should hook into your
   * platform's foreground indication mechanism and call these methods
   * appropriately to conserve resources.
   *
   * {@see #stopAutoRefresh}
   *
   * @category Auth
   *
   * @remarks
   * - Only useful in non-browser environments such as React Native or Electron.
   * - The Supabase Auth library automatically starts and stops proactively refreshing the session when a tab is focused or not.
   * - On non-browser platforms, such as mobile or desktop apps built with web technologies, the library is not able to effectively determine whether the application is _focused_ or not.
   * - To give this hint to the application, you should be calling this method when the app is in focus and calling `supabase.auth.stopAutoRefresh()` when it's out of focus.
   *
   * @example Start and stop auto refresh in React Native
   * ```js
   * import { AppState } from 'react-native'
   *
   * // make sure you register this only once!
   * AppState.addEventListener('change', (state) => {
   *   if (state === 'active') {
   *     supabase.auth.startAutoRefresh()
   *   } else {
   *     supabase.auth.stopAutoRefresh()
   *   }
   * })
   * ```
   */
  async startAutoRefresh() {
    this._removeVisibilityChangedCallback()
    await this._startAutoRefresh()
  }

  /**
   * Stops an active auto refresh process running in the background (if any).
   *
   * If you call this method any managed visibility change callback will be
   * removed and you must manage visibility changes on your own.
   *
   * See {@link #startAutoRefresh} for more details.
   *
   * @category Auth
   *
   * @remarks
   * - Only useful in non-browser environments such as React Native or Electron.
   * - The Supabase Auth library automatically starts and stops proactively refreshing the session when a tab is focused or not.
   * - On non-browser platforms, such as mobile or desktop apps built with web technologies, the library is not able to effectively determine whether the application is _focused_ or not.
   * - When your application goes in the background or out of focus, call this method to stop the proactive refreshing of the session.
   *
   * @example Start and stop auto refresh in React Native
   * ```js
   * import { AppState } from 'react-native'
   *
   * // make sure you register this only once!
   * AppState.addEventListener('change', (state) => {
   *   if (state === 'active') {
   *     supabase.auth.startAutoRefresh()
   *   } else {
   *     supabase.auth.stopAutoRefresh()
   *   }
   * })
   * ```
   */
  async stopAutoRefresh() {
    this._removeVisibilityChangedCallback()
    await this._stopAutoRefresh()
  }

  /**
   * Runs the auto refresh token tick.
   */
  private async _autoRefreshTokenTick() {
    this._debug('#_autoRefreshTokenTick()', 'begin')

    try {
      await this._acquireLock(0, async () => {
        try {
          const now = Date.now()

          try {
            return await this._useSession(async (result) => {
              const {
                data: { session },
              } = result

              if (!session || !session.refresh_token || !session.expires_at) {
                this._debug('#_autoRefreshTokenTick()', 'no session')
                return
              }

              // session will expire in this many ticks (or has already expired if <= 0)
              const expiresInTicks = Math.floor(
                (session.expires_at * 1000 - now) / AUTO_REFRESH_TICK_DURATION_MS
              )

              this._debug(
                '#_autoRefreshTokenTick()',
                `access token expires in ${expiresInTicks} ticks, a tick lasts ${AUTO_REFRESH_TICK_DURATION_MS}ms, refresh threshold is ${AUTO_REFRESH_TICK_THRESHOLD} ticks`
              )

              if (expiresInTicks <= AUTO_REFRESH_TICK_THRESHOLD) {
                await this._callRefreshToken(session.refresh_token)
              }
            })
          } catch (e: any) {
            console.error(
              'Auto refresh tick failed with error. This is likely a transient error.',
              e
            )
          }
        } finally {
          this._debug('#_autoRefreshTokenTick()', 'end')
        }
      })
    } catch (e: any) {
      if (e.isAcquireTimeout || e instanceof LockAcquireTimeoutError) {
        this._debug('auto refresh token tick lock not available')
      } else {
        throw e
      }
    }
  }

  /**
   * Registers callbacks on the browser / platform, which in-turn run
   * algorithms when the browser window/tab are in foreground. On non-browser
   * platforms it assumes always foreground.
   */
  private async _handleVisibilityChange() {
    this._debug('#_handleVisibilityChange()')

    if (!isBrowser() || !window?.addEventListener) {
      if (this.autoRefreshToken) {
        // in non-browser environments the refresh token ticker runs always
        this.startAutoRefresh()
      }

      return false
    }

    try {
      this.visibilityChangedCallback = async () => {
        try {
          await this._onVisibilityChanged(false)
        } catch (error) {
          this._debug('#visibilityChangedCallback', 'error', error)
        }
      }

      window?.addEventListener('visibilitychange', this.visibilityChangedCallback)

      // now immediately call the visbility changed callback to setup with the
      // current visbility state
      await this._onVisibilityChanged(true) // initial call
    } catch (error) {
      console.error('_handleVisibilityChange', error)
    }
  }

  /**
   * Callback registered with `window.addEventListener('visibilitychange')`.
   */
  private async _onVisibilityChanged(calledFromInitialize: boolean) {
    const methodName = `#_onVisibilityChanged(${calledFromInitialize})`
    this._debug(methodName, 'visibilityState', document.visibilityState)

    if (document.visibilityState === 'visible') {
      if (this.autoRefreshToken) {
        // in browser environments the refresh token ticker runs only on focused tabs
        // which prevents race conditions
        this._startAutoRefresh()
      }

      if (!calledFromInitialize) {
        // called when the visibility has changed, i.e. the browser
        // transitioned from hidden -> visible so we need to see if the session
        // should be recovered immediately... but to do that we need to acquire
        // the lock first asynchronously
        await this.initializePromise

        await this._acquireLock(this.lockAcquireTimeout, async () => {
          if (document.visibilityState !== 'visible') {
            this._debug(
              methodName,
              'acquired the lock to recover the session, but the browser visibilityState is no longer visible, aborting'
            )

            // visibility has changed while waiting for the lock, abort
            return
          }

          // recover the session
          await this._recoverAndRefresh()
        })
      }
    } else if (document.visibilityState === 'hidden') {
      if (this.autoRefreshToken) {
        this._stopAutoRefresh()
      }
    }
  }

  /**
   * Generates the relevant login URL for a third-party provider.
   * @param options.redirectTo A URL or mobile address to send the user to after they are confirmed.
   * @param options.scopes A space-separated list of scopes granted to the OAuth application.
   * @param options.queryParams An object of key-value pairs containing query parameters granted to the OAuth application.
   */
  private async _getUrlForProvider(
    url: string,
    provider: Provider,
    options: {
      redirectTo?: string
      scopes?: string
      queryParams?: { [key: string]: string }
      skipBrowserRedirect?: boolean
    }
  ) {
    const urlParams: string[] = [`provider=${encodeURIComponent(provider)}`]
    if (options?.redirectTo) {
      urlParams.push(`redirect_to=${encodeURIComponent(options.redirectTo)}`)
    }
    if (options?.scopes) {
      urlParams.push(`scopes=${encodeURIComponent(options.scopes)}`)
    }
    if (this.flowType === 'pkce') {
      const [codeChallenge, codeChallengeMethod] = await getCodeChallengeAndMethod(
        this.storage,
        this.storageKey
      )

      const flowParams = new URLSearchParams({
        code_challenge: `${encodeURIComponent(codeChallenge)}`,
        code_challenge_method: `${encodeURIComponent(codeChallengeMethod)}`,
      })
      urlParams.push(flowParams.toString())
    }
    if (options?.queryParams) {
      const query = new URLSearchParams(options.queryParams)
      urlParams.push(query.toString())
    }
    if (options?.skipBrowserRedirect) {
      urlParams.push(`skip_http_redirect=${options.skipBrowserRedirect}`)
    }

    return `${url}?${urlParams.join('&')}`
  }

  private async _unenroll(params: MFAUnenrollParams): Promise<AuthMFAUnenrollResponse> {
    try {
      return await this._useSession(async (result) => {
        const { data: sessionData, error: sessionError } = result
        if (sessionError) {
          return this._returnResult({ data: null, error: sessionError })
        }

        return await _request(this.fetch, 'DELETE', `${this.url}/factors/${params.factorId}`, {
          headers: this.headers,
          jwt: sessionData?.session?.access_token,
        })
      })
    } catch (error) {
      if (isAuthError(error)) {
        return this._returnResult({ data: null, error })
      }
      throw error
    }
  }

  /**
   * {@see GoTrueMFAApi#enroll}
   */
  private async _enroll(params: MFAEnrollTOTPParams): Promise<AuthMFAEnrollTOTPResponse>
  private async _enroll(params: MFAEnrollPhoneParams): Promise<AuthMFAEnrollPhoneResponse>
  private async _enroll(params: MFAEnrollWebauthnParams): Promise<AuthMFAEnrollWebauthnResponse>
  private async _enroll(params: MFAEnrollParams): Promise<AuthMFAEnrollResponse> {
    try {
      return await this._useSession(async (result) => {
        const { data: sessionData, error: sessionError } = result
        if (sessionError) {
          return this._returnResult({ data: null, error: sessionError })
        }

        const body = {
          friendly_name: params.friendlyName,
          factor_type: params.factorType,
          ...(params.factorType === 'phone'
            ? { phone: params.phone }
            : params.factorType === 'totp'
              ? { issuer: params.issuer }
              : {}),
        }

        const { data, error } = (await _request(this.fetch, 'POST', `${this.url}/factors`, {
          body,
          headers: this.headers,
          jwt: sessionData?.session?.access_token,
        })) as AuthMFAEnrollResponse
        if (error) {
          return this._returnResult({ data: null, error })
        }

        if (params.factorType === 'totp' && data.type === 'totp' && data?.totp?.qr_code) {
          data.totp.qr_code = `data:image/svg+xml;utf-8,${data.totp.qr_code}`
        }

        return this._returnResult({ data, error: null })
      })
    } catch (error) {
      if (isAuthError(error)) {
        return this._returnResult({ data: null, error })
      }
      throw error
    }
  }

  /**
   * {@see GoTrueMFAApi#verify}
   */
  private async _verify(params: MFAVerifyTOTPParams): Promise<AuthMFAVerifyResponse>
  private async _verify(params: MFAVerifyPhoneParams): Promise<AuthMFAVerifyResponse>
  private async _verify<T extends 'create' | 'request'>(
    params: MFAVerifyWebauthnParams<T>
  ): Promise<AuthMFAVerifyResponse>
  private async _verify(params: MFAVerifyParams): Promise<AuthMFAVerifyResponse> {
    return this._acquireLock(this.lockAcquireTimeout, async () => {
      try {
        return await this._useSession(async (result) => {
          const { data: sessionData, error: sessionError } = result
          if (sessionError) {
            return this._returnResult({ data: null, error: sessionError })
          }

          const body: StrictOmit<
            | Exclude<MFAVerifyParams, MFAVerifyWebauthnParams>
            /** Exclude out the webauthn params from here because we're going to need to serialize them in the response */
            | Prettify<
                StrictOmit<MFAVerifyWebauthnParams, 'webauthn'> & {
                  webauthn: Prettify<
                    StrictOmit<MFAVerifyWebauthnParamFields['webauthn'], 'credential_response'> & {
                      credential_response: PublicKeyCredentialJSON
                    }
                  >
                }
              >,
            /*  Exclude challengeId because the backend expects snake_case, and exclude factorId since it's passed in the path params */
            'challengeId' | 'factorId'
          > & {
            challenge_id: string
          } = {
            challenge_id: params.challengeId,
            ...('webauthn' in params
              ? {
                  webauthn: {
                    ...params.webauthn,
                    credential_response:
                      params.webauthn.type === 'create'
                        ? serializeCredentialCreationResponse(
                            params.webauthn.credential_response as RegistrationCredential
                          )
                        : serializeCredentialRequestResponse(
                            params.webauthn.credential_response as AuthenticationCredential
                          ),
                  },
                }
              : { code: params.code }),
          }

          const { data, error } = await _request(
            this.fetch,
            'POST',
            `${this.url}/factors/${params.factorId}/verify`,
            {
              body,
              headers: this.headers,
              jwt: sessionData?.session?.access_token,
            }
          )
          if (error) {
            return this._returnResult({ data: null, error })
          }

          await this._saveSession({
            expires_at: Math.round(Date.now() / 1000) + data.expires_in,
            ...data,
          })
          await this._notifyAllSubscribers('MFA_CHALLENGE_VERIFIED', data)

          return this._returnResult({ data, error })
        })
      } catch (error) {
        if (isAuthError(error)) {
          return this._returnResult({ data: null, error })
        }
        throw error
      }
    })
  }

  /**
   * {@see GoTrueMFAApi#challenge}
   */
  private async _challenge(
    params: MFAChallengeTOTPParams
  ): Promise<Prettify<AuthMFAChallengeTOTPResponse>>
  private async _challenge(
    params: MFAChallengePhoneParams
  ): Promise<Prettify<AuthMFAChallengePhoneResponse>>
  private async _challenge(
    params: MFAChallengeWebauthnParams
  ): Promise<Prettify<AuthMFAChallengeWebauthnResponse>>
  private async _challenge(params: MFAChallengeParams): Promise<AuthMFAChallengeResponse> {
    return this._acquireLock(this.lockAcquireTimeout, async () => {
      try {
        return await this._useSession(async (result) => {
          const { data: sessionData, error: sessionError } = result
          if (sessionError) {
            return this._returnResult({ data: null, error: sessionError })
          }

          const response = (await _request(
            this.fetch,
            'POST',
            `${this.url}/factors/${params.factorId}/challenge`,
            {
              body: params,
              headers: this.headers,
              jwt: sessionData?.session?.access_token,
            }
          )) as
            | Exclude<AuthMFAChallengeResponse, AuthMFAChallengeWebauthnResponse>
            /** The server will send `serialized` data, so we assert the serialized response */
            | AuthMFAChallengeWebauthnServerResponse

          if (response.error) {
            return response
          }

          const { data } = response

          if (data.type !== 'webauthn') {
            return { data, error: null }
          }

          switch (data.webauthn.type) {
            case 'create':
              return {
                data: {
                  ...data,
                  webauthn: {
                    ...data.webauthn,
                    credential_options: {
                      ...data.webauthn.credential_options,
                      publicKey: deserializeCredentialCreationOptions(
                        data.webauthn.credential_options.publicKey
                      ),
                    },
                  },
                },
                error: null,
              }
            case 'request':
              return {
                data: {
                  ...data,
                  webauthn: {
                    ...data.webauthn,
                    credential_options: {
                      ...data.webauthn.credential_options,
                      publicKey: deserializeCredentialRequestOptions(
                        data.webauthn.credential_options.publicKey
                      ),
                    },
                  },
                },
                error: null,
              }
          }
        })
      } catch (error) {
        if (isAuthError(error)) {
          return this._returnResult({ data: null, error })
        }
        throw error
      }
    })
  }

  /**
   * {@see GoTrueMFAApi#challengeAndVerify}
   */
  private async _challengeAndVerify(
    params: MFAChallengeAndVerifyParams
  ): Promise<AuthMFAVerifyResponse> {
    // both _challenge and _verify independently acquire the lock, so no need
    // to acquire it here

    const { data: challengeData, error: challengeError } = await this._challenge({
      factorId: params.factorId,
    })
    if (challengeError) {
      return this._returnResult({ data: null, error: challengeError })
    }

    return await this._verify({
      factorId: params.factorId,
      challengeId: challengeData.id,
      code: params.code,
    })
  }

  /**
   * {@see GoTrueMFAApi#listFactors}
   */
  private async _listFactors(): Promise<AuthMFAListFactorsResponse> {
    // use #getUser instead of #_getUser as the former acquires a lock
    const {
      data: { user },
      error: userError,
    } = await this.getUser()
    if (userError) {
      return { data: null, error: userError }
    }

    const data: AuthMFAListFactorsResponse['data'] = {
      all: [],
      phone: [],
      totp: [],
      webauthn: [],
    }

    // loop over the factors ONCE
    for (const factor of user?.factors ?? []) {
      data.all.push(factor)
      if (factor.status === 'verified') {
        ;(data[factor.factor_type] as (typeof factor)[]).push(factor)
      }
    }

    return {
      data,
      error: null,
    }
  }

  /**
   * {@see GoTrueMFAApi#getAuthenticatorAssuranceLevel}
   */
  private async _getAuthenticatorAssuranceLevel(
    jwt?: string
  ): Promise<AuthMFAGetAuthenticatorAssuranceLevelResponse> {
    if (jwt) {
      try {
        const { payload } = decodeJWT(jwt)

        let currentLevel: AuthenticatorAssuranceLevels | null = null
        if (payload.aal) {
          currentLevel = payload.aal
        }

        let nextLevel: AuthenticatorAssuranceLevels | null = currentLevel

        const {
          data: { user },
          error: userError,
        } = await this.getUser(jwt)

        if (userError) {
          return this._returnResult({ data: null, error: userError })
        }

        const verifiedFactors =
          user?.factors?.filter((factor: Factor) => factor.status === 'verified') ?? []

        if (verifiedFactors.length > 0) {
          nextLevel = 'aal2'
        }

        const currentAuthenticationMethods = payload.amr || []

        return { data: { currentLevel, nextLevel, currentAuthenticationMethods }, error: null }
      } catch (error) {
        if (isAuthError(error)) {
          return this._returnResult({ data: null, error })
        }
        throw error
      }
    }

    const {
      data: { session },
      error: sessionError,
    } = await this.getSession()

    if (sessionError) {
      return this._returnResult({ data: null, error: sessionError })
    }
    if (!session) {
      return {
        data: { currentLevel: null, nextLevel: null, currentAuthenticationMethods: [] },
        error: null,
      }
    }

    const { payload } = decodeJWT(session.access_token)

    let currentLevel: AuthenticatorAssuranceLevels | null = null

    if (payload.aal) {
      currentLevel = payload.aal
    }

    let nextLevel: AuthenticatorAssuranceLevels | null = currentLevel

    const verifiedFactors =
      session.user.factors?.filter((factor: Factor) => factor.status === 'verified') ?? []

    if (verifiedFactors.length > 0) {
      nextLevel = 'aal2'
    }

    const currentAuthenticationMethods = payload.amr || []

    return { data: { currentLevel, nextLevel, currentAuthenticationMethods }, error: null }
  }

  /**
   * Retrieves details about an OAuth authorization request.
   * Only relevant when the OAuth 2.1 server is enabled in Supabase Auth.
   *
   * Returns authorization details including client info, scopes, and user information.
   * If the response includes only a redirect_url field, it means consent was already given - the caller
   * should handle the redirect manually if needed.
   */
  private async _getAuthorizationDetails(
    authorizationId: string
  ): Promise<AuthOAuthAuthorizationDetailsResponse> {
    try {
      return await this._useSession(async (result) => {
        const {
          data: { session },
          error: sessionError,
        } = result

        if (sessionError) {
          return this._returnResult({ data: null, error: sessionError })
        }

        if (!session) {
          return this._returnResult({ data: null, error: new AuthSessionMissingError() })
        }

        return await _request(
          this.fetch,
          'GET',
          `${this.url}/oauth/authorizations/${authorizationId}`,
          {
            headers: this.headers,
            jwt: session.access_token,
            xform: (data: any) => ({ data, error: null }),
          }
        )
      })
    } catch (error) {
      if (isAuthError(error)) {
        return this._returnResult({ data: null, error })
      }

      throw error
    }
  }

  /**
   * Approves an OAuth authorization request.
   * Only relevant when the OAuth 2.1 server is enabled in Supabase Auth.
   */
  private async _approveAuthorization(
    authorizationId: string,
    options?: { skipBrowserRedirect?: boolean }
  ): Promise<AuthOAuthConsentResponse> {
    try {
      return await this._useSession(async (result) => {
        const {
          data: { session },
          error: sessionError,
        } = result

        if (sessionError) {
          return this._returnResult({ data: null, error: sessionError })
        }

        if (!session) {
          return this._returnResult({ data: null, error: new AuthSessionMissingError() })
        }

        const response = await _request(
          this.fetch,
          'POST',
          `${this.url}/oauth/authorizations/${authorizationId}/consent`,
          {
            headers: this.headers,
            jwt: session.access_token,
            body: { action: 'approve' },
            xform: (data: any) => ({ data, error: null }),
          }
        )

        if (response.data && response.data.redirect_url) {
          // Automatically redirect in browser unless skipBrowserRedirect is true
          if (isBrowser() && !options?.skipBrowserRedirect) {
            window.location.assign(response.data.redirect_url)
          }
        }

        return response
      })
    } catch (error) {
      if (isAuthError(error)) {
        return this._returnResult({ data: null, error })
      }

      throw error
    }
  }

  /**
   * Denies an OAuth authorization request.
   * Only relevant when the OAuth 2.1 server is enabled in Supabase Auth.
   */
  private async _denyAuthorization(
    authorizationId: string,
    options?: { skipBrowserRedirect?: boolean }
  ): Promise<AuthOAuthConsentResponse> {
    try {
      return await this._useSession(async (result) => {
        const {
          data: { session },
          error: sessionError,
        } = result

        if (sessionError) {
          return this._returnResult({ data: null, error: sessionError })
        }

        if (!session) {
          return this._returnResult({ data: null, error: new AuthSessionMissingError() })
        }

        const response = await _request(
          this.fetch,
          'POST',
          `${this.url}/oauth/authorizations/${authorizationId}/consent`,
          {
            headers: this.headers,
            jwt: session.access_token,
            body: { action: 'deny' },
            xform: (data: any) => ({ data, error: null }),
          }
        )

        if (response.data && response.data.redirect_url) {
          // Automatically redirect in browser unless skipBrowserRedirect is true
          if (isBrowser() && !options?.skipBrowserRedirect) {
            window.location.assign(response.data.redirect_url)
          }
        }

        return response
      })
    } catch (error) {
      if (isAuthError(error)) {
        return this._returnResult({ data: null, error })
      }

      throw error
    }
  }

  /**
   * Lists all OAuth grants that the authenticated user has authorized.
   * Only relevant when the OAuth 2.1 server is enabled in Supabase Auth.
   */
  private async _listOAuthGrants(): Promise<AuthOAuthGrantsResponse> {
    try {
      return await this._useSession(async (result) => {
        const {
          data: { session },
          error: sessionError,
        } = result

        if (sessionError) {
          return this._returnResult({ data: null, error: sessionError })
        }

        if (!session) {
          return this._returnResult({ data: null, error: new AuthSessionMissingError() })
        }

        return await _request(this.fetch, 'GET', `${this.url}/user/oauth/grants`, {
          headers: this.headers,
          jwt: session.access_token,
          xform: (data: any) => ({ data, error: null }),
        })
      })
    } catch (error) {
      if (isAuthError(error)) {
        return this._returnResult({ data: null, error })
      }

      throw error
    }
  }

  /**
   * Revokes a user's OAuth grant for a specific client.
   * Only relevant when the OAuth 2.1 server is enabled in Supabase Auth.
   */
  private async _revokeOAuthGrant(options: {
    clientId: string
  }): Promise<AuthOAuthRevokeGrantResponse> {
    try {
      return await this._useSession(async (result) => {
        const {
          data: { session },
          error: sessionError,
        } = result

        if (sessionError) {
          return this._returnResult({ data: null, error: sessionError })
        }

        if (!session) {
          return this._returnResult({ data: null, error: new AuthSessionMissingError() })
        }

        await _request(this.fetch, 'DELETE', `${this.url}/user/oauth/grants`, {
          headers: this.headers,
          jwt: session.access_token,
          query: { client_id: options.clientId },
          noResolveJson: true,
        })
        return { data: {}, error: null }
      })
    } catch (error) {
      if (isAuthError(error)) {
        return this._returnResult({ data: null, error })
      }

      throw error
    }
  }

  private async fetchJwk(kid: string, jwks: { keys: JWK[] } = { keys: [] }): Promise<JWK | null> {
    // try fetching from the supplied jwks
    let jwk = jwks.keys.find((key) => key.kid === kid)
    if (jwk) {
      return jwk
    }

    const now = Date.now()

    // try fetching from cache
    jwk = this.jwks.keys.find((key) => key.kid === kid)

    // jwk exists and jwks isn't stale
    if (jwk && this.jwks_cached_at + JWKS_TTL > now) {
      return jwk
    }
    // jwk isn't cached in memory so we need to fetch it from the well-known endpoint
    const { data, error } = await _request(this.fetch, 'GET', `${this.url}/.well-known/jwks.json`, {
      headers: this.headers,
    })
    if (error) {
      throw error
    }
    if (!data.keys || data.keys.length === 0) {
      return null
    }

    this.jwks = data
    this.jwks_cached_at = now

    // Find the signing key
    jwk = data.keys.find((key: any) => key.kid === kid)
    if (!jwk) {
      return null
    }
    return jwk
  }

  /**
   * Extracts the JWT claims present in the access token by first verifying the
   * JWT against the server's JSON Web Key Set endpoint
   * `/.well-known/jwks.json` which is often cached, resulting in significantly
   * faster responses. Prefer this method over {@link #getUser} which always
   * sends a request to the Auth server for each JWT.
   *
   * If the project is not using an asymmetric JWT signing key (like ECC or
   * RSA) it always sends a request to the Auth server (similar to {@link
   * #getUser}) to verify the JWT.
   *
   * @param jwt An optional specific JWT you wish to verify, not the one you
   *            can obtain from {@link #getSession}.
   * @param options Various additional options that allow you to customize the
   *                behavior of this method.
   *
   * @category Auth
   *
   * @remarks
   * - Parses the user's [access token](/docs/guides/auth/sessions#access-token-jwt-claims) as a [JSON Web Token (JWT)](/docs/guides/auth/jwts) and returns its components if valid and not expired.
   * - If your project is using asymmetric JWT signing keys, then the verification is done locally usually without a network request using the [WebCrypto API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API).
   * - A network request is sent to your project's JWT signing key discovery endpoint `https://project-id.supabase.co/auth/v1/.well-known/jwks.json`, which is cached locally. If your environment is ephemeral, such as a Lambda function that is destroyed after every request, a network request will be sent for each new invocation. Supabase provides a network-edge cache providing fast responses for these situations.
   * - If the user's access token is about to expire when calling this function, the user's session will first be refreshed before validating the JWT.
   * - If your project is using a symmetric secret to sign the JWT, it always sends a request similar to `getUser()` to validate the JWT at the server before returning the decoded token. This is also used if the WebCrypto API is not available in the environment. Make sure you polyfill it in such situations.
   * - The returned claims can be customized per project using the [Custom Access Token Hook](/docs/guides/auth/auth-hooks/custom-access-token-hook).
   *
   * @example Get JWT claims, header and signature
   * ```js
   * const { data, error } = await supabase.auth.getClaims()
   * ```
   *
   * @exampleResponse Get JWT claims, header and signature
   * ```json
   * {
   *   "data": {
   *     "claims": {
   *       "aal": "aal1",
   *       "amr": [{
   *         "method": "email",
   *         "timestamp": 1715766000
   *       }],
   *       "app_metadata": {},
   *       "aud": "authenticated",
   *       "email": "example@email.com",
   *       "exp": 1715769600,
   *       "iat": 1715766000,
   *       "is_anonymous": false,
   *       "iss": "https://project-id.supabase.co/auth/v1",
   *       "phone": "+13334445555",
   *       "role": "authenticated",
   *       "session_id": "11111111-1111-1111-1111-111111111111",
   *       "sub": "11111111-1111-1111-1111-111111111111",
   *       "user_metadata": {}
   *     },
   *     "header": {
   *       "alg": "RS256",
   *       "typ": "JWT",
   *       "kid": "11111111-1111-1111-1111-111111111111"
   *     },
   *     "signature": [/** Uint8Array *\/],
   *   },
   *   "error": null
   * }
   * ```
   */
  async getClaims(
    jwt?: string,
    options: {
      /**
       * @deprecated Please use options.jwks instead.
       */
      keys?: JWK[]

      /** If set to `true` the `exp` claim will not be validated against the current time. */
      allowExpired?: boolean

      /** If set, this JSON Web Key Set is going to have precedence over the cached value available on the server. */
      jwks?: { keys: JWK[] }
    } = {}
  ): Promise<
    | {
        data: { claims: JwtPayload; header: JwtHeader; signature: Uint8Array }
        error: null
      }
    | { data: null; error: AuthError }
    | { data: null; error: null }
  > {
    try {
      let token = jwt
      if (!token) {
        const { data, error } = await this.getSession()
        if (error || !data.session) {
          return this._returnResult({ data: null, error })
        }
        token = data.session.access_token
      }

      const {
        header,
        payload,
        signature,
        raw: { header: rawHeader, payload: rawPayload },
      } = decodeJWT(token)

      if (!options?.allowExpired) {
        // Reject expired JWTs should only happen if jwt argument was passed
        validateExp(payload.exp)
      }

      const signingKey =
        !header.alg ||
        header.alg.startsWith('HS') ||
        !header.kid ||
        !('crypto' in globalThis && 'subtle' in globalThis.crypto)
          ? null
          : await this.fetchJwk(header.kid, options?.keys ? { keys: options.keys } : options?.jwks)

      // If symmetric algorithm or WebCrypto API is unavailable, fallback to getUser()
      if (!signingKey) {
        const { error } = await this.getUser(token)
        if (error) {
          throw error
        }
        // getUser succeeds so the claims in the JWT can be trusted
        return {
          data: {
            claims: payload,
            header,
            signature,
          },
          error: null,
        }
      }

      const algorithm = getAlgorithm(header.alg)

      // Convert JWK to CryptoKey
      const publicKey = await crypto.subtle.importKey('jwk', signingKey, algorithm, true, [
        'verify',
      ])

      // Verify the signature
      const isValid = await crypto.subtle.verify(
        algorithm,
        publicKey,
        signature,
        stringToUint8Array(`${rawHeader}.${rawPayload}`)
      )

      if (!isValid) {
        throw new AuthInvalidJwtError('Invalid JWT signature')
      }

      // If verification succeeds, decode and return claims
      return {
        data: {
          claims: payload,
          header,
          signature,
        },
        error: null,
      }
    } catch (error) {
      if (isAuthError(error)) {
        return this._returnResult({ data: null, error })
      }
      throw error
    }
  }

  // --- Passkey Methods ---

  /**
   * Sign in with a passkey. Handles the full WebAuthn ceremony:
   * 1. Fetches authentication challenge from server
   * 2. Prompts user via navigator.credentials.get()
   * 3. Verifies credential with server and creates session
   *
   * Requires `auth.experimental.passkey: true`.
   */
  async signInWithPasskey(
    credentials?: SignInWithPasskeyCredentials
  ): Promise<AuthPasskeyAuthenticationVerifyResponse> {
    assertPasskeyExperimentalEnabled(this.experimental)
    try {
      if (!browserSupportsWebAuthn()) {
        return this._returnResult({
          data: null,
          error: new AuthUnknownError('Browser does not support WebAuthn', null),
        })
      }

      // 1. Get challenge options from server
      const { data: options, error: optionsError } = await this._startPasskeyAuthentication({
        options: { captchaToken: credentials?.options?.captchaToken },
      })
      if (optionsError || !options) {
        return this._returnResult({ data: null, error: optionsError })
      }

      // 2. Deserialize and prompt user via browser WebAuthn API
      const publicKeyOptions = deserializeCredentialRequestOptions(options.options)
      const signal = credentials?.options?.signal ?? webAuthnAbortService.createNewAbortSignal()
      const { data: credential, error: credentialError } = await getCredential({
        publicKey: publicKeyOptions,
        signal,
      })
      if (credentialError || !credential) {
        return this._returnResult({
          data: null,
          error: credentialError ?? new AuthUnknownError('WebAuthn ceremony failed', null),
        })
      }

      // 3. Serialize and verify with server
      const serialized = serializeCredentialRequestResponse(credential)
      return this._verifyPasskeyAuthentication({
        challengeId: options.challenge_id,
        credential: serialized,
      })
    } catch (error) {
      if (isAuthError(error)) {
        return this._returnResult({ data: null, error })
      }
      throw error
    }
  }

  /**
   * Register a passkey for the current authenticated user. Handles the full WebAuthn ceremony:
   * 1. Fetches registration challenge from server
   * 2. Prompts user via navigator.credentials.create()
   * 3. Verifies credential with server
   *
   * Requires an active session. Requires `auth.experimental.passkey: true`.
   */
  async registerPasskey(
    credentials?: RegisterPasskeyCredentials
  ): Promise<AuthPasskeyRegistrationVerifyResponse> {
    assertPasskeyExperimentalEnabled(this.experimental)
    try {
      if (!browserSupportsWebAuthn()) {
        return this._returnResult({
          data: null,
          error: new AuthUnknownError('Browser does not support WebAuthn', null),
        })
      }

      // 1. Get challenge options from server
      const { data: options, error: optionsError } = await this._startPasskeyRegistration()
      if (optionsError || !options) {
        return this._returnResult({ data: null, error: optionsError })
      }

      // 2. Deserialize and prompt user via browser WebAuthn API
      const publicKeyOptions = deserializeCredentialCreationOptions(options.options)
      const signal = credentials?.options?.signal ?? webAuthnAbortService.createNewAbortSignal()
      const { data: credential, error: credentialError } = await createCredential({
        publicKey: publicKeyOptions,
        signal,
      })
      if (credentialError || !credential) {
        return this._returnResult({
          data: null,
          error: credentialError ?? new AuthUnknownError('WebAuthn ceremony failed', null),
        })
      }

      // 3. Serialize and verify with server
      const serialized = serializeCredentialCreationResponse(credential)
      return this._verifyPasskeyRegistration({
        challengeId: options.challenge_id,
        credential: serialized,
      })
    } catch (error) {
      if (isAuthError(error)) {
        return this._returnResult({ data: null, error })
      }
      throw error
    }
  }

  /**
   * Start passkey registration for the current authenticated user.
   * Returns WebAuthn credential creation options to pass to navigator.credentials.create().
   */
  private async _startPasskeyRegistration(): Promise<AuthPasskeyRegistrationOptionsResponse> {
    assertPasskeyExperimentalEnabled(this.experimental)
    try {
      return await this._useSession(async (result) => {
        const {
          data: { session },
          error: sessionError,
        } = result
        if (sessionError) {
          return this._returnResult({ data: null, error: sessionError })
        }
        if (!session) {
          return this._returnResult({ data: null, error: new AuthSessionMissingError() })
        }
        const { data, error } = await _request(
          this.fetch,
          'POST',
          `${this.url}/passkeys/registration/options`,
          {
            headers: this.headers,
            jwt: session.access_token,
            body: {},
          }
        )
        if (error) {
          return this._returnResult({ data: null, error })
        }
        return this._returnResult({ data, error: null })
      })
    } catch (error) {
      if (isAuthError(error)) {
        return this._returnResult({ data: null, error })
      }
      throw error
    }
  }

  /**
   * Verify passkey registration with the credential response.
   * The credentialResponse should be the serialized output of navigator.credentials.create().
   */
  private async _verifyPasskeyRegistration(
    params: VerifyPasskeyRegistrationParams
  ): Promise<AuthPasskeyRegistrationVerifyResponse> {
    assertPasskeyExperimentalEnabled(this.experimental)
    try {
      return await this._useSession(async (result) => {
        const {
          data: { session },
          error: sessionError,
        } = result
        if (sessionError) {
          return this._returnResult({ data: null, error: sessionError })
        }
        if (!session) {
          return this._returnResult({ data: null, error: new AuthSessionMissingError() })
        }
        const { data, error } = await _request(
          this.fetch,
          'POST',
          `${this.url}/passkeys/registration/verify`,
          {
            headers: this.headers,
            jwt: session.access_token,
            body: {
              challenge_id: params.challengeId,
              credential: params.credential,
            },
          }
        )
        if (error) {
          return this._returnResult({ data: null, error })
        }
        return this._returnResult({ data, error: null })
      })
    } catch (error) {
      if (isAuthError(error)) {
        return this._returnResult({ data: null, error })
      }
      throw error
    }
  }

  /**
   * Start passkey authentication.
   * Returns WebAuthn credential request options to pass to navigator.credentials.get().
   */
  private async _startPasskeyAuthentication(
    params?: StartPasskeyAuthenticationParams
  ): Promise<AuthPasskeyAuthenticationOptionsResponse> {
    assertPasskeyExperimentalEnabled(this.experimental)
    try {
      const { data, error } = await _request(
        this.fetch,
        'POST',
        `${this.url}/passkeys/authentication/options`,
        {
          headers: this.headers,
          body: {
            gotrue_meta_security: { captcha_token: params?.options?.captchaToken },
          },
        }
      )
      if (error) {
        return this._returnResult({ data: null, error })
      }
      return this._returnResult({ data, error: null })
    } catch (error) {
      if (isAuthError(error)) {
        return this._returnResult({ data: null, error })
      }
      throw error
    }
  }

  /**
   * Verify passkey authentication and create a session.
   * The credential should be the serialized output of navigator.credentials.get().
   */
  private async _verifyPasskeyAuthentication(
    params: VerifyPasskeyAuthenticationParams
  ): Promise<AuthPasskeyAuthenticationVerifyResponse> {
    assertPasskeyExperimentalEnabled(this.experimental)
    try {
      const { data, error } = await _request(
        this.fetch,
        'POST',
        `${this.url}/passkeys/authentication/verify`,
        {
          headers: this.headers,
          body: {
            challenge_id: params.challengeId,
            credential: params.credential,
          },
          xform: _sessionResponse,
        }
      )
      if (error) {
        return this._returnResult({ data: null, error })
      }
      if (data.session) {
        await this._saveSession(data.session)
        await this._notifyAllSubscribers('SIGNED_IN', data.session)
      }
      return this._returnResult({ data, error: null })
    } catch (error) {
      if (isAuthError(error)) {
        return this._returnResult({ data: null, error })
      }
      throw error
    }
  }

  /**
   * List all passkeys for the current user.
   */
  private async _listPasskeys(): Promise<AuthPasskeyListResponse> {
    assertPasskeyExperimentalEnabled(this.experimental)
    try {
      return await this._useSession(async (result) => {
        const {
          data: { session },
          error: sessionError,
        } = result
        if (sessionError) {
          return this._returnResult({ data: null, error: sessionError })
        }
        if (!session) {
          return this._returnResult({ data: null, error: new AuthSessionMissingError() })
        }
        const { data, error } = await _request(this.fetch, 'GET', `${this.url}/passkeys`, {
          headers: this.headers,
          jwt: session.access_token,
          xform: (data: any) => ({ data, error: null }),
        })
        if (error) {
          return this._returnResult({ data: null, error })
        }
        return this._returnResult({ data, error: null })
      })
    } catch (error) {
      if (isAuthError(error)) {
        return this._returnResult({ data: null, error })
      }
      throw error
    }
  }

  /**
   * Update a passkey.
   */
  private async _updatePasskey(params: PasskeyUpdateParams): Promise<AuthPasskeyUpdateResponse> {
    assertPasskeyExperimentalEnabled(this.experimental)
    try {
      return await this._useSession(async (result) => {
        const {
          data: { session },
          error: sessionError,
        } = result
        if (sessionError) {
          return this._returnResult({ data: null, error: sessionError })
        }
        if (!session) {
          return this._returnResult({ data: null, error: new AuthSessionMissingError() })
        }
        const { data, error } = await _request(
          this.fetch,
          'PATCH',
          `${this.url}/passkeys/${params.passkeyId}`,
          {
            headers: this.headers,
            jwt: session.access_token,
            body: { friendly_name: params.friendlyName },
          }
        )
        if (error) {
          return this._returnResult({ data: null, error })
        }
        return this._returnResult({ data, error: null })
      })
    } catch (error) {
      if (isAuthError(error)) {
        return this._returnResult({ data: null, error })
      }
      throw error
    }
  }

  /**
   * Delete a passkey.
   */
  private async _deletePasskey(params: PasskeyDeleteParams): Promise<AuthPasskeyDeleteResponse> {
    assertPasskeyExperimentalEnabled(this.experimental)
    try {
      return await this._useSession(async (result) => {
        const {
          data: { session },
          error: sessionError,
        } = result
        if (sessionError) {
          return this._returnResult({ data: null, error: sessionError })
        }
        if (!session) {
          return this._returnResult({ data: null, error: new AuthSessionMissingError() })
        }
        const { error } = await _request(
          this.fetch,
          'DELETE',
          `${this.url}/passkeys/${params.passkeyId}`,
          {
            headers: this.headers,
            jwt: session.access_token,
            noResolveJson: true,
          }
        )
        if (error) {
          return this._returnResult({ data: null, error })
        }
        return this._returnResult({ data: null, error: null })
      })
    } catch (error) {
      if (isAuthError(error)) {
        return this._returnResult({ data: null, error })
      }
      throw error
    }
  }
}
