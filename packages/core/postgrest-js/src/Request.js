/**
 * A request building object which contains convenience methods for
 * communicating with a PostgREST server.
 * 
 * This files draws heavily from https://github.com/calebmer/postgrest-client
 * License: https://github.com/calebmer/postgrest-client/blob/master/LICENSE
 *
 * @class
 * @param {string} method The HTTP method of the request.
 * @param {string} url The full URL.
 */

import { Request as SuperAgent } from 'superagent'
import * as Filters from './utils/Filters'


const contentRangeStructure = /^(\d+)-(\d+)\/(\d+)$/

class Request extends SuperAgent {
  constructor(method, url) {
    super(method, url)
    this.set('Accept', 'application/json')

    // Fix for superagent disconnect on client & server.
    if (!this.get) {
      this.get = this.getHeader
    }
  }

  /**
   * Set auth using special formats. If only one string parameter is passed, it
   * is interpreted as a bearer token. If an object and nothing else is passed,
   * `user` and `pass` keys are extracted from it and used for basic auth.
   *
   * @param {string|object} user The user, bearer token, or user/pass object.
   * @param {string|void} pass The pass or undefined.
   * @returns {Request} The API request object.
   */

  auth(user, pass) {
    if (typeof user === 'string' && pass == null) {
      this.set('Authorization', `Bearer ${user}`)
      return this
    }

    if (typeof user === 'object' && pass == null) {
      pass = user.pass
      user = user.user
    }

    return super.auth(user, pass)
  }

  /**
   * Generic filter method.
   * @param {string} columnName The name of the column.
   * @param {string} filter The type of filter
   * @param { object | array | string | integer | boolean | null } criteria The value of the column to be filtered.
   * @name filter
   * @function
   * @memberOf module:Filters
   * @returns {string}
   */
  filter(columnName, operator, criteria) {
    let newQuery = Filters[`_${operator.toLowerCase()}`](columnName, criteria)
    return this.query(newQuery)
  }

  /**
   * Takes a query object and translates it to a PostgREST filter query string.
   * All values are prefixed with `eq.`.
   *
   * @param {object} query The object to match against.
   * @returns {Request} The API request object.
   */

  match(query) {
    const newQuery = {}
    Object.keys(query).forEach(key => (newQuery[key] = `eq.${query[key]}`))
    return this.query(newQuery)
  }

  /**
   * Cleans up a select string by stripping all whitespace. Then the string is
   * set as a query string value. Also always forces a root @id column.
   *
   * @param {string} select The unformatted select string.
   * @returns {Request} The API request object.
   */

  select(select) {
    if (select) {
      this.query({ select: select.replace(/\s/g, '') })
    }

    return this
  }

  /**
   * Tells PostgREST in what order the result should be returned.
   *
   * @param {string} property The property name to order by.
   * @param {bool} ascending True for descending results, false by default.
   * @param {bool} nullsFirst True for nulls first, false by default.
   * @returns {Request} The API request object.
   */

  order(property, ascending = false, nullsFirst = false) {
    this.query(
      `order=${property}.${ascending ? 'asc' : 'desc'}.${nullsFirst ? 'nullsfirst' : 'nullslast'}`
    )
    return this
  }

  /**
   * Specify a range of items for PostgREST to return. If the second value is
   * not defined, the rest of the collection will be sent back.
   *
   * @param {number} from The first object to select.
   * @param {number|void} to The last object to select.
   * @returns {Request} The API request object.
   */

  range(from, to) {
    let lowerBound = from || 0
    let upperBound = to == 0 ? 0 : to || ''
    
    this.set('Range-Unit', 'items')
    this.set('Range', `${lowerBound}-${upperBound}`)
    return this
  }

  /**
   * Sets the header which signifies to PostgREST the response must be a single
   * object or 406 Not Acceptable.
   * 
   * @returns {Request} The API request object.
   */

  single() {
    this.set('Accept', 'application/vnd.pgrst.object+json')
    this.set('Prefer','return=representation')

    return this
  }

  /**
   * Sends the request and returns a promise. The super class uses the errback
   * pattern, but this function overrides that preference to use a promise.
   *
   * @returns {Promise} Resolves when the request has completed.
   */

  end() {
    return new Promise((resolve, reject) =>
      super.end((error, response) => {
        if (error) {
          return reject(error)
        }

        const { body, headers, status, statusCode, statusText } = response
        const contentRange = headers['content-range']

        if (Array.isArray(body) && contentRange && contentRangeStructure.test(contentRange)) {
          body.fullLength = parseInt(contentRangeStructure.exec(contentRange)[3], 10)
        }

        const returnBody = { body, status, statusCode, statusText }

        return resolve(returnBody)
      })
    )
  }

  /**
   * Makes the Request object then-able. Allows for usage with
   * `Promise.resolve` and async/await contexts. Just a proxy for `.then()` on
   * the promise returned from `.end()`.
   *
   * @param {function} Called when the request resolves.
   * @param {function} Called when the request errors.
   * @returns {Promise} Resolves when the resolution resolves.
   */
  then(resolve, reject) {
    return this.end().then(resolve, reject)
  }

  /**
   * Just a proxy for `.catch()` on the promise returned from `.end()`.
   *
   * @param {function} Called when the request errors.
   * @returns {Promise} Resolves when there is an error.
   */
  catch(reject) {
    return this.end().catch(reject)
  }
}

// Attached all the filters
const filters = ['eq', 'gt', 'lt', 'gte', 'lte', 'like', 'ilike', 'is', 'in', 'not']
filters.forEach(
  filter =>
    (Request.prototype[filter] = function filterValue(columnName, criteria) {
      return this.filter(columnName, filter, criteria)
    })
)

export default Request
