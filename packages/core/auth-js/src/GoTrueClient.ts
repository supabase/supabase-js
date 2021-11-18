import GoTrueApi from './GoTrueApi'
import { isBrowser, getParameterByName, uuid } from './lib/helpers'
import { GOTRUE_URL, DEFAULT_HEADERS, STORAGE_KEY } from './lib/constants'
import { polyfillGlobalThis } from './lib/polyfills'
import { Fetch } from './lib/fetch'

import type {
  ApiError,
  Session,
  User,
  UserAttributes,
  Provider,
  Subscription,
  AuthChangeEvent,
  CookieOptions,
  UserCredentials,
  VerifyOTPParams,
} from './lib/types'

polyfillGlobalThis() // Make "globalThis" available

const DEFAULT_OPTIONS = {
  url: GOTRUE_URL,
  autoRefreshToken: true,
  persistSession: true,
  detectSessionInUrl: true,
  multiTab: true,
  headers: DEFAULT_HEADERS,
}

type AnyFunction = (...args: any[]) => any
type MaybePromisify<T> = T | Promise<T>

type PromisifyMethods<T> = {
  [K in keyof T]: T[K] extends AnyFunction
    ? (...args: Parameters<T[K]>) => MaybePromisify<ReturnType<T[K]>>
    : T[K]
}

type SupportedStorage = PromisifyMethods<Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>>

export default class GoTrueClient {
  /**
   * Namespace for the GoTrue API methods.
   * These can be used for example to get a user from a JWT in a server environment or reset a user's password.
   */
  api: GoTrueApi
  /**
   * The currently logged in user or null.
   */
  protected currentUser: User | null
  /**
   * The session object for the currently logged in user or null.
   */
  protected currentSession: Session | null

  protected autoRefreshToken: boolean
  protected persistSession: boolean
  protected localStorage: SupportedStorage
  protected multiTab: boolean
  protected stateChangeEmitters: Map<string, Subscription> = new Map()
  protected refreshTokenTimer?: ReturnType<typeof setTimeout>

  /**
   * Create a new client for use in the browser.
   * @param options.url The URL of the GoTrue server.
   * @param options.headers Any additional headers to send to the GoTrue server.
   * @param options.detectSessionInUrl Set to "true" if you want to automatically detects OAuth grants in the URL and signs in the user.
   * @param options.autoRefreshToken Set to "true" if you want to automatically refresh the token before expiring.
   * @param options.persistSession Set to "true" if you want to automatically save the user session into local storage.
   * @param options.localStorage Provide your own local storage implementation to use instead of the browser's local storage.
   * @param options.multiTab Set to "false" if you want to disable multi-tab/window events.
   * @param options.cookieOptions
   * @param options.fetch A custom fetch implementation.
   */
  constructor(options: {
    url?: string
    headers?: { [key: string]: string }
    detectSessionInUrl?: boolean
    autoRefreshToken?: boolean
    persistSession?: boolean
    localStorage?: SupportedStorage
    multiTab?: boolean
    cookieOptions?: CookieOptions
    fetch?: Fetch
  }) {
    const settings = { ...DEFAULT_OPTIONS, ...options }
    this.currentUser = null
    this.currentSession = null
    this.autoRefreshToken = settings.autoRefreshToken
    this.persistSession = settings.persistSession
    this.multiTab = settings.multiTab
    this.localStorage = settings.localStorage || globalThis.localStorage
    this.api = new GoTrueApi({
      url: settings.url,
      headers: settings.headers,
      cookieOptions: settings.cookieOptions,
      fetch: settings.fetch,
    })
    this._recoverSession()
    this._recoverAndRefresh()
    this._listenForMultiTabEvents()

    if (settings.detectSessionInUrl && isBrowser() && !!getParameterByName('access_token')) {
      // Handle the OAuth redirect
      this.getSessionFromUrl({ storeSession: true }).then(({ error }) => {
        if (error) {
          console.error('Error getting session from URL.', error)
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
   * @param redirectTo A URL or mobile address to send the user to after they are confirmed.
   * @param data Optional user metadata.
   */
  async signUp(
    { email, password, phone }: UserCredentials,
    options: {
      redirectTo?: string
      data?: object
    } = {}
  ): Promise<{
    user: User | null
    session: Session | null
    error: ApiError | null
  }> {
    try {
      this._removeSession()

      const { data, error } =
        phone && password
          ? await this.api.signUpWithPhone(phone!, password!, {
              data: options.data,
            })
          : await this.api.signUpWithEmail(email!, password!, {
              redirectTo: options.redirectTo,
              data: options.data,
            })

      if (error) {
        throw error
      }

      if (!data) {
        throw 'An error occurred on sign up.'
      }

      let session: Session | null = null
      let user: User | null = null

      if ((data as Session).access_token) {
        session = data as Session
        user = session.user as User
        this._saveSession(session)
        this._notifyAllSubscribers('SIGNED_IN')
      }

      if ((data as User).id) {
        user = data as User
      }

      return { user, session, error: null }
    } catch (e) {
      return { user: null, session: null, error: e as ApiError }
    }
  }

  /**
   * Log in an existing user, or login via a third-party provider.
   * @type UserCredentials
   * @param email The user's email address.
   * @param password The user's password.
   * @param refreshToken A valid refresh token that was returned on login.
   * @param provider One of the providers supported by GoTrue.
   * @param redirectTo A URL or mobile address to send the user to after they are confirmed.
   * @param scopes A space-separated list of scopes granted to the OAuth application.
   */
  async signIn(
    { email, phone, password, refreshToken, provider }: UserCredentials,
    options: {
      redirectTo?: string
      scopes?: string
    } = {}
  ): Promise<{
    session: Session | null
    user: User | null
    provider?: Provider
    url?: string | null
    error: ApiError | null
  }> {
    try {
      this._removeSession()

      if (email && !password) {
        const { error } = await this.api.sendMagicLinkEmail(email, {
          redirectTo: options.redirectTo,
        })
        return { user: null, session: null, error }
      }
      if (email && password) {
        return this._handleEmailSignIn(email, password, {
          redirectTo: options.redirectTo,
        })
      }
      if (phone && !password) {
        const { error } = await this.api.sendMobileOTP(phone)
        return { user: null, session: null, error }
      }
      if (phone && password) {
        return this._handlePhoneSignIn(phone, password)
      }
      if (refreshToken) {
        // currentSession and currentUser will be updated to latest on _callRefreshToken using the passed refreshToken
        const { error } = await this._callRefreshToken(refreshToken)
        if (error) throw error

        return {
          user: this.currentUser,
          session: this.currentSession,
          error: null,
        }
      }
      if (provider) {
        return this._handleProviderSignIn(provider, {
          redirectTo: options.redirectTo,
          scopes: options.scopes,
        })
      }
      throw new Error(`You must provide either an email, phone number or a third-party provider.`)
    } catch (e) {
      return { user: null, session: null, error: e as ApiError }
    }
  }

  /**
   * Log in a user given a User supplied OTP received via mobile.
   * @param phone The user's phone number.
   * @param token The user's password.
   * @param redirectTo A URL or mobile address to send the user to after they are confirmed.
   */
  async verifyOTP(
    { phone, token }: VerifyOTPParams,
    options: {
      redirectTo?: string
    } = {}
  ): Promise<{
    user: User | null
    session: Session | null
    error: ApiError | null
  }> {
    try {
      this._removeSession()

      const { data, error } = await this.api.verifyMobileOTP(phone, token, options)

      if (error) {
        throw error
      }

      if (!data) {
        throw 'An error occurred on token verification.'
      }

      let session: Session | null = null
      let user: User | null = null

      if ((data as Session).access_token) {
        session = data as Session
        user = session.user as User
        this._saveSession(session)
        this._notifyAllSubscribers('SIGNED_IN')
      }

      if ((data as User).id) {
        user = data as User
      }

      return { user, session, error: null }
    } catch (e) {
      return { user: null, session: null, error: e as ApiError }
    }
  }

  /**
   * Inside a browser context, `user()` will return the user data, if there is a logged in user.
   *
   * For server-side management, you can get a user through `auth.api.getUserByCookie()`
   */
  user(): User | null {
    return this.currentUser
  }

  /**
   * Returns the session data, if there is an active session.
   */
  session(): Session | null {
    return this.currentSession
  }

  /**
   * Force refreshes the session including the user data in case it was updated in a different session.
   */
  async refreshSession(): Promise<{
    data: Session | null
    user: User | null
    error: ApiError | null
  }> {
    try {
      if (!this.currentSession?.access_token) throw new Error('Not logged in.')

      // currentSession and currentUser will be updated to latest on _callRefreshToken
      const { error } = await this._callRefreshToken()
      if (error) throw error

      return { data: this.currentSession, user: this.currentUser, error: null }
    } catch (e) {
      return { data: null, user: null, error: e as ApiError }
    }
  }

  /**
   * Updates user data, if there is a logged in user.
   */
  async update(
    attributes: UserAttributes
  ): Promise<{ data: User | null; user: User | null; error: ApiError | null }> {
    try {
      if (!this.currentSession?.access_token) throw new Error('Not logged in.')

      const { user, error } = await this.api.updateUser(
        this.currentSession.access_token,
        attributes
      )
      if (error) throw error
      if (!user) throw Error('Invalid user data.')

      const session = { ...this.currentSession, user }
      this._saveSession(session)
      this._notifyAllSubscribers('USER_UPDATED')

      return { data: user, user, error: null }
    } catch (e) {
      return { data: null, user: null, error: e as ApiError }
    }
  }

  /**
   * Sets the session data from refresh_token and returns current Session and Error
   * @param refresh_token a JWT token
   */
  async setSession(
    refresh_token: string
  ): Promise<{ session: Session | null; error: ApiError | null }> {
    try {
      if (!refresh_token) {
        throw new Error('No current session.')
      }
      const { data, error } = await this.api.refreshAccessToken(refresh_token)
      if (error) {
        return { session: null, error: error }
      }

      this._saveSession(data!)
      this._notifyAllSubscribers('SIGNED_IN')
      return { session: data, error: null }
    } catch (e) {
      return { error: e as ApiError, session: null }
    }
  }

  /**
   * Overrides the JWT on the current client. The JWT will then be sent in all subsequent network requests.
   * @param access_token a jwt access token
   */
  setAuth(access_token: string): Session {
    this.currentSession = {
      ...this.currentSession,
      access_token,
      token_type: 'bearer',
      user: null,
    }

    return this.currentSession
  }

  /**
   * Gets the session data from a URL string
   * @param options.storeSession Optionally store the session in the browser
   */
  async getSessionFromUrl(options?: {
    storeSession?: boolean
  }): Promise<{ data: Session | null; error: ApiError | null }> {
    try {
      if (!isBrowser()) throw new Error('No browser detected.')

      const error_description = getParameterByName('error_description')
      if (error_description) throw new Error(error_description)

      const provider_token = getParameterByName('provider_token')
      const access_token = getParameterByName('access_token')
      if (!access_token) throw new Error('No access_token detected.')
      const expires_in = getParameterByName('expires_in')
      if (!expires_in) throw new Error('No expires_in detected.')
      const refresh_token = getParameterByName('refresh_token')
      if (!refresh_token) throw new Error('No refresh_token detected.')
      const token_type = getParameterByName('token_type')
      if (!token_type) throw new Error('No token_type detected.')

      const timeNow = Math.round(Date.now() / 1000)
      const expires_at = timeNow + parseInt(expires_in)

      const { user, error } = await this.api.getUser(access_token)
      if (error) throw error

      const session: Session = {
        provider_token,
        access_token,
        expires_in: parseInt(expires_in),
        expires_at,
        refresh_token,
        token_type,
        user: user!,
      }
      if (options?.storeSession) {
        this._saveSession(session)
        const recoveryMode = getParameterByName('type')
        this._notifyAllSubscribers('SIGNED_IN')
        if (recoveryMode === 'recovery') {
          this._notifyAllSubscribers('PASSWORD_RECOVERY')
        }
      }
      // Remove tokens from URL
      window.location.hash = ''

      return { data: session, error: null }
    } catch (e) {
      return { data: null, error: e as ApiError }
    }
  }

  /**
   * Inside a browser context, `signOut()` will remove the logged in user from the browser session
   * and log them out - removing all items from localstorage and then trigger a "SIGNED_OUT" event.
   *
   * For server-side management, you can disable sessions by passing a JWT through to `auth.api.signOut(JWT: string)`
   */
  async signOut(): Promise<{ error: ApiError | null }> {
    const accessToken = this.currentSession?.access_token
    this._removeSession()
    this._notifyAllSubscribers('SIGNED_OUT')
    if (accessToken) {
      const { error } = await this.api.signOut(accessToken)
      if (error) return { error }
    }
    return { error: null }
  }

  /**
   * Receive a notification every time an auth event happens.
   * @returns {Subscription} A subscription object which can be used to unsubscribe itself.
   */
  onAuthStateChange(callback: (event: AuthChangeEvent, session: Session | null) => void): {
    data: Subscription | null
    error: ApiError | null
  } {
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
      return { data: subscription, error: null }
    } catch (e) {
      return { data: null, error: e as ApiError }
    }
  }

  private async _handleEmailSignIn(
    email: string,
    password: string,
    options: {
      redirectTo?: string
    } = {}
  ) {
    try {
      const { data, error } = await this.api.signInWithEmail(email, password, {
        redirectTo: options.redirectTo,
      })
      if (error || !data) return { data: null, user: null, session: null, error }

      if (data?.user?.confirmed_at || data?.user?.email_confirmed_at) {
        this._saveSession(data)
        this._notifyAllSubscribers('SIGNED_IN')
      }

      return { data, user: data.user, session: data, error: null }
    } catch (e) {
      return { data: null, user: null, session: null, error: e as ApiError }
    }
  }

  private async _handlePhoneSignIn(phone: string, password: string) {
    try {
      const { data, error } = await this.api.signInWithPhone(phone, password)
      if (error || !data) return { data: null, user: null, session: null, error }

      if (data?.user?.phone_confirmed_at) {
        this._saveSession(data)
        this._notifyAllSubscribers('SIGNED_IN')
      }

      return { data, user: data.user, session: data, error: null }
    } catch (e) {
      return { data: null, user: null, session: null, error: e as ApiError }
    }
  }

  private _handleProviderSignIn(
    provider: Provider,
    options: {
      redirectTo?: string
      scopes?: string
    } = {}
  ) {
    const url: string = this.api.getUrlForProvider(provider, {
      redirectTo: options.redirectTo,
      scopes: options.scopes,
    })

    try {
      // try to open on the browser
      if (isBrowser()) {
        window.location.href = url
      }
      return { provider, url, data: null, session: null, user: null, error: null }
    } catch (e) {
      // fallback to returning the URL
      if (url) return { provider, url, data: null, session: null, user: null, error: null }
      return { data: null, user: null, session: null, error: e as ApiError }
    }
  }

  /**
   * Attempts to get the session from LocalStorage
   * Note: this should never be async (even for React Native), as we need it to return immediately in the constructor.
   */
  private _recoverSession() {
    try {
      const json = isBrowser() && this.localStorage?.getItem(STORAGE_KEY)
      if (!json || typeof json !== 'string') {
        return null
      }

      const data = JSON.parse(json)
      const { currentSession, expiresAt } = data
      const timeNow = Math.round(Date.now() / 1000)

      if (expiresAt >= timeNow && currentSession?.user) {
        this._saveSession(currentSession)
        this._notifyAllSubscribers('SIGNED_IN')
      }
    } catch (error) {
      console.log('error', error)
    }
  }

  /**
   * Recovers the session from LocalStorage and refreshes
   * Note: this method is async to accommodate for AsyncStorage e.g. in React native.
   */
  private async _recoverAndRefresh() {
    try {
      const json = isBrowser() && (await this.localStorage.getItem(STORAGE_KEY))
      if (!json) {
        return null
      }

      const data = JSON.parse(json)
      const { currentSession, expiresAt } = data
      const timeNow = Math.round(Date.now() / 1000)

      if (expiresAt < timeNow) {
        if (this.autoRefreshToken && currentSession.refresh_token) {
          const { error } = await this._callRefreshToken(currentSession.refresh_token)
          if (error) {
            console.log(error.message)
            await this._removeSession()
          }
        } else {
          this._removeSession()
        }
      } else if (!currentSession || !currentSession.user) {
        console.log('Current session is missing data.')
        this._removeSession()
      } else {
        // should be handled on _recoverSession method already
        // But we still need the code here to accommodate for AsyncStorage e.g. in React native
        this._saveSession(currentSession)
        this._notifyAllSubscribers('SIGNED_IN')
      }
    } catch (err) {
      console.error(err)
      return null
    }
  }

  private async _callRefreshToken(refresh_token = this.currentSession?.refresh_token) {
    try {
      if (!refresh_token) {
        throw new Error('No current session.')
      }
      const { data, error } = await this.api.refreshAccessToken(refresh_token)
      if (error) throw error
      if (!data) throw Error('Invalid session data.')

      this._saveSession(data)
      this._notifyAllSubscribers('TOKEN_REFRESHED')
      this._notifyAllSubscribers('SIGNED_IN')

      return { data, error: null }
    } catch (e) {
      return { data: null, error: e as ApiError }
    }
  }

  private _notifyAllSubscribers(event: AuthChangeEvent) {
    this.stateChangeEmitters.forEach((x) => x.callback(event, this.currentSession))
  }

  /**
   * set currentSession and currentUser
   * process to _startAutoRefreshToken if possible
   */
  private _saveSession(session: Session) {
    this.currentSession = session
    this.currentUser = session.user

    const expiresAt = session.expires_at
    if (expiresAt) {
      const timeNow = Math.round(Date.now() / 1000)
      const expiresIn = expiresAt - timeNow
      const refreshDurationBeforeExpires = expiresIn > 60 ? 60 : 0.5
      this._startAutoRefreshToken((expiresIn - refreshDurationBeforeExpires) * 1000)
    }

    // Do we need any extra check before persist session
    // access_token or user ?
    if (this.persistSession && session.expires_at) {
      this._persistSession(this.currentSession)
    }
  }

  private _persistSession(currentSession: Session) {
    const data = { currentSession, expiresAt: currentSession.expires_at }
    isBrowser() && this.localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  }

  private async _removeSession() {
    this.currentSession = null
    this.currentUser = null
    if (this.refreshTokenTimer) clearTimeout(this.refreshTokenTimer)
    isBrowser() && (await this.localStorage.removeItem(STORAGE_KEY))
  }

  /**
   * Clear and re-create refresh token timer
   * @param value time intervals in milliseconds
   */
  private _startAutoRefreshToken(value: number) {
    if (this.refreshTokenTimer) clearTimeout(this.refreshTokenTimer)
    if (value <= 0 || !this.autoRefreshToken) return

    this.refreshTokenTimer = setTimeout(() => this._callRefreshToken(), value)
    if (typeof this.refreshTokenTimer.unref === 'function') this.refreshTokenTimer.unref()
  }

  /**
   * Listens for changes to LocalStorage and updates the current session.
   */
  private _listenForMultiTabEvents() {
    if (!this.multiTab || !isBrowser() || !window?.addEventListener) {
      // console.debug('Auth multi-tab support is disabled.')
      return false
    }

    try {
      window?.addEventListener('storage', (e: StorageEvent) => {
        if (e.key === STORAGE_KEY) {
          const newSession = JSON.parse(String(e.newValue))
          if (newSession?.currentSession?.access_token) {
            this._recoverAndRefresh()
            this._notifyAllSubscribers('SIGNED_IN')
          } else {
            this._removeSession()
            this._notifyAllSubscribers('SIGNED_OUT')
          }
        }
      })
    } catch (error) {
      console.error('_listenForMultiTabEvents', error)
    }
  }
}
