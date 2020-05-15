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
import * as Helpers from './utils/Helpers'

const contentRangeStructure = /^(\d+)-(\d+)\/(\d+)$/

class Request extends SuperAgent {
  constructor(method, url, headers = {}) {
    super(method, url)
    this.set('Accept', 'application/json')

    if (headers != {}) {
      for (var k in headers) {
        this.set(k, headers[k])
      }
    }

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
    if (
      ['in', 'cs', 'cd', 'ova', 'ovr', 'sl', 'sr', 'nxr', 'nxl', 'adj'].includes(operator) &&
      !Array.isArray(criteria)
    ) {
      return {
        body: null,
        status: 400,
        statusCode: 400,
        statusText: `.${operator}() cannot be invoked with criteria that is not an Array.`,
      }
    }

    // for ranges, length of array should always be equal to 2
    if (['ovr', 'sl', 'sr', 'nxr', 'nxl', 'adj'].includes(operator) && criteria.length != 2) {
      return {
        body: null,
        status: 400,
        statusCode: 400,
        statusText: `.${operator}() can only be invoked with a criteria that is an Array of length 2.`,
      }
    }

    if (
      ['fts', 'plfts', 'phfts', 'wfts'].includes(operator) &&
      typeof criteria.queryText == 'undefined'
    ) {
      return {
        body: null,
        status: 400,
        statusCode: 400,
        statusText: `.${operator}() can only be invoked with a criteria that is an Object with key queryText.`,
      }
    }

    let newQuery = Filters[`_${operator.toLowerCase()}`](columnName, criteria)
    return this.query(newQuery)
  }

  /**
   * Provides the inverse of the filter stated.
   * @param {string} columnName The name of the column.
   * @param {string} filter The type of filter
   * @param { object | array | string | integer | boolean | null } criteria The value of the column to be filtered.
   * @name filter
   * @function
   * @memberOf module:Filters
   * @returns {string}
   */
  not(columnName, operator, criteria) {
    let newQuery = Filters[`_${operator.toLowerCase()}`](columnName, criteria)
    let enrichedQuery = `${newQuery.split('=')[0]}=not.${newQuery.split('=')[1]}`
    return this.query(enrichedQuery)
  }

  /**
   * Takes a query object and translates it to a PostgREST filter query string.
   * All values are prefixed with `eq.`.
   *
   * @param {object} query The object to match against.
   * @returns {Request} The API request object.
   */

  match(query) {
    Object.keys(query).forEach((key) => {
      this.query(`${key}=eq.${query[key]}`)
    })

    return this
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
   * @param {string} columnName The columnName name to order by.
   * @param {bool} ascending True for descending results, false by default.
   * @param {bool} nullsFirst True for nulls first, false by default.
   * @returns {Request} The API request object.
   */

  order(columnName, ascending = false, nullsFirst = false) {
    let { cleanedColumnName, foreignTableName } = Helpers.cleanColumnName(columnName)

    this.query(
      `${foreignTableName != null ? `${foreignTableName}.` : ''}order=${cleanedColumnName}.${
        ascending ? 'asc' : 'desc'
      }.${nullsFirst ? 'nullsfirst' : 'nullslast'}`
    )
    return this
  }

  limit(criteria, columnName = null) {
    if (typeof criteria != 'number') {
      return {
        body: null,
        status: 400,
        statusCode: 400,
        statusText: `.limit() cannot be invoked with criteria that is not a number.`,
      }
    }

    this.query(`${columnName != null ? `${columnName}.` : ''}limit=${criteria}`)
    return this
  }

  offset(criteria, columnName = null) {
    if (typeof criteria != 'number') {
      return {
        body: null,
        status: 400,
        statusCode: 400,
        statusText: `.offset() cannot be invoked with criteria that is not a number.`,
      }
    }

    this.query(`${columnName != null ? `${columnName}.` : ''}offset=${criteria}`)
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

  range(from, to = null) {
    if (typeof from != 'number' || (typeof to != 'number' && to != null)) {
      return {
        body: null,
        status: 400,
        statusCode: 400,
        statusText: `.range() cannot be invoked with parameters that are not numbers.`,
      }
    }

    let lowerBound = from
    let upperBound = to == null ? '' : to

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
    this.set('Prefer', 'return=representation')

    return this
  }

  /**
   * Sends the request and returns a promise. The super class uses the errback
   * pattern, but this function overrides that preference to use a promise.
   *
   * @returns {Promise} Resolves when the request has completed.
   */

  end() {
    return new Promise((resolve, reject) => {
      // catch when .delete() is invoked without any filters
      if (['DELETE', 'PATCH'].includes(this.method) && this._query.length == 0) {
        let methodString = this.method === 'DELETE' ? '.delete()' : '.update()'

        return resolve({
          body: null,
          status: 400,
          statusCode: 400,
          statusText: `${methodString} cannot be invoked without any filters.`,
        })
      }

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
    })
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
const filters = [
  'eq',
  'neq',
  'gt',
  'lt',
  'gte',
  'lte',
  'like',
  'ilike',
  'is',
  'in',
  'fts',
  'plfts',
  'phfts',
  'wfts',
  'cs',
  'cd',
  'ova',
  'ovr',
  'sl',
  'sr',
  'nxr',
  'nxl',
  'adj',
]
filters.forEach(
  (filter) =>
    (Request.prototype[filter] = function filterValue(columnName, criteria) {
      return this.filter(columnName, filter, criteria)
    })
)

export default Request
