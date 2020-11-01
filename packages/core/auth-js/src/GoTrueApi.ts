import { get, post, put } from './lib/fetch'
import { Session, Provider, UserAttributes } from './lib/types'

export default class GoTrueApi {
  protected url: string
  protected headers: {
    [key: string]: string
  }

  constructor({
    url = '',
    headers = {},
  }: {
    url: string
    headers: {
      [key: string]: string
    }
  }) {
    this.url = url
    this.headers = headers
  }

  /**
   * Creates a new user using their email address.
   * @param email The email address of the user.
   * @param password The password of the user.
   */
  async signUpWithEmail(
    email: string,
    password: string
  ): Promise<{ data: Session | null; error: Error | null }> {
    try {
      const data = await post(`${this.url}/signup`, { email, password }, { headers: this.headers })
      return { data, error: null }
    } catch (error) {
      return { data: null, error }
    }
  }

  /**
   * Logs in an existing using their email address.
   * @param email The email address of the user.
   * @param password The password of the user.
   */
  async signInWithEmail(
    email: string,
    password: string
  ): Promise<{ data: Session | null; error: Error | null }> {
    try {
      const data = await post(
        `${this.url}/token?grant_type=password`,
        { email, password },
        { headers: this.headers }
      )
      return { data, error: null }
    } catch (error) {
      return { data: null, error }
    }
  }

  /**
   * Sends a magic login link to an email address.
   * @param email The email address of the user.
   */
  async sendMagicLinkEmail(email: string): Promise<{ data: {} | null; error: Error | null }> {
    try {
      const data = await post(`${this.url}/magiclink`, { email }, { headers: this.headers })
      return { data, error: null }
    } catch (error) {
      return { data: null, error }
    }
  }

  /**
   * Sends a reset request to an email address.
   * @param email The email address of the user.
   */
  async resetPasswordForEmail(email: string): Promise<{ data: {} | null; error: Error | null }> {
    try {
      const data = await post(`${this.url}/recover`, { email }, { headers: this.headers })
      return { data, error: null }
    } catch (error) {
      return { data: null, error }
    }
  }

  /**
   * Removes a logged-in session.
   * @param jwt A valid, logged-in JWT.
   */
  async signOut(jwt: string): Promise<{ error: Error | null }> {
    try {
      let headers = { ...this.headers }
      headers['Authorization'] = `Bearer ${jwt}`
      await post(`${this.url}/logout`, {}, { headers, noResolveJson: true })
      return { error: null }
    } catch (error) {
      return { error }
    }
  }

  /**
   * Generates the relevant login URL for a third-party provider.
   * @param provider One of the providers supported by GoTrue.
   */
  getUrlForProvider(provider: Provider) {
    return `${this.url}/authorize?provider=${provider}`
  }

  /**
   * Gets the user details.
   * @param jwt A valid, logged-in JWT.
   */
  async getUser(jwt: string) {
    try {
      let headers = { ...this.headers }
      headers['Authorization'] = `Bearer ${jwt}`
      let data: any = await get(`${this.url}/user`, { headers })
      return { data, error: null }
    } catch (error) {
      return { data: null, error }
    }
  }

  /**
   * Updates the user data.
   * @param jwt A valid, logged-in JWT.
   * @param attributes The data you want to update.
   */
  async updateUser(jwt: string, attributes: UserAttributes) {
    try {
      let headers = { ...this.headers }
      headers['Authorization'] = `Bearer ${jwt}`
      let data: any = await put(`${this.url}/user`, attributes, { headers })
      return { data, error: null }
    } catch (error) {
      return { data: null, error }
    }
  }

  /**
   * Generates a new JWT.
   * @param refreshToken A valid refresh token that was returned on login.
   */
  async refreshAccessToken(refreshToken: string) {
    try {
      let data: any = await post(
        `${this.url}/token?grant_type=refresh_token`,
        { refresh_token: refreshToken },
        { headers: this.headers }
      )
      return { data, error: null }
    } catch (error) {
      return { data: null, error }
    }
  }
}
