import { Fetch, get, post, put, remove } from './lib/fetch'
import { Session, Provider, UserAttributes, CookieOptions, User } from './lib/types'
import { COOKIE_OPTIONS } from './lib/constants'
import { setCookie, deleteCookie } from './lib/cookies'
import { expiresAt } from './lib/helpers'

import type { ApiError } from './lib/types'
export default class GoTrueApi {
  protected url: string
  protected headers: {
    [key: string]: string
  }
  protected cookieOptions: CookieOptions
  protected fetch?: Fetch

  constructor({
    url = '',
    headers = {},
    cookieOptions,
    fetch,
  }: {
    url: string
    headers?: {
      [key: string]: string
    }
    cookieOptions?: CookieOptions
    fetch?: Fetch
  }) {
    this.url = url
    this.headers = headers
    this.cookieOptions = { ...COOKIE_OPTIONS, ...cookieOptions }
    this.fetch = fetch
  }

  /**
   * Creates a new user.
   *
   * This function should only be called on a server. Never expose your `service_role` key in the browser.
   *
   * @param attributes The data you want to create the user with.
   * @param jwt A valid JWT. Must be a full-access API key (e.g. service_role key).
   */
  async createUser(
    attributes: UserAttributes
  ): Promise<{ data: null; error: ApiError } | { data: User; error: null }> {
    try {
      const data: any = await post(this.fetch, `${this.url}/admin/users`, attributes, {
        headers: this.headers,
      })
      return { data, error: null }
    } catch (e) {
      return { data: null, error: e as ApiError }
    }
  }

  /**
   * Get a list of users.
   *
   * This function should only be called on a server. Never expose your `service_role` key in the browser.
   */
  async listUsers(): Promise<{ data: null; error: ApiError } | { data: User[]; error: null }> {
    try {
      const data: any = await get(this.fetch, `${this.url}/admin/users`, {
        headers: this.headers,
      })
      return { data: data.users, error: null }
    } catch (e) {
      return { data: null, error: e as ApiError }
    }
  }

  /**
   * Creates a new user using their email address.
   * @param email The email address of the user.
   * @param password The password of the user.
   * @param redirectTo A URL or mobile address to send the user to after they are confirmed.
   * @param data Optional user metadata.
   *
   * @returns A logged-in session if the server has "autoconfirm" ON
   * @returns A user if the server has "autoconfirm" OFF
   */
  async signUpWithEmail(
    email: string,
    password: string,
    options: {
      redirectTo?: string
      data?: object
    } = {}
  ): Promise<{ data: Session | User | null; error: ApiError | null }> {
    try {
      const headers = { ...this.headers }
      let queryString = ''
      if (options.redirectTo) {
        queryString = '?redirect_to=' + encodeURIComponent(options.redirectTo)
      }
      const data = await post(
        this.fetch,
        `${this.url}/signup${queryString}`,
        { email, password, data: options.data },
        { headers }
      )
      const session = { ...data }
      if (session.expires_in) session.expires_at = expiresAt(data.expires_in)
      return { data: session, error: null }
    } catch (e) {
      return { data: null, error: e as ApiError }
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
  ): Promise<{ data: Session | null; error: ApiError | null }> {
    try {
      const headers = { ...this.headers }
      let queryString = '?grant_type=password'
      if (options.redirectTo) {
        queryString += '&redirect_to=' + encodeURIComponent(options.redirectTo)
      }
      const data = await post(
        this.fetch,
        `${this.url}/token${queryString}`,
        { email, password },
        { headers }
      )
      const session = { ...data }
      if (session.expires_in) session.expires_at = expiresAt(data.expires_in)
      return { data: session, error: null }
    } catch (e) {
      return { data: null, error: e as ApiError }
    }
  }

  /**
   * Signs up a new user using their phone number and a password.
   * @param phone The phone number of the user.
   * @param password The password of the user.
   * @param data Optional user metadata.
   */
  async signUpWithPhone(
    phone: string,
    password: string,
    options: {
      data?: object
    } = {}
  ): Promise<{ data: Session | User | null; error: ApiError | null }> {
    try {
      const headers = { ...this.headers }
      const data = await post(
        this.fetch,
        `${this.url}/signup`,
        { phone, password, data: options.data },
        { headers }
      )
      const session = { ...data }
      if (session.expires_in) session.expires_at = expiresAt(data.expires_in)
      return { data: session, error: null }
    } catch (e) {
      return { data: null, error: e as ApiError }
    }
  }

  /**
   * Logs in an existing user using their phone number and password.
   * @param phone The phone number of the user.
   * @param password The password of the user.
   */
  async signInWithPhone(
    phone: string,
    password: string
  ): Promise<{ data: Session | null; error: ApiError | null }> {
    try {
      const headers = { ...this.headers }
      const queryString = '?grant_type=password'
      const data = await post(
        this.fetch,
        `${this.url}/token${queryString}`,
        { phone, password },
        { headers }
      )
      const session = { ...data }
      if (session.expires_in) session.expires_at = expiresAt(data.expires_in)
      return { data: session, error: null }
    } catch (e) {
      return { data: null, error: e as ApiError }
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
  ): Promise<{ data: {} | null; error: ApiError | null }> {
    try {
      const headers = { ...this.headers }
      let queryString = ''
      if (options.redirectTo) {
        queryString += '?redirect_to=' + encodeURIComponent(options.redirectTo)
      }
      const data = await post(
        this.fetch,
        `${this.url}/magiclink${queryString}`,
        { email },
        { headers }
      )
      return { data, error: null }
    } catch (e) {
      return { data: null, error: e as ApiError }
    }
  }

  /**
   * Sends a mobile OTP via SMS. Will register the account if it doesn't already exist
   * @param phone The user's phone number WITH international prefix
   */
  async sendMobileOTP(phone: string): Promise<{ data: {} | null; error: ApiError | null }> {
    try {
      const headers = { ...this.headers }
      const data = await post(this.fetch, `${this.url}/otp`, { phone }, { headers })
      return { data, error: null }
    } catch (e) {
      return { data: null, error: e as ApiError }
    }
  }

  /**
   * Send User supplied Mobile OTP to be verified
   * @param phone The user's phone number WITH international prefix
   * @param token token that user was sent to their mobile phone
   * @param redirectTo A URL or mobile address to send the user to after they are confirmed.
   */
  async verifyMobileOTP(
    phone: string,
    token: string,
    options: {
      redirectTo?: string
    } = {}
  ): Promise<{ data: Session | User | null; error: ApiError | null }> {
    try {
      const headers = { ...this.headers }
      const data = await post(
        this.fetch,
        `${this.url}/verify`,
        { phone, token, type: 'sms', redirect_to: options.redirectTo },
        { headers }
      )
      return { data, error: null }
    } catch (e) {
      return { data: null, error: e as ApiError }
    }
  }

  /**
   * Sends an invite link to an email address.
   * @param email The email address of the user.
   * @param redirectTo A URL or mobile address to send the user to after they are confirmed.
   * @param data Optional user metadata
   */
  async inviteUserByEmail(
    email: string,
    options: {
      redirectTo?: string
      data?: object
    } = {}
  ): Promise<{ data: User | null; error: ApiError | null }> {
    try {
      const headers = { ...this.headers }
      let queryString = ''
      if (options.redirectTo) {
        queryString += '?redirect_to=' + encodeURIComponent(options.redirectTo)
      }
      const data = await post(
        this.fetch,
        `${this.url}/invite${queryString}`,
        { email, data: options.data },
        { headers }
      )
      return { data, error: null }
    } catch (e) {
      return { data: null, error: e as ApiError }
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
  ): Promise<{ data: {} | null; error: ApiError | null }> {
    try {
      const headers = { ...this.headers }
      let queryString = ''
      if (options.redirectTo) {
        queryString += '?redirect_to=' + encodeURIComponent(options.redirectTo)
      }
      const data = await post(
        this.fetch,
        `${this.url}/recover${queryString}`,
        { email },
        { headers }
      )
      return { data, error: null }
    } catch (e) {
      return { data: null, error: e as ApiError }
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
  async signOut(jwt: string): Promise<{ error: ApiError | null }> {
    try {
      await post(
        this.fetch,
        `${this.url}/logout`,
        {},
        { headers: this._createRequestHeaders(jwt), noResolveJson: true }
      )
      return { error: null }
    } catch (e) {
      return { error: e as ApiError }
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
    const urlParams: string[] = [`provider=${encodeURIComponent(provider)}`]
    if (options?.redirectTo) {
      urlParams.push(`redirect_to=${encodeURIComponent(options.redirectTo)}`)
    }
    if (options?.scopes) {
      urlParams.push(`scopes=${encodeURIComponent(options.scopes)}`)
    }
    return `${this.url}/authorize?${urlParams.join('&')}`
  }

  /**
   * Gets the user details.
   * @param jwt A valid, logged-in JWT.
   */
  async getUser(
    jwt: string
  ): Promise<{ user: User | null; data: User | null; error: ApiError | null }> {
    try {
      const data: any = await get(this.fetch, `${this.url}/user`, {
        headers: this._createRequestHeaders(jwt),
      })
      return { user: data, data, error: null }
    } catch (e) {
      return { user: null, data: null, error: e as ApiError }
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
  ): Promise<{ user: User | null; data: User | null; error: ApiError | null }> {
    try {
      const data: any = await put(this.fetch, `${this.url}/user`, attributes, {
        headers: this._createRequestHeaders(jwt),
      })
      return { user: data, data, error: null }
    } catch (e) {
      return { user: null, data: null, error: e as ApiError }
    }
  }

  /**
   * Delete a user. Requires a `service_role` key.
   *
   * This function should only be called on a server. Never expose your `service_role` key in the browser.
   *
   * @param uid The user uid you want to remove.
   * @param jwt A valid JWT. Must be a full-access API key (e.g. service_role key).
   */
  async deleteUser(
    uid: string,
    jwt: string
  ): Promise<{ user: User | null; data: User | null; error: ApiError | null }> {
    try {
      const data: any = await remove(
        this.fetch,
        `${this.url}/admin/users/${uid}`,
        {},
        {
          headers: this._createRequestHeaders(jwt),
        }
      )
      return { user: data, data, error: null }
    } catch (e) {
      return { user: null, data: null, error: e as ApiError }
    }
  }

  /**
   * Generates a new JWT.
   * @param refreshToken A valid refresh token that was returned on login.
   */
  async refreshAccessToken(
    refreshToken: string
  ): Promise<{ data: Session | null; error: ApiError | null }> {
    try {
      const data: any = await post(
        this.fetch,
        `${this.url}/token?grant_type=refresh_token`,
        { refresh_token: refreshToken },
        { headers: this.headers }
      )
      const session = { ...data }
      if (session.expires_in) session.expires_at = expiresAt(data.expires_in)
      return { data: session, error: null }
    } catch (e) {
      return { data: null, error: e as ApiError }
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
  async getUserByCookie(req: any): Promise<{
    token: string | null
    user: User | null
    data: User | null
    error: ApiError | null
  }> {
    try {
      if (!req.cookies) {
        throw new Error(
          'Not able to parse cookies! When using Express make sure the cookie-parser middleware is in use!'
        )
      }
      if (!req.cookies[this.cookieOptions.name!]) {
        throw new Error('No cookie found!')
      }
      const token = req.cookies[this.cookieOptions.name!]
      const { user, error } = await this.getUser(token)
      if (error) throw error
      return { token, user, data: user, error: null }
    } catch (e) {
      return { token: null, user: null, data: null, error: e as ApiError }
    }
  }

  /**
   * Generates links to be sent via email or other.
   * @param type The link type ("signup" or "magiclink" or "recovery" or "invite").
   * @param email The user's email.
   * @param password User password. For signup only.
   * @param data Optional user metadata. For signup only.
   * @param redirectTo The link type ("signup" or "magiclink" or "recovery" or "invite").
   */
  async generateLink(
    type: 'signup' | 'magiclink' | 'recovery' | 'invite',
    email: string,
    options: {
      password?: string
      data?: object
      redirectTo?: string
    } = {}
  ): Promise<{ data: Session | User | null; error: ApiError | null }> {
    try {
      const data: any = await post(
        this.fetch,
        `${this.url}/admin/generate_link`,
        {
          type,
          email,
          password: options.password,
          data: options.data,
          redirect_to: options.redirectTo,
        },
        { headers: this.headers }
      )
      return { data, error: null }
    } catch (e) {
      return { data: null, error: e as ApiError }
    }
  }
}
