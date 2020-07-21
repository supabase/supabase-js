const superagent = require('superagent')

class Auth {
  constructor(authUrl, supabaseKey, options = { autoRefreshToken: true }) {
    this.authUrl = authUrl
    this.accessToken = null
    this.refreshToken = null
    this.supabaseKey = supabaseKey
    this.currentUser = null
    this.autoRefreshToken = options.autoRefreshToken

    this.signup = async (email, password) => {
      const { body } = await superagent
        .post(`${authUrl}/signup`, { email, password })
        .set('accept', 'json')
        .set('apikey', this.supabaseKey)

      return body
    }

    this.login = async (email, password) => {
    
      const response = await superagent
        .post(`${authUrl}/token?grant_type=password`, { email, password })
        .set('accept', 'json')
        .set('apikey', this.supabaseKey)

      if (response.status === 200) {
        this.accessToken = response.body['access_token']
        this.refreshToken = response.body['refresh_token']
        if (this.autoRefreshToken && tokenExirySeconds)
          setTimeout(this.refreshToken, tokenExirySeconds - 60)
      }
      return response
    }

    this.refreshToken = async () => {
      const response = await superagent
        .post(`${authUrl}/token?grant_type=refresh_token`, { refresh_token: this.refreshToken })
        .set('apikey', this.supabaseKey)

      if (response.status === 200) {
        this.accessToken = response.body['access_token']
        this.refreshToken = response.body['refresh_token']
        let tokenExirySeconds = response.body['expires_in']
        if (this.autoRefreshToken && tokenExirySeconds)
          setTimeout(this.refreshToken, tokenExirySeconds - 60)
      }
      return response
    }

    this.logout = async () => {
      await superagent
        .post(`${authUrl}/logout`)
        .set('Authorization', `Bearer ${this.accessToken}`)
        .set('apikey', this.supabaseKey)

      this.currentUser = null
      this.accessToken = null
    }

    // this.setRefreshTokenExpiry = (refreshTokenExpirySeconds) => {
    //   let bufferSeconds = 60
    //   let t = new Date() // current time
    //   this.refreshTokenExpiry = t.setSeconds(
    //     t.getSeconds() + (refreshTokenExpirySeconds - bufferSeconds)
    //   )
    // }

    this.user = async () => {
      if (this.currentUser) return this.currentUser

      const response = await superagent
        .get(`${authUrl}/user`)
        .set('Authorization', `Bearer ${this.accessToken}`)
        .set('apikey', this.supabaseKey)

      if (response.status === 200) {
        this.currentUser = response.body
        this.currentUser['access_token'] = this.accessToken
        this.currentUser['refresh_token'] = this.refreshToken
      }
      return this.currentUser
    }
  }
}

export { Auth }
