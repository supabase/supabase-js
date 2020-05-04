/**
 * @param {object} obj
 * @private
 * @returns {string}
 */
export function objectToQueryString(obj) {
  return Object.keys(obj)
    .map((param) => `${param}=${obj[param]}`)
    .join('&')
}

export function cleanFilterArray(filterArray) {
  let cleanedFilterArray = filterArray.map((filter) => {
    let cleanedFilter
    if (
      typeof filter == 'string' &&
      (filter.includes(',') || filter.includes('(') || filter.includes(')'))
    )
      cleanedFilter = `"${filter}"`
    else cleanedFilter = filter
    return cleanedFilter
  })

  return cleanedFilterArray
}
