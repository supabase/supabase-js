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
    this.headers = {}
    this.queryString = null
    this.schema = null

    if (options.headers) this.headers = options.headers
    if (options.queryParams) this.queryString = Helpers.objectToQueryString(options.queryParams)
    if (options.schema) this.schema = options.schema
  }

  from(tableName) {
    let url = `${this.restUrl}/${tableName}`
    if (this.queryString) url += `?${this.queryString}`
    return new Builder(url, this.headers, this.schema)
  }

  rpc(functionName, functionParameters = null) {
    let url = `${this.restUrl}/rpc/${functionName}`
    let headers = this.headers
    if (this.queryString) url += `?${this.queryString}`
    if (this.schema) {
      headers['Content-Profile'] = this.schema
    }
    let request = new Request('post', url, headers)
    if (functionParameters != null) request.send(functionParameters)
    return request
  }
}

export { PostgrestClient }
