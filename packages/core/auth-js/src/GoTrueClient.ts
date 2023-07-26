import GoTrueAdminApi from './GoTrueAdminApi'
import { DEFAULT_HEADERS, EXPIRY_MARGIN, GOTRUE_URL, STORAGE_KEY } from './lib/constants'
import {
  AuthError,
  AuthImplicitGrantRedirectError,
  AuthPKCEGrantCodeExchangeError,
  AuthInvalidCredentialsError,
  AuthRetryableFetchError,
  AuthSessionMissingError,
  AuthInvalidTokenResponseError,
  AuthUnknownError,
  isAuthApiError,
  isAuthError,
  isAuthRetryableFetchError,
} from './lib/errors'
import { Fetch, _request, _sessionResponse, _userResponse, _ssoResponse } from './lib/fetch'
import {
  decodeJWTPayload,
  Deferred,
  getItemAsync,
  isBrowser,
  removeItemAsync,
  resolveFetch,
  setItemAsync,
  uuid,
  retryable,
  sleep,
  generatePKCEVerifier,
  generatePKCEChallenge,
  supportsLocalStorage,
  stackGuard,
  isInStackGuard,
  stackGuardsSupported,
  parseParametersFromURL,
} from './lib/helpers'
import localStorageAdapter from './lib/local-storage'
import { polyfillGlobalThis } from './lib/polyfills'
import { version } from './lib/version'

import type {
  AuthChangeEvent,
  AuthResponse,
  AuthTokenResponse,
  AuthOtpResponse,
  CallRefreshTokenResult,
  GoTrueClientOptions,
  InitializeResult,
  OAuthResponse,
  SSOResponse,
  Provider,
  Session,
  SignInWithIdTokenCredentials,
  SignInWithOAuthCredentials,
  SignInWithPasswordCredentials,
  SignInWithPasswordlessCredentials,
  SignUpWithPasswordCredentials,
  SignInWithSSO,
  SignOut,
  Subscription,
  SupportedStorage,
  User,
  UserAttributes,
  UserResponse,
  VerifyOtpParams,
  GoTrueMFAApi,
  MFAEnrollParams,
  AuthMFAEnrollResponse,
  MFAChallengeParams,
  AuthMFAChallengeResponse,
  MFAUnenrollParams,
  AuthMFAUnenrollResponse,
  MFAVerifyParams,
  AuthMFAVerifyResponse,
  AuthMFAListFactorsResponse,
  AMREntry,
  AuthMFAGetAuthenticatorAssuranceLevelResponse,
  AuthenticatorAssuranceLevels,
  Factor,
  MFAChallengeAndVerifyParams,
  ResendParams,
  AuthFlowType,
  LockFunc,
} from './lib/types'

polyfillGlobalThis() // Make "globalThis" available

const DEFAULT_OPTIONS: Omit<Required<GoTrueClientOptions>, 'fetch' | 'storage' | 'lock'> = {
  url: GOTRUE_URL,
  storageKey: STORAGE_KEY,
  autoRefreshToken: true,
  persistSession: true,
  detectSessionInUrl: true,
  headers: DEFAULT_HEADERS,
  flowType: 'implicit',
  debug: false,
}

/** Current session will be checked for refresh at this interval. */
const AUTO_REFRESH_TICK_DURATION = 30 * 1000

/**
 * A token refresh will be attempted this many ticks before the current session expires. */
const AUTO_REFRESH_TICK_THRESHOLD = 3

async function lockNoOp<R>(name: string, acquireTimeout: number, fn: () => Promise<R>): Promise<R> {
  return await fn()
}

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
   * The storage key used to identify the values saved in localStorage
   */
  protected storageKey: string

  /**
   * The session object for the currently logged in user. If null, it means there isn't a logged-in user.
   * Only used if persistSession is false.
   */
  protected inMemorySession: Session | null

  protected flowType: AuthFlowType

  protected autoRefreshToken: boolean
  protected persistSession: boolean
  protected storage: SupportedStorage
  protected stateChangeEmitters: Map<string, Subscription> = new Map()
  protected autoRefreshTicker: ReturnType<typeof setInterval> | null = null
  protected visibilityChangedCallback: (() => Promise<any>) | null = null
  protected refreshingDeferred: Deferred<CallRefreshTokenResult> | null = null
  /**
   * Keeps track of the async client initialization.
   * When null or not yet resolved the auth state is `unknown`
   * Once resolved the the auth state is known and it's save to call any further client methods.
   * Keep extra care to never reject or throw uncaught errors
   */
  protected initializePromise: Promise<InitializeResult> | null = null
  protected detectSessionInUrl = true
  protected url: string
  protected headers: {
    [key: string]: string
  }
  protected fetch: Fetch
  protected lock: LockFunc

  /**
   * Used to broadcast state change events to other tabs listening.
   */
  protected broadcastChannel: BroadcastChannel | null = null

  protected logDebugMessages: boolean

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
    this.logDebugMessages = settings.debug
    this.inMemorySession = null
    this.storageKey = settings.storageKey
    this.autoRefreshToken = settings.autoRefreshToken
    this.persistSession = settings.persistSession
    this.storage = settings.storage || localStorageAdapter
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

    this.mfa = {
      verify: this._verify.bind(this),
      enroll: this._enroll.bind(this),
      unenroll: this._unenroll.bind(this),
      challenge: this._challenge.bind(this),
      listFactors: this._listFactors.bind(this),
      challengeAndVerify: this._challengeAndVerify.bind(this),
      getAuthenticatorAssuranceLevel: this._getAuthenticatorAssuranceLevel.bind(this),
    }

    if (this.persistSession && this.storage === localStorageAdapter && !supportsLocalStorage()) {
      console.warn(
        `No storage option exists to persist the session, which may result in unexpected behavior when using auth.
        If you want to set persistSession to true, please provide a storage option or you may set persistSession to false to disable this warning.`
      )
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
      console.log(
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
  initialize(): Promise<InitializeResult> {
    if (this.initializePromise) {
      return this.initializePromise
    }

    return this._initialize()
  }

  /**
   * IMPORTANT:
   * 1. Never throw in this method, as it is called from the constructor
   * 2. Never return a session from this method as it would be cached over
   *    the whole lifetime of the client
   */
  private async _initialize(): Promise<InitializeResult> {
    if (this.initializePromise) {
      throw new Error('Double call of #_initialize()')
    }

    this.initializePromise = this._acquireLock(
      -1,
      async () =>
        await stackGuard('_initialize', async () => {
          try {
            const isPKCEFlow = isBrowser() ? await this._isPKCEFlow() : false
            this._debug('#_initialize()', 'begin', 'is PKCE flow', isPKCEFlow)

            if (isPKCEFlow || (this.detectSessionInUrl && this._isImplicitGrantFlow())) {
              const { data, error } = await this._getSessionFromURL(isPKCEFlow)
              if (error) {
                this._debug('#_initialize()', 'error detecting session from URL', error)

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
        })
    )

    return await this.initializePromise
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
      await this._removeSession()

      let res: AuthResponse
      if ('email' in credentials) {
        const { email, password, options } = credentials
        let codeChallenge: string | null = null
        let codeChallengeMethod: string | null = null
        if (this.flowType === 'pkce') {
          const codeVerifier = generatePKCEVerifier()
          await setItemAsync(this.storage, `${this.storageKey}-code-verifier`, codeVerifier)
          codeChallenge = await generatePKCEChallenge(codeVerifier)
          codeChallengeMethod = codeVerifier === codeChallenge ? 'plain' : 's256'
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
  async signInWithPassword(credentials: SignInWithPasswordCredentials): Promise<AuthTokenResponse> {
    try {
      await this._removeSession()

      let res: AuthResponse
      if ('email' in credentials) {
        const { email, password, options } = credentials
        res = await _request(this.fetch, 'POST', `${this.url}/token?grant_type=password`, {
          headers: this.headers,
          body: {
            email,
            password,
            gotrue_meta_security: { captcha_token: options?.captchaToken },
          },
          xform: _sessionResponse,
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
          xform: _sessionResponse,
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
      return { data: { user: data.user, session: data.session }, error }
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
    await this._removeSession()

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
    const codeVerifier = await getItemAsync(this.storage, `${this.storageKey}-code-verifier`)
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
      return { data: { user: null, session: null }, error }
    } else if (!data || !data.session || !data.user) {
      return { data: { user: null, session: null }, error: new AuthInvalidTokenResponseError() }
    }
    if (data.session) {
      await this._saveSession(data.session)
      await this._notifyAllSubscribers('SIGNED_IN', data.session)
    }
    return { data, error }
  }

  /**
   * Allows signing in with an OIDC ID token. The authentication provider used
   * should be enabled and configured.
   */
  async signInWithIdToken(credentials: SignInWithIdTokenCredentials): Promise<AuthTokenResponse> {
    await this._removeSession()

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
      await this._removeSession()

      if ('email' in credentials) {
        const { email, options } = credentials
        let codeChallenge: string | null = null
        let codeChallengeMethod: string | null = null
        if (this.flowType === 'pkce') {
          const codeVerifier = generatePKCEVerifier()
          await setItemAsync(this.storage, `${this.storageKey}-code-verifier`, codeVerifier)
          codeChallenge = await generatePKCEChallenge(codeVerifier)
          codeChallengeMethod = codeVerifier === codeChallenge ? 'plain' : 's256'
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
   * Log in a user given a User supplied OTP received via mobile.
   */
  async verifyOtp(params: VerifyOtpParams): Promise<AuthResponse> {
    try {
      if (params.type !== 'email_change' && params.type !== 'phone_change') {
        // we don't want to remove the authenticated session if the user is performing an email_change or phone_change verification
        await this._removeSession()
      }

      let redirectTo = undefined
      let captchaToken = undefined
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
      await this._removeSession()

      return await _request(this.fetch, 'POST', `${this.url}/sso`, {
        body: {
          ...('providerId' in params ? { provider_id: params.providerId } : null),
          ...('domain' in params ? { domain: params.domain } : null),
          redirect_to: params.options?.redirectTo ?? undefined,
          ...(params?.options?.captchaToken
            ? { gotrue_meta_security: { captcha_token: params.options.captchaToken } }
            : null),
          skip_http_redirect: true, // fetch does not handle redirects
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
      if (credentials.type != 'email_change' && credentials.type != 'phone_change') {
        await this._removeSession()
      }

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
   * The session returned can be null if the session is not detected which can happen in the event a user is not signed-in or has logged out.
   */
  async getSession() {
    return this._useSession(async (result) => {
      return result
    })
  }

  /**
   * Acquires a global lock based on the storage key.
   */
  private async _acquireLock<R>(acquireTimeout: number, fn: () => Promise<R>): Promise<R> {
    this._debug('#_acquireLock', 'begin', acquireTimeout)

    try {
      if (!(await stackGuardsSupported())) {
        this._debug(
          '#_acquireLock',
          'Stack guards not supported, so exclusive locking is not performed as it can lead to deadlocks if the lock is attempted to be recursively acquired (as the recursion cannot be detected).'
        )

        return await fn()
      }

      if (isInStackGuard('_acquireLock')) {
        this._debug('#_acquireLock', 'recursive call')
        return await fn()
      }

      return await this.lock(`lock:${this.storageKey}`, acquireTimeout, async () => {
        this._debug('#_acquireLock', 'lock acquired for storage key', this.storageKey)

        try {
          return await stackGuard('_acquireLock', async () => {
            return await fn()
          })
        } finally {
          this._debug('#_acquireLock', 'lock released for storage key', this.storageKey)
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
      if (isInStackGuard('_useSession')) {
        this._debug('#_useSession', 'recursive call')

        // the use of __loadSession here is the only correct use of the function!
        const result = await this.__loadSession()

        return await fn(result)
      }

      return await this._acquireLock(-1, async () => {
        return await stackGuard('_useSession', async () => {
          // the use of __loadSession here is the only correct use of the function!
          const result = await this.__loadSession()

          return await fn(result)
        })
      })
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

    if (this.logDebugMessages && !isInStackGuard('_useSession') && (await stackGuardsSupported())) {
      throw new Error('Please use #_useSession()')
    }

    if (isInStackGuard('_initialize')) {
      this._debug('#__loadSession', '#_initialize recursion detected', new Error().stack)
    }

    // always wait for #_initialize() to finish before loading anything from
    // storage
    await this.initializePromise

    try {
      let currentSession: Session | null = null

      if (this.persistSession) {
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
      } else {
        currentSession = this.inMemorySession
        this._debug('#getSession()', 'session from memory', currentSession)
      }

      if (!currentSession) {
        return { data: { session: null }, error: null }
      }

      const hasExpired = currentSession.expires_at
        ? currentSession.expires_at <= Date.now() / 1000
        : false

      this._debug(
        '#__loadSession()',
        `session has${hasExpired ? '' : ' not'} expired`,
        'expires_at',
        currentSession.expires_at
      )

      if (!hasExpired) {
        return { data: { session: currentSession }, error: null }
      }

      const { session, error } = await this._callRefreshToken(currentSession.refresh_token)
      if (error) {
        return { data: { session: null }, error }
      }

      return { data: { session }, error: null }
    } finally {
      this._debug('#__loadSession()', 'end')
    }
  }

  /**
   * Gets the current user details if there is an existing session.
   * @param jwt Takes in an optional access token jwt. If no jwt is provided, getUser() will attempt to get the jwt from the current session.
   */
  async getUser(jwt?: string): Promise<UserResponse> {
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

        return await _request(this.fetch, 'GET', `${this.url}/user`, {
          headers: this.headers,
          jwt: data.session?.access_token ?? undefined,
          xform: _userResponse,
        })
      })
    } catch (error) {
      if (isAuthError(error)) {
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
        const { data, error: userError } = await _request(this.fetch, 'PUT', `${this.url}/user`, {
          headers: this.headers,
          redirectTo: options?.emailRedirectTo,
          body: attributes,
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
   * Decodes a JWT (without performing any validation).
   */
  private _decodeJWT(jwt: string): {
    exp?: number
    aal?: AuthenticatorAssuranceLevels | null
    amr?: AMREntry[] | null
  } {
    return decodeJWTPayload(jwt)
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
    try {
      if (!currentSession.access_token || !currentSession.refresh_token) {
        throw new AuthSessionMissingError()
      }

      const timeNow = Date.now() / 1000
      let expiresAt = timeNow
      let hasExpired = true
      let session: Session | null = null
      const payload = decodeJWTPayload(currentSession.access_token)
      if (payload.exp) {
        expiresAt = payload.exp
        hasExpired = expiresAt <= timeNow
      }

      if (hasExpired) {
        const { session: refreshedSession, error } = await this._callRefreshToken(
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
        const { data, error } = await this.getUser(currentSession.access_token)
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

        const { session, error } = await this._callRefreshToken(currentSession.refresh_token)
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
  private async _getSessionFromURL(isPKCEFlow: boolean): Promise<
    | {
        data: { session: Session; redirectType: string | null }
        error: null
      }
    | { data: { session: null; redirectType: null }; error: AuthError }
  > {
    try {
      if (!isBrowser()) throw new AuthImplicitGrantRedirectError('No browser detected.')
      if (this.flowType === 'implicit' && !this._isImplicitGrantFlow()) {
        throw new AuthImplicitGrantRedirectError('Not a valid implicit grant flow url.')
      } else if (this.flowType == 'pkce' && !isPKCEFlow) {
        throw new AuthPKCEGrantCodeExchangeError('Not a valid PKCE flow url.')
      }

      const params = parseParametersFromURL(window.location.href)

      if (isPKCEFlow) {
        if (!params.code) throw new AuthPKCEGrantCodeExchangeError('No code detected.')
        const { data, error } = await this.exchangeCodeForSession(params.code)
        if (error) throw error

        const url = new URL(window.location.href)
        url.searchParams.delete('code')

        window.history.replaceState(window.history.state, '', url.toString())

        return { data: { session: data.session, redirectType: null }, error: null }
      }

      if (params.error || params.error_description || params.error_code) {
        throw new AuthImplicitGrantRedirectError(
          params.error_description || 'Error in URL with unspecified error_description',
          {
            error: params.error || 'unspecified_error',
            code: params.error_code || 'unspecified_code',
          }
        )
      }

      const {
        provider_token,
        provider_refresh_token,
        access_token,
        refresh_token,
        expires_in,
        token_type,
      } = params

      if (!access_token || !expires_in || !refresh_token || !token_type) {
        throw new AuthImplicitGrantRedirectError('No session defined in URL')
      }

      const timeNow = Math.round(Date.now() / 1000)
      const expiresIn = parseInt(expires_in)
      const expires_at = timeNow + expiresIn

      const { data, error } = await this.getUser(access_token)
      if (error) throw error

      const session: Session = {
        provider_token,
        provider_refresh_token,
        access_token,
        expires_in: expiresIn,
        expires_at,
        refresh_token,
        token_type,
        user: data.user!!,
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
  private _isImplicitGrantFlow(): boolean {
    const params = parseParametersFromURL(window.location.href)

    return !!(isBrowser() && (params.access_token || params.error_description))
  }
  /**
   * Checks if the current URL and backing storage contain parameters given by a PKCE flow
   */
  private async _isPKCEFlow(): Promise<boolean> {
    const params = parseParametersFromURL(window.location.href)

    const currentStorageContent = await getItemAsync(
      this.storage,
      `${this.storageKey}-code-verifier`
    )

    return !!(params.code && currentStorageContent)
  }

  /**
   * Inside a browser context, `signOut()` will remove the logged in user from the browser session
   * and log them out - removing all items from localstorage and then trigger a `"SIGNED_OUT"` event.
   *
   * For server-side management, you can revoke all refresh tokens for a user by passing a user's JWT through to `auth.api.signOut(JWT: string)`.
   * There is no way to revoke a user's access token jwt until it expires. It is recommended to set a shorter expiry on the jwt for this reason.
   *
   * If using others scope, no `SIGNED_OUT` event is fired!
   */
  async signOut({ scope }: SignOut = { scope: 'global' }): Promise<{ error: AuthError | null }> {
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
          if (!(isAuthApiError(error) && (error.status === 404 || error.status === 401))) {
            return { error }
          }
        }
      }
      if (scope !== 'others') {
        await this._removeSession()
        await removeItemAsync(this.storage, `${this.storageKey}-code-verifier`)
        await this._notifyAllSubscribers('SIGNED_OUT', null)
      }
      return { error: null }
    })
  }

  /**
   * Receive a notification every time an auth event happens.
   * @param callback A callback function to be invoked when an auth event happens.
   */
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

    this._emitInitialSession(id)

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
   * Sends a password reset request to an email address.
   * This method supports the PKCE flow.
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
      const codeVerifier = generatePKCEVerifier()
      await setItemAsync(this.storage, `${this.storageKey}-code-verifier`, codeVerifier)
      codeChallenge = await generatePKCEChallenge(codeVerifier)
      codeChallengeMethod = codeVerifier === codeChallenge ? 'plain' : 's256'
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
          await sleep(attempt * 200) // 0, 200, 400, 800, ...

          this._debug(debugName, 'refreshing attempt', attempt)

          return await _request(this.fetch, 'POST', `${this.url}/token?grant_type=refresh_token`, {
            body: { refresh_token: refreshToken },
            headers: this.headers,
            xform: _sessionResponse,
          })
        },
        (attempt, _, result) =>
          result &&
          result.error &&
          isAuthRetryableFetchError(result.error) &&
          // retryable only if the request can be sent before the backoff overflows the tick duration
          Date.now() + (attempt + 1) * 200 - startedAt < AUTO_REFRESH_TICK_DURATION
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
    const url: string = await this._getUrlForProvider(provider, {
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
   * Recovers the session from LocalStorage and refreshes
   * Note: this method is async to accommodate for AsyncStorage e.g. in React native.
   */
  private async _recoverAndRefresh() {
    const debugName = '#_recoverAndRefresh()'
    this._debug(debugName, 'begin')

    try {
      const currentSession = await getItemAsync(this.storage, this.storageKey)
      this._debug(debugName, 'session from storage', currentSession)

      if (!this._isValidSession(currentSession)) {
        this._debug(debugName, 'session is not valid')
        if (currentSession !== null) {
          await this._removeSession()
        }

        return
      }

      const timeNow = Math.round(Date.now() / 1000)
      const expiresWithMargin = (currentSession.expires_at ?? Infinity) < timeNow + EXPIRY_MARGIN

      this._debug(
        debugName,
        `session has${expiresWithMargin ? '' : ' not'} expired with margin of ${EXPIRY_MARGIN}s`
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

      const result = { session: data.session, error: null }

      this.refreshingDeferred.resolve(result)

      return result
    } catch (error) {
      this._debug(debugName, 'error', error)

      if (isAuthError(error)) {
        const result = { session: null, error }

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

    if (!this.persistSession) {
      this.inMemorySession = session
    }

    if (this.persistSession && session.expires_at) {
      await this._persistSession(session)
    }
  }

  private _persistSession(currentSession: Session) {
    this._debug('#_persistSession()', currentSession)

    return setItemAsync(this.storage, this.storageKey, currentSession)
  }

  private async _removeSession() {
    this._debug('#_removeSession()')

    if (this.persistSession) {
      await removeItemAsync(this.storage, this.storageKey)
    } else {
      this.inMemorySession = null
    }
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

    const ticker = setInterval(() => this._autoRefreshTokenTick(), AUTO_REFRESH_TICK_DURATION)
    this.autoRefreshTicker = ticker

    if (ticker && typeof ticker === 'object' && typeof ticker.unref === 'function') {
      // ticker is a NodeJS Timeout object that has an `unref` method
      // https://nodejs.org/api/timers.html#timeoutunref
      // When auto refresh is used in NodeJS (like for testing) the
      // `setInterval` is preventing the process from being marked as
      // finished and tests run endlessly. This can be prevented by calling
      // `unref()` on the returned object.
      ticker.unref()
      // @ts-ignore
    } else if (typeof Deno !== 'undefined' && typeof Deno.unrefTimer === 'function') {
      // similar like for NodeJS, but with the Deno API
      // https://deno.land/api@latest?unstable&s=Deno.unrefTimer
      // @ts-ignore
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
            (session.expires_at * 1000 - now) / AUTO_REFRESH_TICK_DURATION
          )

          this._debug(
            '#_autoRefreshTokenTick()',
            `access token expires in ${expiresInTicks} ticks, a tick lasts ${AUTO_REFRESH_TICK_DURATION}ms, refresh threshold is ${AUTO_REFRESH_TICK_THRESHOLD} ticks`
          )

          if (expiresInTicks <= AUTO_REFRESH_TICK_THRESHOLD) {
            await this._callRefreshToken(session.refresh_token)
          }
        })
      } catch (e: any) {
        console.error('Auto refresh tick failed with error. This is likely a transient error.', e)
      }
    } finally {
      this._debug('#_autoRefreshTokenTick()', 'end')
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
  private async _onVisibilityChanged(isInitial: boolean) {
    this._debug(`#_onVisibilityChanged(${isInitial})`, 'visibilityState', document.visibilityState)

    if (document.visibilityState === 'visible') {
      // to avoid recursively depending on #_initialize(), run the visibility
      // changed callback in the next event loop tick
      setTimeout(async () => {
        if (!isInitial) {
          // initial visibility change setup is handled in another flow under #initialize()
          await this.initializePromise
          await this._recoverAndRefresh()

          this._debug(
            '#_onVisibilityChanged()',
            'finished waiting for initialize, _recoverAndRefresh'
          )
        }

        if (this.autoRefreshToken) {
          // in browser environments the refresh token ticker runs only on focused tabs
          // which prevents race conditions
          this._startAutoRefresh()
        }
      }, 0)
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
    provider: Provider,
    options: {
      redirectTo?: string
      scopes?: string
      queryParams?: { [key: string]: string }
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
      const codeVerifier = generatePKCEVerifier()
      await setItemAsync(this.storage, `${this.storageKey}-code-verifier`, codeVerifier)
      const codeChallenge = await generatePKCEChallenge(codeVerifier)
      const codeChallengeMethod = codeVerifier === codeChallenge ? 'plain' : 's256'

      this._debug(
        'PKCE',
        'code verifier',
        `${codeVerifier.substring(0, 5)}...`,
        'code challenge',
        codeChallenge,
        'method',
        codeChallengeMethod
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

    return `${this.url}/authorize?${urlParams.join('&')}`
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
  private async _enroll(params: MFAEnrollParams): Promise<AuthMFAEnrollResponse> {
    try {
      return await this._useSession(async (result) => {
        const { data: sessionData, error: sessionError } = result
        if (sessionError) {
          return { data: null, error: sessionError }
        }

        const { data, error } = await _request(this.fetch, 'POST', `${this.url}/factors`, {
          body: {
            friendly_name: params.friendlyName,
            factor_type: params.factorType,
            issuer: params.issuer,
          },
          headers: this.headers,
          jwt: sessionData?.session?.access_token,
        })

        if (error) {
          return { data: null, error }
        }

        if (data?.totp?.qr_code) {
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
  private async _verify(params: MFAVerifyParams): Promise<AuthMFAVerifyResponse> {
    try {
      return await this._useSession(async (result) => {
        const { data: sessionData, error: sessionError } = result
        if (sessionError) {
          return { data: null, error: sessionError }
        }

        const { data, error } = await _request(
          this.fetch,
          'POST',
          `${this.url}/factors/${params.factorId}/verify`,
          {
            body: { code: params.code, challenge_id: params.challengeId },
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
  }

  /**
   * {@see GoTrueMFAApi#challenge}
   */
  private async _challenge(params: MFAChallengeParams): Promise<AuthMFAChallengeResponse> {
    try {
      return await this._useSession(async (result) => {
        const { data: sessionData, error: sessionError } = result
        if (sessionError) {
          return { data: null, error: sessionError }
        }

        return await _request(
          this.fetch,
          'POST',
          `${this.url}/factors/${params.factorId}/challenge`,
          {
            headers: this.headers,
            jwt: sessionData?.session?.access_token,
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
   * {@see GoTrueMFAApi#challengeAndVerify}
   */
  private async _challengeAndVerify(
    params: MFAChallengeAndVerifyParams
  ): Promise<AuthMFAVerifyResponse> {
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
    const {
      data: { user },
      error: userError,
    } = await this.getUser()
    if (userError) {
      return { data: null, error: userError }
    }

    const factors = user?.factors || []
    const totp = factors.filter(
      (factor) => factor.factor_type === 'totp' && factor.status === 'verified'
    )

    return {
      data: {
        all: factors,
        totp,
      },
      error: null,
    }
  }

  /**
   * {@see GoTrueMFAApi#getAuthenticatorAssuranceLevel}
   */
  private async _getAuthenticatorAssuranceLevel(): Promise<AuthMFAGetAuthenticatorAssuranceLevelResponse> {
    return await this._useSession(async (result) => {
      const {
        data: { session },
        error: sessionError,
      } = result
      if (sessionError) {
        return { data: null, error: sessionError }
      }
      if (!session) {
        return {
          data: { currentLevel: null, nextLevel: null, currentAuthenticationMethods: [] },
          error: null,
        }
      }

      const payload = this._decodeJWT(session.access_token)

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
    })
  }
}
