import Api from './Api'
import { isBrowser, getParameterByName, uuid } from './lib/helpers'
import { GOTRUE_URL, DEFAULT_HEADERS, STORAGE_KEY } from './lib/constants'
import { Session, User, UserAttributes, Provider, Subscription, AuthChangeEvent } from './lib/types'

const DEFAULT_OPTIONS = {
  url: GOTRUE_URL,
  autoRefreshToken: true,
  persistSession: true,
  detectSessionInUrl: true,
  headers: DEFAULT_HEADERS,
}
export default class Client {
  api: Api
  currentUser: User | null
  currentSession?: Session | null
  autoRefreshToken: boolean
  persistSession: boolean
  stateChangeEmmitters: Map<string, Subscription> = new Map()

  /**
   * Create a new client for use in the browser.
   * @param options.url The URL of the GoTrue server.
   * @param options.headers Any additional headers to send to the GoTrue server.
   * @param options.detectSessionInUrl Set to "true" if you want to automatically detects OAuth grants in the URL and signs in the user.
   * @param options.autoRefreshToken Set to "true" if you want to automatically refresh the token before expiring.
   * @param options.persistSession Set to "true" if you want to automatically save the user session into local storage.
   */
  constructor(options: {
    url?: string
    headers?: { [key: string]: string }
    detectSessionInUrl?: boolean
    autoRefreshToken?: boolean
    persistSession?: boolean
  }) {
    const settings = { ...DEFAULT_OPTIONS, ...options }
    this.currentUser = null
    this.currentSession = null
    this.autoRefreshToken = settings.autoRefreshToken
    this.persistSession = settings.persistSession
    this.api = new Api({ url: settings.url, headers: settings.headers })
    this._recoverSession()

    // Handle the OAuth redirect
    try {
      if (settings.detectSessionInUrl && isBrowser() && !!getParameterByName('access_token')) {
        this.getSessionFromUrl({ storeSession: true })
      }
    } catch (error) {
      console.log('Error getting session from URL.')
    }
  }

  /**
   * Creates a new user.
   * @param credentials The user login details.
   * @param credentials.email The user's email address.
   * @param credentials.password The user's password.
   */
  async signUp(credentials: { email: string; password: string }) {
    try {
      this._removeSession()

      let { data, error }: any = await this.api.signUpWithEmail(
        credentials.email,
        credentials.password
      )
      if (error) throw new Error(error)

      if (data?.user?.confirmed_at) {
        this._saveSession(data)
        this._notifyAllSubscribers(AuthChangeEvent.SIGNED_IN)
      }

      return { data, error: null }
    } catch (error) {
      return { data: null, error }
    }
  }

  /**
   * Log in an existing user, or login via a third-party provider.
   * @param credentials The user login details.
   * @param credentials.email The user's email address.
   * @param credentials.password The user's password.
   * @param credentials.provider One of the providers supported by GoTrue.
   */
  async signIn(credentials: { email?: string; password?: string; provider?: Provider }) {
    try {
      this._removeSession()
      let { email, password, provider } = credentials

      if (email && password) return this._handeEmailSignIn(email, password)
      if (provider) return this._handeProviderSignIn(provider)
      else throw new Error(`You must provide either an email or a third-party provider.`)
    } catch (error) {
      return { data: null, error }
    }
  }

  /**
   * Returns the user data, if there is a logged in user.
   */
  async user() {
    try {
      if (!this.currentSession?.access_token) throw new Error('Not logged in.')

      let { data, error }: any = await this.api.getUser(this.currentSession.access_token)
      if (error) throw new Error(error)

      this.currentUser = data
      return { data: this.currentUser, error: null }
    } catch (error) {
      return { data: null, error }
    }
  }

  /**
   * Updates user data, if there is a logged in user.
   */
  async update(attributes: UserAttributes) {
    try {
      if (!this.currentSession?.access_token) throw new Error('Not logged in.')

      let { data, error }: any = await this.api.updateUser(
        this.currentSession.access_token,
        attributes
      )
      if (error) throw new Error(error)

      this.currentUser = data
      this._notifyAllSubscribers(AuthChangeEvent.USER_UPDATED)

      return { data: this.currentUser, error: null }
    } catch (error) {
      return { data: null, error }
    }
  }

  /**
   * Gets the session data from a URL string
   * @param options.storeSession Optionally store the session in the browser
   */
  async getSessionFromUrl(options?: { storeSession?: boolean }) {
    try {
      if (!isBrowser()) throw new Error('No browser detected.')

      const error_description = getParameterByName('error_description')
      if (error_description) throw new Error(error_description)

      const access_token = getParameterByName('access_token')
      const expires_in = getParameterByName('expires_in')
      const refresh_token = getParameterByName('refresh_token')
      const token_type = getParameterByName('token_type')
      if (!access_token) throw new Error('No access_token detected.')
      if (!expires_in) throw new Error('No expires_in detected.')
      if (!refresh_token) throw new Error('No refresh_token detected.')
      if (!token_type) throw new Error('No token_type detected.')

      let { data: user, error }: any = await this.api.getUser(access_token)
      if (error) throw new Error(error)

      const session: Session = {
        access_token,
        expires_in: parseInt(expires_in),
        refresh_token,
        token_type,
        user,
      }
      if (options?.storeSession) {
        this._saveSession(session)
        this._notifyAllSubscribers(AuthChangeEvent.SIGNED_IN)
      }

      return { data: session, error: null }
    } catch (error) {
      return { data: null, error }
    }
  }

  /**
   * Signs out the current user, if there is a logged in user.
   */
  async signOut() {
    try {
      if (this.currentSession) {
        await this.api.signOut(this.currentSession.access_token)
      }
      this._removeSession()
      this._notifyAllSubscribers(AuthChangeEvent.SIGNED_OUT)
      return true
    } catch (error) {
      return { data: null, error }
    }
  }

  /**
   * Receive a notification every time an auth event happens.
   * @returns {Subscription} A subscription object which can be used to unsubcribe itself.
   */
  onAuthStateChange(callback: Function) {
    try {
      const id: string = uuid()
      let self = this
      const subscription: Subscription = {
        id,
        callback,
        unsubscribe: () => self.stateChangeEmmitters.delete(id),
      }
      this.stateChangeEmmitters.set(id, subscription)
      return { data: this.stateChangeEmmitters.get(id), error: null }
    } catch (error) {
      return { data: null, error }
    }
  }

  private async _handeEmailSignIn(email: string, password: string) {
    try {
      let { data, error }: any = await this.api.signInWithEmail(email, password)
      if (!!error) return { data: null, error }

      if (data?.user?.confirmed_at) {
        this._saveSession(data)
        this._notifyAllSubscribers(AuthChangeEvent.SIGNED_IN)
      }

      return { data, error: null }
    } catch (error) {
      console.log('error_handeEmailSignIn', error)
      return { data: null, error }
    }
  }

  private _handeProviderSignIn(provider: Provider) {
    let url: string = this.api.getUrlForProvider(provider)

    try {
      // try to open on the browser
      if (isBrowser()) {
        window.location.href = url
      }

      return { data: url, error: null }
    } catch (error) {
      // fallback to returning the URL
      if (!!url) return { data: url, error: null }
      else return { data: null, error }
    }
  }

  private _saveSession(session: Session) {
    this.currentSession = session
    this.currentUser = session.user
    let tokenExpirySeconds = session['expires_in']

    if (this.autoRefreshToken && tokenExpirySeconds) {
      setTimeout(this._callRefreshToken, (tokenExpirySeconds - 60) * 1000)
    }

    if (this.persistSession) {
      this._persistSession(this.currentSession, tokenExpirySeconds)
    }
  }

  private _persistSession(currentSession: Session, secondsToExpiry: number) {
    const timeNow = Math.round(Date.now() / 1000)
    const expiresAt = timeNow + secondsToExpiry
    const data = { currentSession, expiresAt }
    isBrowser() && localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  }

  private _removeSession() {
    this.currentSession = null
    this.currentUser = null
    isBrowser() && localStorage.removeItem(STORAGE_KEY)
  }

  private _recoverSession() {
    const json = isBrowser() && localStorage.getItem(STORAGE_KEY)
    if (json) {
      try {
        const data = JSON.parse(json)
        const { currentSession, expiresAt } = data

        const timeNow = Math.round(Date.now() / 1000)
        if (expiresAt < timeNow) {
          console.log('Saved session has expired.')
          this._removeSession()
        } else if (!currentSession || !currentSession.user) {
          console.log('Current session is missing data.')
          this._removeSession()
        } else {
          this.currentSession = currentSession
          this.currentUser = currentSession.user
          // schedule a refresh 60 seconds before token due to expire
          setTimeout(this._callRefreshToken, (expiresAt - timeNow - 60) * 1000)
        }
      } catch (err) {
        console.error(err)
        return null
      }
    }
    return null
  }

  private async _callRefreshToken() {
    try {
      if (this.currentSession?.refresh_token) {
        let data: any = await this.api.refreshAccessToken(this.currentSession?.refresh_token)

        if (data?.access_token) {
          this.currentSession.access_token = data.body['access_token']
          this.currentSession.refresh_token = data.body['refresh_token']
          let tokenExpirySeconds = data.body['expires_in']

          if (this.autoRefreshToken && tokenExpirySeconds) {
            setTimeout(this._callRefreshToken, (tokenExpirySeconds - 60) * 1000)
          }

          if (this.persistSession && this.currentUser) {
            this._persistSession(this.currentSession, tokenExpirySeconds)
          }
        }
        return { data, error: null }
      }
    } catch (error) {
      return { data: null, error }
    }
  }

  private _notifyAllSubscribers(event: AuthChangeEvent) {
    this.stateChangeEmmitters.forEach((x) => x.callback(event, this.currentSession))
  }
}
