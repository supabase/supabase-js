/** @module Filters **/
/**
 * All exports are prefixed with an underscore to avoid collisions with reserved keywords (eg: "in")
 */



/**
 * Finds all rows whose value on the stated columnName exactly matches the specified filterValue.
 * @param {string} columnName Name of the database column
 * @param { string | integer | boolean } filterValue Value to match
 * @name eq
 * @function
 * @returns {string}
 * 
 * @example
 * _eq('name', 'New Zealand')
 * //=>
 * 'name=eq.New Zealand'
 */
export function _eq(columnName, filterValue) {
  return `${columnName}=eq.${filterValue}`
}

/**
 * Finds all rows whose value on the stated columnName is greater than the specified filterValue. 
 * @param {string} columnName Name of the database column
 * @param { string | integer | boolean } filterValue Value to match
 * @name gt
 * @function
 * @returns {string}
 * 
 * @example
 * _gt('id', 20)
 * //=>
 * 'id=gt.20'
 */
export function _gt(columnName, filterValue) {
  return `${columnName}=gt.${filterValue}`
}

/**
 * Finds all rows whose value on the stated columnName is less than the specified filterValue. 
 * @param {string} columnName Name of the database column
 * @param { string | integer | boolean } filterValue Value to match
 * @name lt
 * @function
 * @returns {string}
 * 
 * @example
 * _lt('id', 20)
 * //=>
 * 'id=lt.20'
 */
export function _lt(columnName, filterValue) {
  return `${columnName}=lt.${filterValue}`
}

/**
 * Finds all rows whose value on the stated columnName is greater than or equal to the specified filterValue. 
 * @param {string} columnName Name of the database column
 * @param { string | integer | boolean } filterValue Value to match
 * @name gte
 * @function
 * @returns {string}
 * 
 * @example
 * _gte('id', 20)
 * //=>
 * 'id=gte.20'
 */
export function _gte(columnName, filterValue) {
  return `${columnName}=gte.${filterValue}`
}

/**
 * Finds all rows whose value on the stated columnName is less than or equal to the specified filterValue. 
 * @param {string} columnName Name of the database column
 * @param { string | integer | boolean } filterValue Value to match
 * @name lte
 * @function
 * @returns {string}
 * 
 * @example
 * _lte('id', 20)
 * //=>
 * 'id=lte.20'
 */
export function _lte(columnName, filterValue) {
  return `${columnName}=lte.${filterValue}`
}

/**
 * Finds all rows whose value in the stated columnName matches the supplied pattern (case sensitive). 
 * @param {string} columnName Name of the database column
 * @param { string } stringPattern String pattern to compare to
 * @name like
 * @function
 * @returns {string}
 * 
 * @example
 * _like('name', '%United%')
 * //=>
 * 'name=like.*United*'
 * 
 * @example
 * _like('name', '%United States%')
 * //=>
 * 'name=like.*United States*'
 */
export function _like(columnName, stringPattern) {
  let stringPatternEnriched = stringPattern.replace(/%/g, '*')
  return `${columnName}=like.${stringPatternEnriched}`
}

/**
 * Finds all rows whose value in the stated columnName matches the supplied pattern (case insensitive). 
 * @param {string} columnName Name of the database column
 * @param { string } stringPattern String pattern to compare to
 * @name ilike
 * @function
 * @returns {string}
 * 
 * @example
 * _ilike('name', '%United%')
 * //=>
 * 'name=ilike.*United*'
 * 
 * @example
 * _ilike('name', '%United states%')
 * //=>
 * 'name=ilike.*United states*'
 */
export function _ilike(columnName, stringPattern) {
  let stringPatternEnriched = stringPattern.replace(/%/g, '*')
  return `${columnName}=ilike.${stringPatternEnriched}`
}

/**
 * A check for exact equality (null, true, false), finds all rows whose value on the state columnName exactly match the specified filterValue. 
 * @param {string} columnName Name of the database column
 * @param { string | integer | boolean } filterValue Value to match
 * @name is
 * @function
 * @returns {string}
 * 
 * @example
 * _is('name', null)
 * //=>
 * 'name=is.null'
 */
export function _is(columnName, filterValue) {
  return `${columnName}=is.${filterValue}`
}


/**
 * Finds all rows whose value on the stated columnName is found on the specified filterArray.
 * @param {string} columnName Name of the database column
 * @param { string | integer | boolean } filterValue Value to match
 * @name in
 * @function
 * @returns {string}
 * 
 * @example
 * _in('name', ['China', 'France'])
 * //=>
 * 'name=in.(China,France)'
 */
export function _in (columnName, filterArray) {
  return `${columnName}=in.(${filterArray.join(',')})`
}

/**
 * Finds all rows whose value on the stated columnName is found on the specified filterArray.
 * @param {string} columnName Name of the database column
 * @param { string | integer | boolean } filterValue Value to match
 * @name not
 * @function
 * @returns {string}
 * 
 * @example
 * _neq('name', 'China')
 * //=>
 * 'name=neq.China'
 */
export function _neq(columnName, filterValue) {
  return `${columnName}=neq.${filterValue}`
}
