import { Fetch, get, post, put, remove } from './lib/fetch'
import {
  Session,
  Provider,
  AdminUserAttributes,
  UserAttributes,
  CookieOptions,
  User,
  OpenIDConnectCredentials,
  VerifyOTPParams,
} from './lib/types'
import { COOKIE_OPTIONS } from './lib/constants'
import { setCookies, getCookieString } from './lib/cookies'
import { expiresAt, resolveFetch } from './lib/helpers'

import type { ApiError } from './lib/types'
export default class GoTrueApi {
  protected url: string
  protected headers: {
    [key: string]: string
  }
  protected cookieOptions: CookieOptions
  protected fetch: Fetch

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
    this.fetch = resolveFetch(fetch)
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

  private cookieName() {
    return this.cookieOptions.name ?? ''
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
      captchaToken?: string
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
        {
          email,
          password,
          data: options.data,
          gotrue_meta_security: { hcaptcha_token: options.captchaToken },
        },
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
      captchaToken?: string
    } = {}
  ): Promise<{ data: Session | User | null; error: ApiError | null }> {
    try {
      const headers = { ...this.headers }
      const data = await post(
        this.fetch,
        `${this.url}/signup`,
        {
          phone,
          password,
          data: options.data,
          gotrue_meta_security: { hcaptcha_token: options.captchaToken },
        },
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
   * Logs in an OpenID Connect user using their id_token.
   * @param id_token The IDToken of the user.
   * @param nonce The nonce of the user. The nonce is a random value generated by the developer (= yourself) before the initial grant is started. You should check the OpenID Connect specification for details. https://openid.net/developers/specs/
   * @param provider The provider of the user.
   * @param client_id The clientID of the user.
   * @param issuer The issuer of the user.
   */
  async signInWithOpenIDConnect({
    id_token,
    nonce,
    client_id,
    issuer,
    provider,
  }: OpenIDConnectCredentials): Promise<{ data: Session | null; error: ApiError | null }> {
    try {
      const headers = { ...this.headers }
      const queryString = '?grant_type=id_token'
      const data = await post(
        this.fetch,
        `${this.url}/token${queryString}`,
        { id_token, nonce, client_id, issuer, provider },
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
   * @param shouldCreateUser A boolean flag to indicate whether to automatically create a user on magiclink / otp sign-ins if the user doesn't exist. Defaults to true.
   * @param redirectTo A URL or mobile address to send the user to after they are confirmed.
   */
  async sendMagicLinkEmail(
    email: string,
    options: {
      shouldCreateUser?: boolean
      redirectTo?: string
      captchaToken?: string
    } = {}
  ): Promise<{ data: {} | null; error: ApiError | null }> {
    try {
      const headers = { ...this.headers }
      let queryString = ''
      if (options.redirectTo) {
        queryString += '?redirect_to=' + encodeURIComponent(options.redirectTo)
      }

      const shouldCreateUser = options.shouldCreateUser ?? true
      const data = await post(
        this.fetch,
        `${this.url}/otp${queryString}`,
        {
          email,
          create_user: shouldCreateUser,
          gotrue_meta_security: { hcaptcha_token: options.captchaToken },
        },
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
   * @param shouldCreateUser A boolean flag to indicate whether to automatically create a user on magiclink / otp sign-ins if the user doesn't exist. Defaults to true.
   */
  async sendMobileOTP(
    phone: string,
    options: {
      shouldCreateUser?: boolean
      captchaToken?: string
    } = {}
  ): Promise<{ data: {} | null; error: ApiError | null }> {
    try {
      const shouldCreateUser = options.shouldCreateUser ?? true
      const headers = { ...this.headers }
      const data = await post(
        this.fetch,
        `${this.url}/otp`,
        {
          phone,
          create_user: shouldCreateUser,
          gotrue_meta_security: { hcaptcha_token: options.captchaToken },
        },
        { headers }
      )
      return { data, error: null }
    } catch (e) {
      return { data: null, error: e as ApiError }
    }
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
   * @deprecated Use `verifyOTP` instead!
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
      const session = { ...data }
      if (session.expires_in) session.expires_at = expiresAt(data.expires_in)
      return { data: session, error: null }
    } catch (e) {
      return { data: null, error: e as ApiError }
    }
  }

  /**
   * Send User supplied Email / Mobile OTP to be verified
   * @param email The user's email address
   * @param phone The user's phone number WITH international prefix
   * @param token token that user was sent to their mobile phone
   * @param type verification type that the otp is generated for
   * @param redirectTo A URL or mobile address to send the user to after they are confirmed.
   */
  async verifyOTP(
    { email, phone, token, type = 'sms' }: VerifyOTPParams,
    options: {
      redirectTo?: string
    } = {}
  ): Promise<{ data: Session | User | null; error: ApiError | null }> {
    try {
      const headers = { ...this.headers }
      const data = await post(
        this.fetch,
        `${this.url}/verify`,
        { email, phone, token, type, redirect_to: options.redirectTo },
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
      captchaToken?: string
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
        { email, gotrue_meta_security: { hcaptcha_token: options.captchaToken } },
        { headers }
      )
      return { data, error: null }
    } catch (e) {
      return { data: null, error: e as ApiError }
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
   * @param req The request object.
   * @param res The response object.
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
      setCookies(
        req,
        res,
        [
          { key: 'access-token', value: session.access_token },
          { key: 'refresh-token', value: session.refresh_token },
        ].map((token) => ({
          name: `${this.cookieName()}-${token.key}`,
          value: token.value,
          domain: this.cookieOptions.domain,
          maxAge: this.cookieOptions.lifetime ?? 0,
          path: this.cookieOptions.path,
          sameSite: this.cookieOptions.sameSite,
        }))
      )
    }
    if (event === 'SIGNED_OUT') {
      setCookies(
        req,
        res,
        ['access-token', 'refresh-token'].map((key) => ({
          name: `${this.cookieName()}-${key}`,
          value: '',
          maxAge: -1,
        }))
      )
    }
    res.status(200).json({})
  }

  /**
   * Deletes the Auth Cookies and redirects to the
   * @param req The request object.
   * @param res The response object.
   * @param options Optionally specify a `redirectTo` URL in the options.
   */
  deleteAuthCookie(req: any, res: any, { redirectTo = '/' }: { redirectTo?: string }) {
    setCookies(
      req,
      res,
      ['access-token', 'refresh-token'].map((key) => ({
        name: `${this.cookieName()}-${key}`,
        value: '',
        maxAge: -1,
      }))
    )
    return res.redirect(307, redirectTo)
  }

  /**
   * Helper method to generate the Auth Cookie string for you in case you can't use `setAuthCookie`.
   * @param req The request object.
   * @param res The response object.
   * @returns The Cookie string that needs to be set as the value for the `Set-Cookie` header.
   */
  getAuthCookieString(req: any, res: any): string[] {
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST')
      res.status(405).end('Method Not Allowed')
    }
    const { event, session } = req.body

    if (!event) throw new Error('Auth event missing!')
    if (event === 'SIGNED_IN') {
      if (!session) throw new Error('Auth session missing!')
      return getCookieString(
        req,
        res,
        [
          { key: 'access-token', value: session.access_token },
          { key: 'refresh-token', value: session.refresh_token },
        ].map((token) => ({
          name: `${this.cookieName()}-${token.key}`,
          value: token.value,
          domain: this.cookieOptions.domain,
          maxAge: this.cookieOptions.lifetime ?? 0,
          path: this.cookieOptions.path,
          sameSite: this.cookieOptions.sameSite,
        }))
      )
    }
    if (event === 'SIGNED_OUT') {
      return getCookieString(
        req,
        res,
        ['access-token', 'refresh-token'].map((key) => ({
          name: `${this.cookieName()}-${key}`,
          value: '',
          maxAge: -1,
        }))
      )
    }
    return res.getHeader('Set-Cookie')
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

  // User Admin API

  /**
   * Creates a new user.
   *
   * This function should only be called on a server. Never expose your `service_role` key in the browser.
   *
   * @param attributes The data you want to create the user with.
   */
  async createUser(
    attributes: AdminUserAttributes
  ): Promise<
    { user: null; data: null; error: ApiError } | { user: User; data: User; error: null }
  > {
    try {
      const data: any = await post(this.fetch, `${this.url}/admin/users`, attributes, {
        headers: this.headers,
      })
      return { user: data, data, error: null }
    } catch (e) {
      return { user: null, data: null, error: e as ApiError }
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
   * Get user by id.
   *
   * @param uid The user's unique identifier
   *
   * This function should only be called on a server. Never expose your `service_role` key in the browser.
   */
  async getUserById(
    uid: string
  ): Promise<{ data: null; error: ApiError } | { data: User; error: null }> {
    try {
      const data: any = await get(this.fetch, `${this.url}/admin/users/${uid}`, {
        headers: this.headers,
      })
      return { data, error: null }
    } catch (e) {
      return { data: null, error: e as ApiError }
    }
  }

  /**
   * Get user by reading the cookie from the request.
   * Works for Next.js & Express (requires cookie-parser middleware).
   */
  async getUserByCookie(
    req: any,
    res?: any
  ): Promise<{
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

      const access_token = req.cookies[`${this.cookieName()}-access-token`]
      const refresh_token = req.cookies[`${this.cookieName()}-refresh-token`]

      if (!access_token) {
        throw new Error('No cookie found!')
      }

      const { user, error: getUserError } = await this.getUser(access_token)
      if (getUserError) {
        if (!refresh_token) throw new Error('No refresh_token cookie found!')
        if (!res)
          throw new Error('You need to pass the res object to automatically refresh the session!')
        const { data, error } = await this.refreshAccessToken(refresh_token)
        if (error) {
          throw error
        } else if (data) {
          setCookies(
            req,
            res,
            [
              { key: 'access-token', value: data.access_token },
              { key: 'refresh-token', value: data.refresh_token! },
            ].map((token) => ({
              name: `${this.cookieName()}-${token.key}`,
              value: token.value,
              domain: this.cookieOptions.domain,
              maxAge: this.cookieOptions.lifetime ?? 0,
              path: this.cookieOptions.path,
              sameSite: this.cookieOptions.sameSite,
            }))
          )
          return { token: data.access_token, user: data.user, data: data.user, error: null }
        }
      }
      return { token: access_token, user: user, data: user, error: null }
    } catch (e) {
      return { token: null, user: null, data: null, error: e as ApiError }
    }
  }

  /**
   * Updates the user data.
   *
   * @param attributes The data you want to update.
   *
   * This function should only be called on a server. Never expose your `service_role` key in the browser.
   */
  async updateUserById(
    uid: string,
    attributes: AdminUserAttributes
  ): Promise<{ user: User | null; data: User | null; error: ApiError | null }> {
    try {
      this //
      const data: any = await put(this.fetch, `${this.url}/admin/users/${uid}`, attributes, {
        headers: this.headers,
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
   */
  async deleteUser(
    uid: string
  ): Promise<{ user: User | null; data: User | null; error: ApiError | null }> {
    try {
      const data: any = await remove(
        this.fetch,
        `${this.url}/admin/users/${uid}`,
        {},
        {
          headers: this.headers,
        }
      )
      return { user: data, data, error: null }
    } catch (e) {
      return { user: null, data: null, error: e as ApiError }
    }
  }

  /**
   * Gets the current user details.
   *
   * This method is called by the GoTrueClient `update` where
   * the jwt is set to this.currentSession.access_token
   * and therefore, acts like getting the currently authenticated used
   *
   * @param jwt A valid, logged-in JWT. Typically, the access_token for the currentSession
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
}
