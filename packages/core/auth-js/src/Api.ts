import { get, post, put } from './lib/fetch'
import { Provider, UserAttributes } from './lib/types'

export default class Api {
  url: string
  headers: {
    [key: string]: string
  }

  constructor({ url = '', headers = {} }: any) {
    this.url = url
    this.headers = headers
  }

  /**
   * Creates a new user using their email address.
   * @param email The email address of the user.
   * @param password The password of the user.
   */
  async signUpWithEmail(email: string, password: string) {
    try {
      let data: any = await post(
        `${this.url}/signup`,
        { email, password },
        { headers: this.headers }
      )
      return { data, error: null }
    } catch (error) {
      return { data: null, error: error.message }
    }
  }

  /**
   * Logs in an existing using their email address.
   * @param email The email address of the user.
   * @param password The password of the user.
   */
  async signInWithEmail(email: string, password: string) {
    try {
      let data: any = await post(
        `${this.url}/token?grant_type=password`,
        { email, password },
        { headers: this.headers }
      )
      return { data, error: null }
    } catch (error) {
      return { data: null, error: error.message }
    }
  }

  /**
   * Sends a reset request to an email address.
   * @param email The email address of the user.
   */
  async resetPasswordForEmail(email: string) {
    try {
      let data: any = await post(`${this.url}/forgotPassword`, { email }, { headers: this.headers })
      return { data, error: null }
    } catch (error) {
      return { data: null, error: error.message }
    }
  }

  /**
   * Removes a logged-in session.
   * @param jwt A valid, logged-in JWT.
   */
  async signOut(jwt: string) {
    try {
      let headers = { ...this.headers }
      headers['Authorization'] = `Bearer ${jwt}`
      let data = await post(`${this.url}/logout`, {}, { headers, noResolveJson: true })
      return { data, error: null }
    } catch (error) {
      return { data: null, error: error.message }
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
      return { data: null, error: error.message }
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
      return { data: null, error: error.message }
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
      return { data: null, error: error.message }
    }
  }
}
