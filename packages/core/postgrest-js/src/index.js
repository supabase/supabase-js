/**
 * JS Client for querying postgres
 *
 * @class
 * @param {string} path The path representing the database table.
 * @param {object} [options]
 * @param {object} [options.queryParams] Optional query params that you want to append to your URL
 */

import Builder from './Builder'
import Request from './Request'
import * as Helpers from './utils/Helpers'

class PostgrestClient {
  constructor(restUrl, options = {}) {
    this.restUrl = restUrl
    this.queryString = null
    this.headers = {}

    if (options.headers) this.headers = options.headers
    if (options.queryParams) this.queryString = Helpers.objectToQueryString(options.queryParams)
  }

  from(tableName) {
    let url = `${this.restUrl}/${tableName}`
    if (this.queryString) url += `?${this.queryString}`
    return new Builder(url, this.headers)
  }

  rpc(functionName, functionParameters = null) {
    let url = `${this.restUrl}/rpc/${functionName}`
    if (this.queryString) url += `?${this.queryString}`
    let request = new Request('post', url, this.headers)
    if (functionParameters != null) request.send(functionParameters)
    return request
  }
}

export { PostgrestClient }
