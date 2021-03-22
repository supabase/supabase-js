import { get, post, put } from './lib/fetch'
import { Session, Provider, UserAttributes, CookieOptions, User } from './lib/types'
import { COOKIE_OPTIONS } from './lib/constants'
import { setCookie, deleteCookie } from './lib/cookies'
import { expiresAt } from './lib/helpers'

export default class GoTrueApi {
  protected url: string
  protected headers: {
    [key: string]: string
  }
  protected cookieOptions: CookieOptions

  constructor({
    url = '',
    headers = {},
    cookieOptions,
  }: {
    url: string
    headers?: {
      [key: string]: string
    }
    cookieOptions?: CookieOptions
  }) {
    this.url = url
    this.headers = headers
    this.cookieOptions = { ...COOKIE_OPTIONS, ...cookieOptions }
  }

  /**
   * Creates a new user using their email address.
   * @param email The email address of the user.
   * @param password The password of the user.
   * @param redirectTo A URL or mobile address to send the user to after they are confirmed.
   *
   * @returns A logged-in session if the server has "autoconfirm" ON
   * @returns A user if the server has "autoconfirm" OFF
   */
  async signUpWithEmail(
    email: string,
    password: string,
    options: {
      redirectTo?: string
    } = {}
  ): Promise<{ data: Session | User | null; error: Error | null }> {
    try {
      let headers = { ...this.headers }
      if (options.redirectTo) {
        headers['referer'] = options.redirectTo
      }
      const data = await post(`${this.url}/signup`, { email, password }, { headers })
      let session = { ...data }
      if (session.expires_in) session.expires_at = expiresAt(data.expires_in)
      return { data: session, error: null }
    } catch (error) {
      return { data: null, error }
    }
  }

  /**
   * Logs in an existing user using their email address.
   * @param email The email address of the user.
   * @param password The password of the user.
   * @param redirectTo A URL or mobile address to send the user to after they are confirmed.
   */
  async signInWithEmail(
    email: string,
    password: string,
    options: {
      redirectTo?: string
    } = {}
  ): Promise<{ data: Session | null; error: Error | null }> {
    try {
      let headers = { ...this.headers }
      if (options.redirectTo) {
        headers['referer'] = options.redirectTo
      }
      const data = await post(
        `${this.url}/token?grant_type=password`,
        { email, password },
        { headers }
      )
      let session = { ...data }
      if (session.expires_in) session.expires_at = expiresAt(data.expires_in)
      return { data: session, error: null }
    } catch (error) {
      return { data: null, error }
    }
  }

  /**
   * Sends a magic login link to an email address.
   * @param email The email address of the user.
   * @param redirectTo A URL or mobile address to send the user to after they are confirmed.
   */
  async sendMagicLinkEmail(
    email: string,
    options: {
      redirectTo?: string
    } = {}
  ): Promise<{ data: {} | null; error: Error | null }> {
    try {
      let headers = { ...this.headers }
      if (options.redirectTo) {
        headers['referer'] = options.redirectTo
      }
      const data = await post(`${this.url}/magiclink`, { email }, { headers })
      return { data, error: null }
    } catch (error) {
      return { data: null, error }
    }
  }

  /**
   * Sends an invite link to an email address.
   * @param email The email address of the user.
   * @param redirectTo A URL or mobile address to send the user to after they are confirmed.
   */
  async inviteUserByEmail(
    email: string,
    options: {
      redirectTo?: string
    } = {}
  ): Promise<{ data: {} | null; error: Error | null }> {
    try {
      let headers = { ...this.headers }
      if (options.redirectTo) {
        headers['referer'] = options.redirectTo
      }
      const data = await post(`${this.url}/invite`, { email }, { headers })
      return { data, error: null }
    } catch (error) {
      return { data: null, error }
    }
  }

  /**
   * Sends a reset request to an email address.
   * @param email The email address of the user.
   * @param redirectTo A URL or mobile address to send the user to after they are confirmed.
   */
  async resetPasswordForEmail(
    email: string,
    options: {
      redirectTo?: string
    } = {}
  ): Promise<{ data: {} | null; error: Error | null }> {
    try {
      let headers = { ...this.headers }
      if (options.redirectTo) {
        headers['referer'] = options.redirectTo
      }
      const data = await post(`${this.url}/recover`, { email }, { headers })
      return { data, error: null }
    } catch (error) {
      return { data: null, error }
    }
  }

  /**
   * Create a temporary object with all configured headers and
   * adds the Authorization token to be used on request methods
   * @param jwt A valid, logged-in JWT.
   */
  private _createRequestHeaders(jwt: string) {
    const headers = { ...this.headers }
    headers['Authorization'] = `Bearer ${jwt}`
    return headers
  }

  /**
   * Removes a logged-in session.
   * @param jwt A valid, logged-in JWT.
   */
  async signOut(jwt: string): Promise<{ error: Error | null }> {
    try {
      await post(
        `${this.url}/logout`,
        {},
        { headers: this._createRequestHeaders(jwt), noResolveJson: true }
      )
      return { error: null }
    } catch (error) {
      return { error }
    }
  }

  /**
   * Generates the relevant login URL for a third-party provider.
   * @param provider One of the providers supported by GoTrue.
   * @param redirectTo A URL or mobile address to send the user to after they are confirmed.
   * @param scopes A space-separated list of scopes granted to the OAuth application.
   */
  getUrlForProvider(
    provider: Provider,
    options: {
      redirectTo?: string
      scopes?: string
    }
  ) {
    let urlParams: string[] = [`provider=${provider}`]
    if (options?.redirectTo) {
      urlParams.push(`redirect_to=${options.redirectTo}`)
    }
    if (options?.scopes) {
      urlParams.push(`scopes=${options.scopes}`)
    }
    return `${this.url}/authorize?${urlParams.join('&')}`
  }

  /**
   * Gets the user details.
   * @param jwt A valid, logged-in JWT.
   */
  async getUser(
    jwt: string
  ): Promise<{ user: User | null; data: User | null; error: Error | null }> {
    try {
      const data: any = await get(`${this.url}/user`, { headers: this._createRequestHeaders(jwt) })
      return { user: data, data, error: null }
    } catch (error) {
      return { user: null, data: null, error }
    }
  }

  /**
   * Updates the user data.
   * @param jwt A valid, logged-in JWT.
   * @param attributes The data you want to update.
   */
  async updateUser(
    jwt: string,
    attributes: UserAttributes
  ): Promise<{ user: User | null; data: User | null; error: Error | null }> {
    try {
      const data: any = await put(`${this.url}/user`, attributes, {
        headers: this._createRequestHeaders(jwt),
      })
      return { user: data, data, error: null }
    } catch (error) {
      return { user: null, data: null, error }
    }
  }

  /**
   * Generates a new JWT.
   * @param refreshToken A valid refresh token that was returned on login.
   */
  async refreshAccessToken(
    refreshToken: string
  ): Promise<{ data: Session | null; error: Error | null }> {
    try {
      const data: any = await post(
        `${this.url}/token?grant_type=refresh_token`,
        { refresh_token: refreshToken },
        { headers: this.headers }
      )
      let session = { ...data }
      if (session.expires_in) session.expires_at = expiresAt(data.expires_in)
      return { data: session, error: null }
    } catch (error) {
      return { data: null, error }
    }
  }

  /**
   * Set/delete the auth cookie based on the AuthChangeEvent.
   * Works for Next.js & Express (requires cookie-parser middleware).
   */
  setAuthCookie(req: any, res: any) {
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST')
      res.status(405).end('Method Not Allowed')
    }
    const { event, session } = req.body
    if (!event) throw new Error('Auth event missing!')
    if (event === 'SIGNED_IN') {
      if (!session) throw new Error('Auth session missing!')
      setCookie(req, res, {
        name: this.cookieOptions.name!,
        value: session.access_token,
        domain: this.cookieOptions.domain,
        maxAge: this.cookieOptions.lifetime!,
        path: this.cookieOptions.path,
        sameSite: this.cookieOptions.sameSite,
      })
    }
    if (event === 'SIGNED_OUT') deleteCookie(req, res, this.cookieOptions.name!)
    res.status(200).json({})
  }

  /**
   * Get user by reading the cookie from the request.
   * Works for Next.js & Express (requires cookie-parser middleware).
   */
  async getUserByCookie(
    req: any
  ): Promise<{ user: User | null; data: User | null; error: Error | null }> {
    try {
      if (!req.cookies)
        throw new Error(
          'Not able to parse cookies! When using Express make sure the cookie-parser middleware is in use!'
        )
      if (!req.cookies[this.cookieOptions.name!]) throw new Error('No cookie found!')
      const token = req.cookies[this.cookieOptions.name!]
      const { user, error } = await this.getUser(token)
      if (error) throw error
      return { user, data: user, error: null }
    } catch (error) {
      return { user: null, data: null, error }
    }
  }
}
