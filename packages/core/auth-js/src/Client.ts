import Api from './Api'
import { isBrowser } from './lib/helpers'
import { STORAGE_KEY } from './lib/constants'
import { GOTRUE_URL, DEFAULT_HEADERS } from './lib/constants'
import { Session, User, UserAttributes } from './lib/types'

export default class Client {
  api: Api
  currentUser: User | null
  currentSession?: Session | null
  autoRefreshToken: boolean
  persistSession: boolean

  constructor({
    url = GOTRUE_URL,
    autoRefreshToken = true,
    persistSession = true,
    headers = DEFAULT_HEADERS,
  }: any) {
    this.currentUser = null
    this.currentSession = null
    this.autoRefreshToken = autoRefreshToken
    this.persistSession = persistSession
    this.api = new Api({ url, headers })
    this._recoverSession()
  }

  /**
   * Creates a new user.
   * @param credentials the user login details
   * @param credentials.email the user's email
   */
  async signUp(credentials: { email: string; password: string }) {
    try {
      this._removeSession()

      let { data, error }: any = await this.api.signUpWithEmail(
        credentials.email,
        credentials.password
      )
      if (error) throw new Error(error)

      if (data?.user?.confirmed_at) this._saveSession(data)

      return { data, error: null }
    } catch (error) {
      return { data: null, error: error.message }
    }
  }

  async signIn({ email, password }: { email: string; password: string }) {
    try {
      this._removeSession()

      let { data, error }: any = await this.api.signInWithEmail(email, password)
      if (error) throw new Error(error)

      if (data?.user?.confirmed_at) this._saveSession(data)

      return { data, error: null }
    } catch (error) {
      return { data: null, error: error.message }
    }
  }

  async user() {
    try {
      if (!this.currentSession?.access_token) throw new Error('Not logged in.')

      let { data, error }: any = await this.api.getUser(this.currentSession.access_token)
      if (error) throw new Error(error)

      this.currentUser = data
      return { data: this.currentUser, error: null }
    } catch (error) {
      return { data: null, error: error.message }
    }
  }

  async update(attributes: UserAttributes) {
    try {
      if (!this.currentSession?.access_token) throw new Error('Not logged in.')

      let { data, error }: any = await this.api.updateUser(
        this.currentSession.access_token,
        attributes
      )
      if (error) throw new Error(error)

      this.currentUser = data
      return { data: this.currentUser, error: null }
    } catch (error) {
      return { data: null, error: error.message }
    }
  }

  async signOut() {
    try {
      if (this.currentSession) {
        await this.api.signOut(this.currentSession.access_token)
      }
      this._removeSession()
      return true
    } catch (error) {
      return { data: null, error: error.message }
    }
  }

  _saveSession(session: Session) {
    this.currentSession = session
    this.currentUser = session['user']
    let tokenExpirySeconds = session['expires_in']

    if (this.autoRefreshToken && tokenExpirySeconds) {
      setTimeout(this._callRefreshToken, (tokenExpirySeconds - 60) * 1000)
    }

    if (this.persistSession) {
      this._persistSession(this.currentSession, this.currentUser, tokenExpirySeconds)
    }
  }

  _persistSession(currentSession: Session, currentUser: User, secondsToExpiry: number) {
    const timeNow = Math.round(Date.now() / 1000)
    const expiresAt = timeNow + secondsToExpiry
    const data = { currentSession, currentUser, expiresAt }
    isBrowser() && localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  }

  _removeSession() {
    this.currentSession = null
    this.currentUser = null
    isBrowser() && localStorage.removeItem(STORAGE_KEY)
  }

  _recoverSession() {
    const json = isBrowser() && localStorage.getItem(STORAGE_KEY)
    if (json) {
      try {
        const data = JSON.parse(json)
        const { currentSession, currentUser, expiresAt } = data

        const timeNow = Math.round(Date.now() / 1000)
        if (expiresAt < timeNow) {
          console.log('Saved session has expired.')
          this._removeSession()
        } else {
          this.currentSession = currentSession
          this.currentUser = currentUser
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

  async _callRefreshToken() {
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
            this._persistSession(this.currentSession, this.currentUser, tokenExpirySeconds)
          }
        }
        return { data, error: null }
      }
    } catch (error) {
      return { data: null, error: error.message }
    }
  }
}
