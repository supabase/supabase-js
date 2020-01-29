
/**
 * @param {object} obj 
 * @private
 * @returns {string}
 */
export function objectToQueryString(obj) {
  return Object.keys(obj)
    .map(param => `${param}=${obj[param]}`)
    .join('&')
}
