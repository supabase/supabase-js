import GoTrueAdminApi from './GoTrueAdminApi'
import {
  DEFAULT_HEADERS,
  EXPIRY_MARGIN,
  GOTRUE_URL,
  NETWORK_FAILURE,
  STORAGE_KEY,
} from './lib/constants'
import {
  AuthApiError,
  AuthError,
  AuthInvalidCredentialsError,
  AuthRetryableFetchError,
  AuthSessionMissingError,
  AuthUnknownError,
  isAuthError,
} from './lib/errors'
import { Fetch, _request, _sessionResponse, _userResponse } from './lib/fetch'
import {
  Deferred,
  getItemAsync,
  getParameterByName,
  isBrowser,
  removeItemAsync,
  resolveFetch,
  setItemAsync,
  uuid,
} from './lib/helpers'
import { polyfillGlobalThis } from './lib/polyfills'
import type {
  AuthChangeEvent,
  AuthResponse,
  CallRefreshTokenResult,
  OAuthResponse,
  Provider,
  Session,
  SignInWithOAuthCredentials,
  SignInWithPasswordCredentials,
  SignInWithPasswordlessCredentials,
  Subscription,
  SupportedStorage,
  User,
  UserAttributes,
  UserCredentials,
  UserResponse,
  VerifyOTPParams,
} from './lib/types'

polyfillGlobalThis() // Make "globalThis" available

const DEFAULT_OPTIONS = {
  url: GOTRUE_URL,
  storageKey: STORAGE_KEY,
  autoRefreshToken: true,
  persistSession: true,
  detectSessionInUrl: true,
  multiTab: true,
  headers: DEFAULT_HEADERS,
}

export default class GoTrueClient {
  /**
   * Namespace for the GoTrue admin methods.
   * These methods should only be used in a trusted server-side environment.
   * These methods
   */
  admin: GoTrueAdminApi
  /**
   * The storage key used to identity the values saved in localStorage
   */
  protected storageKey: string

  /**
   * The session object for the currently logged in user or null.
   * Only used if persistSession is false.
   */
  protected inMemorySession: Session | null

  protected autoRefreshToken: boolean
  protected persistSession: boolean
  protected storage: SupportedStorage
  protected stateChangeEmitters: Map<string, Subscription> = new Map()
  protected refreshTokenTimer?: ReturnType<typeof setTimeout>
  // eslint-disable-next-line @typescript-eslint/no-inferrable-types
  protected networkRetries: number = 0
  protected refreshingDeferred: Deferred<CallRefreshTokenResult> | null = null
  protected url: string
  protected headers: {
    [key: string]: string
  }
  protected fetch: Fetch

  /**
   * Create a new client for use in the browser.
   * @param options.url The URL of the GoTrue server.
   * @param options.headers Any additional headers to send to the GoTrue server.
   * @param options.storageKey Optional key name used for storing tokens in local storage
   * @param options.detectSessionInUrl Set to "true" if you want to automatically detects OAuth grants in the URL and signs in the user.
   * @param options.autoRefreshToken Set to "true" if you want to automatically refresh the token before expiring.
   * @param options.persistSession Set to "true" if you want to automatically save the user session into local storage. If set to false, session will just be saved in memory.
   * @param options.localStorage Provide your own local storage implementation to use instead of the browser's local storage.
   * @param options.multiTab Set to "false" if you want to disable multi-tab/window events.
   * @param options.fetch A custom fetch implementation.
   */
  constructor(options: {
    url?: string
    headers?: { [key: string]: string }
    storageKey?: string
    detectSessionInUrl?: boolean
    autoRefreshToken?: boolean
    persistSession?: boolean
    storage?: SupportedStorage
    multiTab?: boolean
    fetch?: Fetch
  }) {
    const settings = { ...DEFAULT_OPTIONS, ...options }
    this.inMemorySession = null
    this.storageKey = settings.storageKey
    this.autoRefreshToken = settings.autoRefreshToken
    this.persistSession = settings.persistSession
    this.storage = settings.storage || globalThis.localStorage
    this.admin = new GoTrueAdminApi({
      url: settings.url,
      headers: settings.headers,
      fetch: settings.fetch,
    })
    this._recoverAndRefresh()
    this._handleVisibilityChange()
    this.url = settings.url
    this.headers = settings.headers
    this.fetch = resolveFetch(settings.fetch)

    if (settings.detectSessionInUrl && isBrowser() && !!getParameterByName('access_token')) {
      // Handle the OAuth redirect
      this._getSessionFromUrl().then(({ error }) => {
        if (error) {
          throw new AuthUnknownError('Error getting session from URL.', error)
        }
      })
    }
  }

  /**
   * Creates a new user.
   * @type UserCredentials
   * @param email The user's email address.
   * @param password The user's password.
   * @param phone The user's phone number.
   * @param options.redirectTo The redirect URL attached to the signup confirmation link. Does not redirect the user if it's a mobile signup.
   * @param options.data Optional user metadata.
   * @param options.captchaToken Verification token received when the user completes the captcha on the site.
   *
   * @returns A logged-in session if the server has "autoconfirm" ON
   * @returns A user if the server has "autoconfirm" OFF
   */
  async signUp(
    { email, password, phone }: UserCredentials,
    options: {
      redirectTo?: string
      data?: object
      captchaToken?: string
    } = {}
  ): Promise<AuthResponse> {
    try {
      this._removeSession()

      const { data, error } =
        phone && password
          ? await _request(this.fetch, 'POST', `${this.url}/signup`, {
              headers: this.headers,
              redirectTo: options.redirectTo,
              body: {
                phone,
                password,
                data: options.data,
                gotrue_meta_security: { captcha_token: options.captchaToken },
              },
              xform: _sessionResponse,
            })
          : await _request(this.fetch, 'POST', `${this.url}/signup`, {
              headers: this.headers,
              redirectTo: options.redirectTo,
              body: {
                email,
                password,
                data: options.data,
                gotrue_meta_security: { captcha_token: options.captchaToken },
              },
              xform: _sessionResponse,
            })

      if (error) {
        throw error
      }

      if (!data) {
        throw 'An error occurred on sign up.'
      }

      const session: Session | null = data.session
      const user: User | null = data.user

      if (data.session) {
        this._saveSession(data.session)
        this._notifyAllSubscribers('SIGNED_IN', session)
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
   * Log in an existing user, or login via a third-party provider.
   * @type SignInWithPasswordCredentials
   * @param email The user's email address.
   * @param phone The user's phone number.
   * @param password The user's password.
   * @param options.captchaToken Verification token received when the user completes the captcha on the site.
   */
  async signInWithPassword(credentials: SignInWithPasswordCredentials): Promise<AuthResponse> {
    try {
      this._removeSession()

      let res: AuthResponse
      if ('email' in credentials) {
        const { email, password, options } = credentials
        res = await _request(this.fetch, 'POST', `${this.url}/token?grant_type=password`, {
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
      if (error || !data) return { data: { user: null, session: null }, error }
      if (data.session) {
        this._saveSession(data.session)
        this._notifyAllSubscribers('SIGNED_IN', data.session)
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
   * Log in an existing user via a third-party provider.
   * @type SignInWithOAuthCredentials
   * @param provider One of the providers supported by GoTrue.
   * @param redirectTo A URL to send the user to after they are confirmed (OAuth logins only).
   * @param options.scopes A space-separated list of scopes granted to the OAuth application.
   * @param options.queryParams An object of query params
   * @param options.captchaToken Verification token received when the user completes the captcha on the site.
   */
  async signInWithOAuth(credentials: SignInWithOAuthCredentials): Promise<OAuthResponse> {
    this._removeSession()
    return this._handleProviderSignIn(credentials.provider, {
      redirectTo: credentials.options?.redirectTo,
      scopes: credentials.options?.scopes,
      queryParams: credentials.options?.queryParams,
    })
  }

  /**
   * Passwordless method for logging in an existing user.
   * @type SignInWithPasswordlessCredentials
   * @param email The user's email address.
   * @param phone The user's phone number.
   * @param options.captchaToken Verification token received when the user completes the captcha on the site.
   * @param options.emailRedirectTo The redirect url sent in the magiclink. The url will be appended to the end of the magiclink url. Does not serve to redirect the user after this method is invoked.
   * @param options.shouldCreateUser If set to false, signInWithOtp will not create a new user if the user does not exist. Defaults to true.
   */
  async signInWithOtp(credentials: SignInWithPasswordlessCredentials): Promise<AuthResponse> {
    try {
      this._removeSession()

      if ('email' in credentials) {
        const { email, options } = credentials
        const { error } = await _request(this.fetch, 'POST', `${this.url}/otp`, {
          body: {
            email,
            create_user: options?.shouldCreateUser ?? true,
            gotrue_meta_security: { captcha_token: options?.captchaToken },
          },
          redirectTo: options?.emailRedirectTo,
          headers: this.headers,
        })
        return { data: { user: null, session: null }, error }
      }
      if ('phone' in credentials) {
        const { phone, options } = credentials
        const { error } = await _request(this.fetch, 'POST', `${this.url}/otp`, {
          body: {
            phone,
            create_user: options?.shouldCreateUser ?? true,
            gotrue_meta_security: { captcha_token: options?.captchaToken },
          },
        })
        return { data: { user: null, session: null }, error }
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
   * @param email The user's email address.
   * @param phone The user's phone number.
   * @param token The user's password.
   * @param type The user's verification type.
   * @param options.redirectTo A URL to send the user to after they are confirmed.
   * @param options.captchaToken An optional captcha verification token.
   */
  async verifyOTP(
    params: VerifyOTPParams,
    options: {
      redirectTo?: string
      captchaToken?: string
    } = {}
  ): Promise<AuthResponse> {
    try {
      this._removeSession()

      const { data, error } = await _request(this.fetch, 'POST', `${this.url}/verify`, {
        body: {
          ...params,
          gotrue_meta_security: { captchaToken: options?.captchaToken },
        },
        redirectTo: options.redirectTo,
        xform: _sessionResponse,
      })

      if (error) {
        throw error
      }

      if (!data) {
        throw 'An error occurred on token verification.'
      }

      const session: Session | null = data.session
      const user: User = data.user

      if ((data as Session).access_token) {
        this._saveSession(session as Session)
        this._notifyAllSubscribers('SIGNED_IN', session)
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
   * Returns the session data, refreshing it if necessary.
   */
  async getSession(): Promise<
    | {
        session: Session
        error: null
      }
    | {
        session: null
        error: AuthError
      }
    | {
        session: null
        error: null
      }
  > {
    let currentSession: Session | null = null

    if (this.persistSession) {
      const maybeSession = await getItemAsync(this.storage, this.storageKey)

      if (this._doesSessionExist(maybeSession)) {
        currentSession = maybeSession
      } else {
        await this._removeSession()
      }
    } else {
      currentSession = this.inMemorySession
    }

    if (!currentSession) {
      return { session: null, error: null }
    }

    const hasExpired = currentSession.expires_at
      ? currentSession.expires_at <= Date.now() / 1000
      : false
    if (!hasExpired) {
      return { session: currentSession, error: null }
    }

    const { session, error } = await this._callRefreshToken(currentSession.refresh_token)
    if (error) {
      return { session: null, error }
    }

    return { session, error: null }
  }

  /**
   * Gets the current user details if there is an existing session.
   */
  async getUser(): Promise<UserResponse> {
    try {
      let access_token = ''
      if (!('Authorization' in this.headers)) {
        const { session, error } = await this.getSession()
        if (error) {
          throw error
        }
        if (!session) {
          throw new AuthSessionMissingError()
        }
        access_token = session.access_token
      }
      return await _request(this.fetch, 'GET', `${this.url}/user`, {
        headers: this.headers,
        jwt: access_token,
        xform: _userResponse,
      })
    } catch (error) {
      if (isAuthError(error)) {
        return { data: { user: null }, error }
      }

      throw error
    }
  }

  /**
   * Updates user data, if there is a logged in user.
   * @param attributes The data you want to update.
   */
  async updateUser(attributes: UserAttributes): Promise<UserResponse> {
    try {
      const { session, error: sessionError } = await this.getSession()
      if (sessionError) {
        throw sessionError
      }
      if (!session) {
        throw new AuthSessionMissingError()
      }
      const { data, error: userError } = await _request(this.fetch, 'PUT', `${this.url}/user`, {
        body: attributes,
        jwt: session.access_token,
        xform: _userResponse,
      })
      if (userError) throw userError
      session.user = data.user as User
      this._saveSession(session)
      this._notifyAllSubscribers('USER_UPDATED', session)

      return { data: { user: session.user }, error: null }
    } catch (error) {
      if (isAuthError(error)) {
        return { data: { user: null }, error }
      }

      throw error
    }
  }

  /**
   * Sets the session data from refresh_token and returns current Session and Error
   * @param refresh_token a JWT token
   */
  async setSession(refresh_token: string): Promise<AuthResponse> {
    try {
      if (!refresh_token) {
        throw new AuthSessionMissingError()
      }
      const { data, error } = await this._refreshAccessToken(refresh_token)
      if (error) {
        return { data: { session: null, user: null }, error: error }
      }

      this._saveSession(data.session!)

      this._notifyAllSubscribers('TOKEN_REFRESHED', data.session)
      return { data, error: null }
    } catch (error) {
      if (isAuthError(error)) {
        return { data: { session: null, user: null }, error }
      }

      throw error
    }
  }

  /**
   * Gets the session data from a URL string
   * @param options.storeSession Optionally store the session in the browser or in-memory
   */
  private async _getSessionFromUrl(): Promise<
    | {
        session: Session
        error: null
      }
    | { session: null; error: AuthError }
  > {
    try {
      if (!isBrowser()) throw new AuthApiError('No browser detected.', 500)

      const error_description = getParameterByName('error_description')
      if (error_description) throw new AuthApiError(error_description, 500)

      const provider_token = getParameterByName('provider_token')
      const access_token = getParameterByName('access_token')
      if (!access_token) throw new AuthApiError('No access_token detected.', 500)
      const expires_in = getParameterByName('expires_in')
      if (!expires_in) throw new AuthApiError('No expires_in detected.', 500)
      const refresh_token = getParameterByName('refresh_token')
      if (!refresh_token) throw new AuthApiError('No refresh_token detected.', 500)
      const token_type = getParameterByName('token_type')
      if (!token_type) throw new AuthApiError('No token_type detected.', 500)

      const timeNow = Math.round(Date.now() / 1000)
      const expires_at = timeNow + parseInt(expires_in)

      const { data, error } = await this.getUser()
      if (error) throw error

      const user: User = data.user!
      const session: Session = {
        provider_token,
        access_token,
        expires_in: parseInt(expires_in),
        expires_at,
        refresh_token,
        token_type,
        user,
      }

      this._saveSession(session)
      const recoveryMode = getParameterByName('type')
      this._notifyAllSubscribers('SIGNED_IN', session)
      if (recoveryMode === 'recovery') {
        this._notifyAllSubscribers('PASSWORD_RECOVERY', session)
      }

      // Remove tokens from URL
      window.location.hash = ''

      return { session, error: null }
    } catch (error) {
      if (isAuthError(error)) {
        return { session: null, error }
      }

      throw error
    }
  }

  /**
   * Inside a browser context, `signOut()` will remove the logged in user from the browser session
   * and log them out - removing all items from localstorage and then trigger a "SIGNED_OUT" event.
   *
   * For server-side management, you can revoke all refresh tokens for a user by passing a user's JWT through to `auth.api.signOut(JWT: string)`. There is no way to revoke a user's session JWT before it automatically expires
   */
  async signOut(): Promise<{ error: AuthError | null }> {
    const { session, error: sessionError } = await this.getSession()
    if (sessionError) {
      return { error: sessionError }
    }
    const accessToken = session?.access_token
    if (accessToken) {
      const { error } = await this.admin.signOut(accessToken)
      if (error) return { error }
    }
    this._removeSession()
    this._notifyAllSubscribers('SIGNED_OUT', null)
    return { error: null }
  }

  /**
   * Receive a notification every time an auth event happens.
   * @returns {Subscription} A subscription object which can be used to unsubscribe itself.
   */
  onAuthStateChange(callback: (event: AuthChangeEvent, session: Session | null) => void):
    | {
        subscription: Subscription
        error: null
      }
    | { subscription: null; error: AuthError } {
    try {
      const id: string = uuid()
      const subscription: Subscription = {
        id,
        callback,
        unsubscribe: () => {
          this.stateChangeEmitters.delete(id)
        },
      }
      this.stateChangeEmitters.set(id, subscription)
      return { subscription, error: null }
    } catch (error) {
      if (isAuthError(error)) {
        return { subscription: null, error }
      }

      throw error
    }
  }

  /**
   * Sends a reset request to an email address.
   * @param email The email address of the user.
   * @param options.redirectTo A URL to send the user to after they are confirmed.
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
    try {
      return await _request(this.fetch, 'POST', `${this.url}/recover`, {
        body: { email, gotrue_meta_security: { captcha_token: options.captchaToken } },
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
    try {
      return await _request(this.fetch, 'POST', `${this.url}/token?grant_type=refresh_token`, {
        body: { refresh_token: refreshToken },
        headers: this.headers,
        xform: _sessionResponse,
      })
    } catch (error) {
      if (isAuthError(error)) {
        return { data: { session: null, user: null }, error }
      }
      throw error
    }
  }

  private _doesSessionExist(maybeSession: unknown): maybeSession is Session {
    const isValidSession =
      typeof maybeSession === 'object' &&
      maybeSession !== null &&
      'access_token' in maybeSession &&
      'refresh_token' in maybeSession &&
      'expires_at' in maybeSession

    return isValidSession
  }

  private _handleProviderSignIn(
    provider: Provider,
    options: {
      redirectTo?: string
      scopes?: string
      queryParams?: { [key: string]: string }
    } = {}
  ) {
    const url: string = this._getUrlForProvider(provider, {
      redirectTo: options.redirectTo,
      scopes: options.scopes,
      queryParams: options.queryParams,
    })
    // try to open on the browser
    if (isBrowser()) {
      window.location.href = url
    }
    return { data: { provider, url }, error: null }
  }

  /**
   * Recovers the session from LocalStorage and refreshes
   * Note: this method is async to accommodate for AsyncStorage e.g. in React native.
   */
  private async _recoverAndRefresh() {
    try {
      const currentSession = await getItemAsync(this.storage, this.storageKey)
      if (!this._doesSessionExist(currentSession)) {
        await this._removeSession()
        return null
      }

      const timeNow = Math.round(Date.now() / 1000)

      if ((currentSession.expires_at ?? Infinity) < timeNow + EXPIRY_MARGIN) {
        if (this.autoRefreshToken && currentSession.refresh_token) {
          this.networkRetries++
          const { error } = await this._callRefreshToken(currentSession.refresh_token)
          if (error) {
            console.log(error.message)
            if (
              error instanceof AuthRetryableFetchError &&
              this.networkRetries < NETWORK_FAILURE.MAX_RETRIES
            ) {
              if (this.refreshTokenTimer) clearTimeout(this.refreshTokenTimer)
              this.refreshTokenTimer = setTimeout(
                () => this._recoverAndRefresh(),
                NETWORK_FAILURE.RETRY_INTERVAL ** this.networkRetries * 100 // exponential backoff
              )
              return
            }
            await this._removeSession()
          }
          this.networkRetries = 0
        } else {
          this._removeSession()
        }
      } else {
        if (this.persistSession) {
          this._saveSession(currentSession)
        }
        this._notifyAllSubscribers('SIGNED_IN', currentSession)
      }
    } catch (err) {
      console.error(err)
      return null
    }
  }

  private async _callRefreshToken(refreshToken: string): Promise<CallRefreshTokenResult> {
    // refreshing is already in progress
    if (this.refreshingDeferred) {
      return this.refreshingDeferred.promise
    }

    try {
      this.refreshingDeferred = new Deferred<CallRefreshTokenResult>()

      if (!refreshToken) {
        throw new AuthSessionMissingError()
      }
      const { data, error } = await this._refreshAccessToken(refreshToken)
      if (error) throw error
      if (!data.session) throw new AuthSessionMissingError()

      this._saveSession(data.session)
      this._notifyAllSubscribers('TOKEN_REFRESHED', data.session)

      const result = { session: data.session, error: null }

      this.refreshingDeferred.resolve(result)

      return result
    } catch (error) {
      if (isAuthError(error)) {
        const result = { session: null, error }

        this.refreshingDeferred?.resolve(result)

        return result
      }

      this.refreshingDeferred?.reject(error)
      throw error
    } finally {
      this.refreshingDeferred = null
    }
  }

  private _notifyAllSubscribers(event: AuthChangeEvent, session: Session | null) {
    this.stateChangeEmitters.forEach((x) => x.callback(event, session))
  }

  /**
   * set currentSession and currentUser
   * process to _startAutoRefreshToken if possible
   */
  private _saveSession(session: Session) {
    if (!this.persistSession) {
      this.inMemorySession = session
    }

    const expiresAt = session.expires_at
    if (expiresAt) {
      const timeNow = Math.round(Date.now() / 1000)
      const expiresIn = expiresAt - timeNow
      const refreshDurationBeforeExpires = expiresIn > EXPIRY_MARGIN ? EXPIRY_MARGIN : 0.5
      this._startAutoRefreshToken((expiresIn - refreshDurationBeforeExpires) * 1000, session)
    }

    // Do we need any extra check before persist session
    // access_token or user ?
    if (this.persistSession && session.expires_at) {
      this._persistSession(session)
    }
  }

  private _persistSession(currentSession: Session) {
    setItemAsync(this.storage, this.storageKey, currentSession)
  }

  private async _removeSession() {
    if (this.persistSession) {
      removeItemAsync(this.storage, this.storageKey)
    } else {
      this.inMemorySession = null
    }

    if (this.refreshTokenTimer) {
      clearTimeout(this.refreshTokenTimer)
    }
  }

  /**
   * Clear and re-create refresh token timer
   * @param value time intervals in milliseconds
   */
  private _startAutoRefreshToken(value: number, session: Session) {
    if (this.refreshTokenTimer) clearTimeout(this.refreshTokenTimer)
    if (value <= 0 || !this.autoRefreshToken) return

    this.refreshTokenTimer = setTimeout(async () => {
      this.networkRetries++
      const { error } = await this._callRefreshToken(session.refresh_token)
      if (!error) this.networkRetries = 0
      if (
        error instanceof AuthRetryableFetchError &&
        this.networkRetries < NETWORK_FAILURE.MAX_RETRIES
      )
        this._startAutoRefreshToken(
          NETWORK_FAILURE.RETRY_INTERVAL ** this.networkRetries * 100,
          session
        ) // exponential backoff
    }, value)
    if (typeof this.refreshTokenTimer.unref === 'function') this.refreshTokenTimer.unref()
  }

  private _handleVisibilityChange() {
    if (!isBrowser() || !window?.addEventListener) {
      return false
    }

    try {
      window?.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          this._recoverAndRefresh()
        }
      })
    } catch (error) {
      console.error('_handleVisibilityChange', error)
    }
  }

  /**
   * Generates the relevant login URL for a third-party provider.
   * @param provider One of the providers supported by GoTrue.
   * @param options.redirectTo A URL or mobile address to send the user to after they are confirmed.
   * @param options.scopes A space-separated list of scopes granted to the OAuth application.
   * @param options.queryParams An object of key-value pairs containing query parameters granted to the OAuth application.
   */
  private _getUrlForProvider(
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
    if (options?.queryParams) {
      const query = new URLSearchParams(options.queryParams)
      urlParams.push(query.toString())
    }
    return `${this.url}/authorize?${urlParams.join('&')}`
  }
}
