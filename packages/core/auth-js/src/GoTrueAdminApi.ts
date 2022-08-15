import { Fetch, _request, _userResponse } from './lib/fetch'
import { resolveFetch } from './lib/helpers'
import { AdminUserAttributes, Session, User, UserResponse } from './lib/types'
import { AuthError, isAuthError } from './lib/errors'

export default class GoTrueAdminApi {
  protected url: string
  protected headers: {
    [key: string]: string
  }
  protected fetch: Fetch

  constructor({
    url = '',
    headers = {},
    fetch,
  }: {
    url: string
    headers?: {
      [key: string]: string
    }
    fetch?: Fetch
  }) {
    this.url = url
    this.headers = headers
    this.fetch = resolveFetch(fetch)
  }

  /**
   * Removes a logged-in session.
   * @param jwt A valid, logged-in JWT.
   */
  async signOut(jwt: string): Promise<{ error: AuthError | null }> {
    try {
      await _request(this.fetch, 'POST', `${this.url}/logout`, {
        jwt,
        noResolveJson: true,
      })
      return { error: null }
    } catch (error) {
      if (isAuthError(error)) {
        return { error }
      }

      throw error
    }
  }

  /**
   * Sends an invite link to an email address.
   * @param email The email address of the user.
   * @param options.redirectTo A URL or mobile address to send the user to after they are confirmed.
   * @param options.data Optional user metadata
   */
  async inviteUserByEmail(
    email: string,
    options: {
      redirectTo?: string
      data?: object
    } = {}
  ): Promise<UserResponse> {
    try {
      return await _request(this.fetch, 'POST', `${this.url}/invite`, {
        body: { email, data: options.data },
        headers: this.headers,
        redirectTo: options.redirectTo,
        xform: _userResponse,
      })
    } catch (error) {
      if (isAuthError(error)) {
        return { data: { user: null }, error }
      }

      throw error
    }
  }

  /**
   * Generates links to be sent via email or other.
   * @param type The link type ("signup" or "magiclink" or "recovery" or "invite").
   * @param email The user's email.
   * @param options.password User password. For signup only.
   * @param options.data Optional user metadata. For signup only.
   * @param options.redirectTo The link type ("signup" or "magiclink" or "recovery" or "invite").
   */
  async generateLink(
    type:
      | 'signup'
      | 'magiclink'
      | 'recovery'
      | 'invite'
      | 'email_change_current'
      | 'email_change_new',
    email: string,
    options: {
      password?: string
      data?: object
      redirectTo?: string
    } = {}
  ): Promise<
    | {
        data: User
        error: null
      }
    | {
        data: Session
        error: null
      }
    | { data: null; error: AuthError }
  > {
    try {
      return await _request(this.fetch, 'POST', `${this.url}/admin/generate_link`, {
        body: {
          type,
          email,
          password: options.password,
          data: options.data,
          redirect_to: options.redirectTo,
        },
        headers: this.headers,
      })
    } catch (error) {
      if (isAuthError(error)) {
        return { data: null, error }
      }
      throw error
    }
  }

  // User Admin API
  /**
   * Creates a new user.
   *
   * @param attributes The data you want to create the user with.
   *
   * This function should only be called on a server. Never expose your `service_role` key in the browser.
   */
  async createUser(attributes: AdminUserAttributes): Promise<UserResponse> {
    try {
      return await _request(this.fetch, 'POST', `${this.url}/admin/users`, {
        body: attributes,
        headers: this.headers,
        xform: _userResponse,
      })
    } catch (error) {
      if (isAuthError(error)) {
        return { data: { user: null }, error }
      }

      throw error
    }
  }

  /**
   * Get a list of users.
   *
   * This function should only be called on a server. Never expose your `service_role` key in the browser.
   */
  async listUsers(): Promise<
    { data: { users: User[] }; error: null } | { data: { users: [] }; error: AuthError }
  > {
    try {
      const { data, error } = await _request(this.fetch, 'GET', `${this.url}/admin/users`, {
        headers: this.headers,
      })
      if (error) throw error
      return { data: { ...data }, error: null }
    } catch (error) {
      if (isAuthError(error)) {
        return { data: { users: [] }, error }
      }
      throw error
    }
  }

  /**
   * Get user by id.
   *
   * @param uid The user's unique identifier
   *
   * This function should only be called on a server. Never expose your `service_role` key in the browser.
   */
  async getUserById(uid: string): Promise<UserResponse> {
    try {
      return await _request(this.fetch, 'GET', `${this.url}/admin/users/${uid}`, {
        headers: this.headers,
        xform: _userResponse,
      })
    } catch (error) {
      if (isAuthError(error)) {
        return { data: { user: null }, error }
      }

      throw error
    }
  }

  /**
   * Updates the user data.
   *
   * @param attributes The data you want to update.
   *
   * This function should only be called on a server. Never expose your `service_role` key in the browser.
   */
  async updateUserById(uid: string, attributes: AdminUserAttributes): Promise<UserResponse> {
    try {
      return await _request(this.fetch, 'PUT', `${this.url}/admin/users/${uid}`, {
        body: attributes,
        headers: this.headers,
        xform: _userResponse,
      })
    } catch (error) {
      if (isAuthError(error)) {
        return { data: { user: null }, error }
      }

      throw error
    }
  }

  /**
   * Delete a user. Requires a `service_role` key.
   *
   * @param uid The user uid you want to remove.
   *
   * This function should only be called on a server. Never expose your `service_role` key in the browser.
   */
  async deleteUser(uid: string): Promise<UserResponse> {
    try {
      return await _request(this.fetch, 'DELETE', `${this.url}/admin/users/${uid}`, {
        headers: this.headers,
        xform: _userResponse,
      })
    } catch (error) {
      if (isAuthError(error)) {
        return { data: { user: null }, error }
      }

      throw error
    }
  }
}
