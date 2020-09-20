import { ClientConfig, Subscription } from './Client.types'
import { uuid } from './lib/helpers'

export default class Client {
  url: string
  headers: ClientConfig['headers'] = {}
  stateChangeEmmitters: Map<string, Subscription> = new Map()

  /**
   * Creates a GoTrue instance for admin interactions.
   *
   * @param url  URL of the GoTrue instance.
   * @param headers  Custom headers.
   */
  constructor(url: string, options?: ClientConfig) {
    this.url = url
    if (options?.headers) {
      this.headers = { ...this.headers, ...options.headers }
    }
  }

  /**
   * Creates a new user account for your business or project.
   */
  signup() {
    return null
  }

  /**
   * Allows existing users to log into your system.
   */
  login() {
    return null
  }

  /**
   * Sends a temporary password to a user's email address.
   */
  forgotPassword() {
    return null
  }

  /**
   * Register a single .
   * @returns {Subscription} A subscription object which can be used to unsubcribe itself.
   */
  onAuthStateChange(callback: Function): Subscription {
    const id: string = uuid()
    let self = this
    const subscription: Subscription = {
      id,
      callback,
      unsubscribe: () => self.stateChangeEmmitters.delete(id),
    }
    this.stateChangeEmmitters.set(id, subscription)
    return subscription
  }
}
