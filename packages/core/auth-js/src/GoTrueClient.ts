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
  decodeJWT,
  deepClone,
  Deferred,
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
  uuid,
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
  deserializeCredentialCreationOptions,
  deserializeCredentialRequestOptions,
  serializeCredentialCreationResponse,
  serializeCredentialRequestResponse,
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
  private static nextInstanceID = 0

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
  protected stateChangeEmitters: Map<string, Subscription> = new Map()
  protected autoRefreshTicker: ReturnType<typeof setInterval> | null = null
  protected visibilityChangedCallback: (() => Promise<any>) | null = null
  protected refreshingDeferred: Deferred<CallRefreshTokenResult> | null = null
  /**
   * Keeps track of the async client initialization.
   * When null or not yet resolved the auth state is `unknown`
   * Once resolved the auth state is known and it's safe to call any further client methods.
   * Keep extra care to never reject or throw uncaught errors
   */
  protected initializePromise: Promise<InitializeResult> | null = null
  protected detectSessionInUrl = true
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

  /**
   * Used to broadcast state change events to other tabs listening.
   */
  protected broadcastChannel: BroadcastChannel | null = null

  protected logDebugMessages: boolean
  protected logger: (message: string, ...args: any[]) => void = console.log

  /**
   * Create a new client for use in the browser.
   */
  constructor(options: GoTrueClientOptions) {
    this.instanceID = GoTrueClient.nextInstanceID
    GoTrueClient.nextInstanceID += 1

    if (this.instanceID > 0 && isBrowser()) {
      console.warn(
        'Multiple GoTrueClient instances detected in the same browser context. It is not an error, but this should be avoided as it may produce undefined behavior when used concurrently under the same storage key.'
      )
    }

    const settings = { ...DEFAULT_OPTIONS, ...options }

    this.logDebugMessages = !!settings.debug
    if (typeof settings.debug === 'function') {
      this.logger = settings.debug
    }

    this.persistSession = settings.persistSession
    this.storageKey = settings.storageKey
    this.autoRefreshToken = settings.autoRefreshToken
    this.admin = new GoTrueAdminApi({
      url: settings.url,
      headers: settings.headers,
      fetch: settings.fetch,
    })

    this.url = settings.url
    this.headers = settings.headers
    this.fetch = resolveFetch(settings.fetch)
    this.lock = settings.lock || lockNoOp
    this.detectSessionInUrl = settings.detectSessionInUrl
    this.flowType = settings.flowType
    this.hasCustomAuthorizationHeader = settings.hasCustomAuthorizationHeader

    if (settings.lock) {
      this.lock = settings.lock
    } else if (isBrowser() && globalThis?.navigator?.locks) {
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

        await this._notifyAllSubscribers(event.data.event, event.data.session, false) // broadcast = false so we don't get an endless loop of messages
      })
    }

    this.initialize()
  }

  private _debug(...args: any[]): GoTrueClient {
    if (this.logDebugMessages) {
      this.logger(
        `GoTrueClient@${this.instanceID} (${version}) ${new Date().toISOString()}`,
        ...args
      )
    }

    return this
  }

  /**
   * Initializes the client session either from the url or from storage.
   * This method is automatically called when instantiating the client, but should also be called
   * manually when checking for an error from an auth redirect (oauth, magiclink, password recovery, etc).
   */
  async initialize(): Promise<InitializeResult> {
    if (this.initializePromise) {
      return await this.initializePromise
    }

    this.initializePromise = (async () => {
      return await this._acquireLock(-1, async () => {
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
      const params = parseParametersFromURL(window.location.href)
      let callbackUrlType = 'none'
      if (this._isImplicitGrantCallback(params)) {
        callbackUrlType = 'implicit'
      } else if (await this._isPKCECallback(params)) {
        callbackUrlType = 'pkce'
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

          // failed login attempt via url,
          // remove old session as in verifyOtp, signUp and signInWith*
          await this._removeSession()

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
        return { error }
      }

      return {
        error: new AuthUnknownError('Unexpected error during initialization', error),
      }
    } finally {
      await this._handleVisibilityChange()
      this._debug('#_initialize()', 'end')
    }
  }

  /**
   * Creates a new anonymous user.
   *
   * @returns A session where the is_anonymous claim in the access token JWT set to true
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
        return { data: { user: null, session: null }, error: error }
      }
      const session: Session | null = data.session
      const user: User | null = data.user

      if (data.session) {
        await this._saveSession(data.session)
        await this._notifyAllSubscribers('SIGNED_IN', session)
      }

      return { data: { user, session }, error: null }
    } catch (error) {
      if (isAuthError(error)) {
        return { data: { user: null, session: null }, error }
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
        return { data: { user: null, session: null }, error: error }
      }

      const session: Session | null = data.session
      const user: User | null = data.user

      if (data.session) {
        await this._saveSession(data.session)
        await this._notifyAllSubscribers('SIGNED_IN', session)
      }

      return { data: { user, session }, error: null }
    } catch (error) {
      if (isAuthError(error)) {
        return { data: { user: null, session: null }, error }
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
        return { data: { user: null, session: null }, error }
      } else if (!data || !data.session || !data.user) {
        return { data: { user: null, session: null }, error: new AuthInvalidTokenResponseError() }
      }
      if (data.session) {
        await this._saveSession(data.session)
        await this._notifyAllSubscribers('SIGNED_IN', data.session)
      }
      return {
        data: {
          user: data.user,
          session: data.session,
          ...(data.weak_password ? { weakPassword: data.weak_password } : null),
        },
        error,
      }
    } catch (error) {
      if (isAuthError(error)) {
        return { data: { user: null, session: null }, error }
      }
      throw error
    }
  }

  /**
   * Log in an existing user via a third-party provider.
   * This method supports the PKCE flow.
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
   */
  async exchangeCodeForSession(authCode: string): Promise<AuthTokenResponse> {
    await this.initializePromise

    return this._acquireLock(-1, async () => {
      return this._exchangeCodeForSession(authCode)
    })
  }

  /**
   * Signs in a user by verifying a message signed by the user's private key.
   * Supports Ethereum (via Sign-In-With-Ethereum) & Solana (Sign-In-With-Solana) standards,
   * both of which derive from the EIP-4361 standard
   * With slight variation on Solana's side.
   * @reference https://eips.ethereum.org/EIPS/eip-4361
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
        return {
          data: { user: null, session: null },
          error: new AuthInvalidTokenResponseError(),
        }
      }
      if (data.session) {
        await this._saveSession(data.session)
        await this._notifyAllSubscribers('SIGNED_IN', data.session)
      }
      return { data: { ...data }, error }
    } catch (error) {
      if (isAuthError(error)) {
        return { data: { user: null, session: null }, error }
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
        return {
          data: { user: null, session: null },
          error: new AuthInvalidTokenResponseError(),
        }
      }
      if (data.session) {
        await this._saveSession(data.session)
        await this._notifyAllSubscribers('SIGNED_IN', data.session)
      }
      return { data: { ...data }, error }
    } catch (error) {
      if (isAuthError(error)) {
        return { data: { user: null, session: null }, error }
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
        return {
          data: { user: null, session: null, redirectType: null },
          error: new AuthInvalidTokenResponseError(),
        }
      }
      if (data.session) {
        await this._saveSession(data.session)
        await this._notifyAllSubscribers('SIGNED_IN', data.session)
      }
      return { data: { ...data, redirectType: redirectType ?? null }, error }
    } catch (error) {
      if (isAuthError(error)) {
        return { data: { user: null, session: null, redirectType: null }, error }
      }

      throw error
    }
  }

  /**
   * Allows signing in with an OIDC ID token. The authentication provider used
   * should be enabled and configured.
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
        return { data: { user: null, session: null }, error }
      } else if (!data || !data.session || !data.user) {
        return {
          data: { user: null, session: null },
          error: new AuthInvalidTokenResponseError(),
        }
      }
      if (data.session) {
        await this._saveSession(data.session)
        await this._notifyAllSubscribers('SIGNED_IN', data.session)
      }
      return { data, error }
    } catch (error) {
      if (isAuthError(error)) {
        return { data: { user: null, session: null }, error }
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
        return { data: { user: null, session: null }, error }
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
        return { data: { user: null, session: null, messageId: data?.message_id }, error }
      }
      throw new AuthInvalidCredentialsError('You must provide either an email or phone number.')
    } catch (error) {
      if (isAuthError(error)) {
        return { data: { user: null, session: null }, error }
      }

      throw error
    }
  }

  /**
   * Log in a user given a User supplied OTP or TokenHash received through mobile or email.
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
        throw new Error('An error occurred on token verification.')
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

      return { data: { user, session }, error: null }
    } catch (error) {
      if (isAuthError(error)) {
        return { data: { user: null, session: null }, error }
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

      return await _request(this.fetch, 'POST', `${this.url}/sso`, {
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
    } catch (error) {
      if (isAuthError(error)) {
        return { data: null, error }
      }
      throw error
    }
  }

  /**
   * Sends a reauthentication OTP to the user's email or phone number.
   * Requires the user to be signed-in.
   */
  async reauthenticate(): Promise<AuthResponse> {
    await this.initializePromise

    return await this._acquireLock(-1, async () => {
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
        return { data: { user: null, session: null }, error }
      })
    } catch (error) {
      if (isAuthError(error)) {
        return { data: { user: null, session: null }, error }
      }
      throw error
    }
  }

  /**
   * Resends an existing signup confirmation email, email change email, SMS OTP or phone change OTP.
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
        return { data: { user: null, session: null }, error }
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
        return { data: { user: null, session: null, messageId: data?.message_id }, error }
      }
      throw new AuthInvalidCredentialsError(
        'You must provide either an email or phone number and a type'
      )
    } catch (error) {
      if (isAuthError(error)) {
        return { data: { user: null, session: null }, error }
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
   */
  async getSession() {
    await this.initializePromise

    const result = await this._acquireLock(-1, async () => {
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
        return { data: { session: null }, error }
      }

      return { data: { session }, error: null }
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
   */
  async getUser(jwt?: string): Promise<UserResponse> {
    if (jwt) {
      return await this._getUser(jwt)
    }

    await this.initializePromise

    const result = await this._acquireLock(-1, async () => {
      return await this._getUser()
    })

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

        return { data: { user: null }, error }
      }

      throw error
    }
  }

  /**
   * Updates user data for a logged in user.
   */
  async updateUser(
    attributes: UserAttributes,
    options: {
      emailRedirectTo?: string | undefined
    } = {}
  ): Promise<UserResponse> {
    await this.initializePromise

    return await this._acquireLock(-1, async () => {
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
        if (userError) throw userError
        session.user = data.user as User
        await this._saveSession(session)
        await this._notifyAllSubscribers('USER_UPDATED', session)
        return { data: { user: session.user }, error: null }
      })
    } catch (error) {
      if (isAuthError(error)) {
        return { data: { user: null }, error }
      }

      throw error
    }
  }

  /**
   * Sets the session data from the current session. If the current session is expired, setSession will take care of refreshing it to obtain a new session.
   * If the refresh token or access token in the current session is invalid, an error will be thrown.
   * @param currentSession The current session that minimally contains an access token and refresh token.
   */
  async setSession(currentSession: {
    access_token: string
    refresh_token: string
  }): Promise<AuthResponse> {
    await this.initializePromise

    return await this._acquireLock(-1, async () => {
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
          return { data: { user: null, session: null }, error: error }
        }

        if (!refreshedSession) {
          return { data: { user: null, session: null }, error: null }
        }
        session = refreshedSession
      } else {
        const { data, error } = await this._getUser(currentSession.access_token)
        if (error) {
          throw error
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

      return { data: { user: session.user, session }, error: null }
    } catch (error) {
      if (isAuthError(error)) {
        return { data: { session: null, user: null }, error }
      }

      throw error
    }
  }

  /**
   * Returns a new session, regardless of expiry status.
   * Takes in an optional current session. If not passed in, then refreshSession() will attempt to retrieve it from getSession().
   * If the current session's refresh token is invalid, an error will be thrown.
   * @param currentSession The current session. If passed in, it must contain a refresh token.
   */
  async refreshSession(currentSession?: { refresh_token: string }): Promise<AuthResponse> {
    await this.initializePromise

    return await this._acquireLock(-1, async () => {
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
          return { data: { user: null, session: null }, error: error }
        }

        if (!session) {
          return { data: { user: null, session: null }, error: null }
        }

        return { data: { user: session.user, session }, error: null }
      })
    } catch (error) {
      if (isAuthError(error)) {
        return { data: { user: null, session: null }, error }
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

        return { data: { session: data.session, redirectType: null }, error: null }
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

      return { data: { session, redirectType: params.type }, error: null }
    } catch (error) {
      if (isAuthError(error)) {
        return { data: { session: null, redirectType: null }, error }
      }

      throw error
    }
  }

  /**
   * Checks if the current URL contains parameters given by an implicit oauth grant flow (https://www.rfc-editor.org/rfc/rfc6749.html#section-4.2)
   */
  private _isImplicitGrantCallback(params: { [parameter: string]: string }): boolean {
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
   */
  async signOut(options: SignOut = { scope: 'global' }): Promise<{ error: AuthError | null }> {
    await this.initializePromise

    return await this._acquireLock(-1, async () => {
      return await this._signOut(options)
    })
  }

  protected async _signOut(
    { scope }: SignOut = { scope: 'global' }
  ): Promise<{ error: AuthError | null }> {
    return await this._useSession(async (result) => {
      const { data, error: sessionError } = result
      if (sessionError) {
        return { error: sessionError }
      }
      const accessToken = data.session?.access_token
      if (accessToken) {
        const { error } = await this.admin.signOut(accessToken, scope)
        if (error) {
          // ignore 404s since user might not exist anymore
          // ignore 401s since an invalid or expired JWT should sign out the current session
          if (
            !(
              isAuthApiError(error) &&
              (error.status === 404 || error.status === 401 || error.status === 403)
            )
          ) {
            return { error }
          }
        }
      }
      if (scope !== 'others') {
        await this._removeSession()
        await removeItemAsync(this.storage, `${this.storageKey}-code-verifier`)
      }
      return { error: null }
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

  onAuthStateChange(
    callback: (event: AuthChangeEvent, session: Session | null) => void | Promise<void>
  ): {
    data: { subscription: Subscription }
  } {
    const id: string = uuid()
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

      await this._acquireLock(-1, async () => {
        this._emitInitialSession(id)
      })
    })()

    return { data: { subscription } }
  }

  private async _emitInitialSession(id: string): Promise<void> {
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
        console.error(err)
      }
    })
  }

  /**
   * Sends a password reset request to an email address. This method supports the PKCE flow.
   *
   * @param email The email address of the user.
   * @param options.redirectTo The URL to send the user to after they click the password reset link.
   * @param options.captchaToken Verification token received when the user completes the captcha on the site.
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
      if (isAuthError(error)) {
        return { data: null, error }
      }

      throw error
    }
  }

  /**
   * Gets all the identities linked to a user.
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
      return { data: { identities: data.user.identities ?? [] }, error: null }
    } catch (error) {
      if (isAuthError(error)) {
        return { data: null, error }
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
      return { data: { provider: credentials.provider, url: data?.url }, error: null }
    } catch (error) {
      if (isAuthError(error)) {
        return { data: { provider: credentials.provider, url: null }, error }
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
          return { data: { user: null, session: null }, error }
        } else if (!data || !data.session || !data.user) {
          return {
            data: { user: null, session: null },
            error: new AuthInvalidTokenResponseError(),
          }
        }
        if (data.session) {
          await this._saveSession(data.session)
          await this._notifyAllSubscribers('USER_UPDATED', data.session)
        }
        return { data, error }
      } catch (error) {
        if (isAuthError(error)) {
          return { data: { user: null, session: null }, error }
        }
        throw error
      }
    })
  }

  /**
   * Unlinks an identity from a user by deleting it. The user will no longer be able to sign in with that identity once it's unlinked.
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
        return { data: null, error }
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
        return { data: { session: null, user: null }, error }
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
    setTimeout(async () => {
      await this.initializePromise
      await this._autoRefreshTokenTick()
    }, 0)
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
      this.visibilityChangedCallback = async () => await this._onVisibilityChanged(false)

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

        await this._acquireLock(-1, async () => {
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
          return { data: null, error: sessionError }
        }

        return await _request(this.fetch, 'DELETE', `${this.url}/factors/${params.factorId}`, {
          headers: this.headers,
          jwt: sessionData?.session?.access_token,
        })
      })
    } catch (error) {
      if (isAuthError(error)) {
        return { data: null, error }
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
          return { data: null, error: sessionError }
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
          return { data: null, error }
        }

        if (params.factorType === 'totp' && data.type === 'totp' && data?.totp?.qr_code) {
          data.totp.qr_code = `data:image/svg+xml;utf-8,${data.totp.qr_code}`
        }

        return { data, error: null }
      })
    } catch (error) {
      if (isAuthError(error)) {
        return { data: null, error }
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
    return this._acquireLock(-1, async () => {
      try {
        return await this._useSession(async (result) => {
          const { data: sessionData, error: sessionError } = result
          if (sessionError) {
            return { data: null, error: sessionError }
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
            return { data: null, error }
          }

          await this._saveSession({
            expires_at: Math.round(Date.now() / 1000) + data.expires_in,
            ...data,
          })
          await this._notifyAllSubscribers('MFA_CHALLENGE_VERIFIED', data)

          return { data, error }
        })
      } catch (error) {
        if (isAuthError(error)) {
          return { data: null, error }
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
    return this._acquireLock(-1, async () => {
      try {
        return await this._useSession(async (result) => {
          const { data: sessionData, error: sessionError } = result
          if (sessionError) {
            return { data: null, error: sessionError }
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
          return { data: null, error }
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
      return { data: null, error: challengeError }
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
  private async _getAuthenticatorAssuranceLevel(): Promise<AuthMFAGetAuthenticatorAssuranceLevelResponse> {
    const {
      data: { session },
      error: sessionError,
    } = await this.getSession()

    if (sessionError) {
      return { data: null, error: sessionError }
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
   * If the API returns a redirect_uri, it means consent was already given - the caller
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
          return { data: null, error: sessionError }
        }

        if (!session) {
          return { data: null, error: new AuthSessionMissingError() }
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
        return { data: null, error }
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
          return { data: null, error: sessionError }
        }

        if (!session) {
          return { data: null, error: new AuthSessionMissingError() }
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
        return { data: null, error }
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
          return { data: null, error: sessionError }
        }

        if (!session) {
          return { data: null, error: new AuthSessionMissingError() }
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
        return { data: null, error }
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
          return { data: null, error }
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
        return { data: null, error }
      }
      throw error
    }
  }
}
