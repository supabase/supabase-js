import { get, post, put } from './lib/fetch'
import { Session, UserAttributes } from './lib/types'

export default class Api {
  url: string
  headers: {
    [key: string]: string
  }

  constructor({ url = '', headers = {} }: any) {
    this.url = url
    this.headers = headers
  }

  signUpWithEmail(email: string, password: string) {
    return post(`${this.url}/signup`, { email, password }, { headers: this.headers })
  }

  signInWithEmail(email: string, password: string) {
    return post(
      `${this.url}/token?grant_type=password`,
      { email, password },
      { headers: this.headers }
    )
  }

  resetPasswordForEmail(email: string) {
    return post(`${this.url}/forgotPassword`, { email }, { headers: this.headers })
  }

  async signOut(jwt: string) {
    let headers = { ...this.headers }
    headers['Authorization'] = `Bearer ${jwt}`
    console.log('headers', headers)
    let data = await post(`${this.url}/logout`, {}, { headers, noResolveJson: true })
    return data
  }

  getUser(jwt: string) {
    let headers = { ...this.headers }
    headers['Authorization'] = `Bearer ${jwt}`
    return get(`${this.url}/user`, { headers })
  }

  updateUser(jwt: string, attributes: UserAttributes) {
    let headers = { ...this.headers }
    headers['Authorization'] = `Bearer ${jwt}`
    return put(`${this.url}/user`, attributes, { headers })
  }

  refreshAccessToken(refreshToken: string) {
    return post(
      `${this.url}/token?grant_type=refresh_token`,
      { refresh_token: refreshToken },
      { headers: this.headers }
    )
  }
}
