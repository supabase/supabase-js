import Request from './Request'

/**
 * Allows the user to stack the filter functions before they call any of
 *
 * select() - "get"
 *
 * insert() - "post"
 *
 * update() - "patch"
 *
 * delete() - "delete"
 *
 * Once any of these are called the filters are passed down to the Request
 *
 * @class
 * @param {string} url The full URL
 */

class Builder {
  constructor(url) {
    this.url = url
    this.queryFilters = []
  }

  request(method) {
    return new Request(method, this.url)
  }

  addFilters(request, options) {
    if (Object.keys(options).length != 0) {
      Object.keys(options).forEach(option => {
        let setting = options[option]
        request.set(option, setting)
      })
    }

    // loop through this.queryFilters
    this.queryFilters.forEach(queryFilter => {
      switch (queryFilter.filter) {
        case 'filter':
          request.filter(queryFilter.columnName, queryFilter.operator, queryFilter.criteria)
          break

        case 'match':
          request.match(queryFilter.query)
          break

        case 'order':
          request.order(queryFilter.property, queryFilter.ascending, queryFilter.nullsFirst)
          break

        case 'range':
          request.range(queryFilter.from, queryFilter.to)
          break

        case 'single':
          request.single()
          break

        default:
          break
      }
    })
  }

  filter(columnName, operator, criteria) {
    this.queryFilters.push({
      filter: 'filter',
      columnName,
      operator,
      criteria,
    })

    return this
  }

  match(query) {
    this.queryFilters.push({
      filter: 'match',
      query,
    })

    return this
  }

  order(property, ascending = false, nullsFirst = false) {
    this.queryFilters.push({
      filter: 'order',
      property,
      ascending,
      nullsFirst,
    })

    return this
  }

  range(from, to) {
    this.queryFilters.push({
      filter: 'range',
      from,
      to,
    })

    return this
  }

  single() {
    this.queryFilters.push({ filter: 'single' })

    return this
  }

  /**
   * Start a "GET" request
   */
  select(columnQuery = '*', options = {}) {
    let method = 'GET'
    let request = this.request(method)

    request.select(columnQuery)
    this.addFilters(request, options)

    return request
  }

  /**
   * Start a "POST" request
   */
  insert(data, options = {}) {
    let method = 'POST'
    let request = this.request(method)
    
    request.set('Prefer', 'return=representation')
    request.send(data)

    this.addFilters(request, options)

    return request
  }

  /**
   * Start a "PATCH" request
   */
  update(data, options = {}) {
    let method = 'PATCH'
    let request = this.request(method)

    if(Array.isArray(data)) {
      return {
        body:null,
        status: 400,
        statusCode: 400,
        statusText: 'Data type should be an object.'

      }
    }

    request.set('Prefer', 'return=representation')
    request.send(data)
    
    this.addFilters(request, options)

    return request
  }

  /**
   * Start a "DELETE" request
   */
  delete(options = {}) {
    let method = 'DELETE'
    let request = this.request(method)

    this.addFilters(request, options)

    return request
  }
}

// pre-empts if any of the filters are used before select
const advancedFilters = ['eq', 'gt', 'lt', 'gte', 'lte', 'like', 'ilike', 'is', 'in', 'not']

advancedFilters.forEach(
  operator =>
    (Builder.prototype[operator] = function filterValue(columnName, criteria) {
      this.filter(columnName, operator, criteria)
      return this
    })
)

export default Builder
