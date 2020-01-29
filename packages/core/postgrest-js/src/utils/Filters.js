/**
 * Finds all rows whose value on the stated columnName exactly matches the specified filterValue. 
 * @param {string} columnName Name of the database column
 * @param { string | integer | boolean } filterValue Value to match
 * 
 * @example
 * Eq('name', 'New Zealand')
 * //=>
 * 'name=eq.New Zealand'
 */
export function Eq(columnName, filterValue) {
  return `${columnName}=eq.${filterValue}`
}

/**
 * Finds all rows whose value on the stated columnName is greater than the specified filterValue. 
 * @param {string} columnName Name of the database column
 * @param { string | integer | boolean } filterValue Value to match
 * 
 * @example
 * Gt('id', 20)
 * //=>
 * 'id=gt.20'
 */
export function Gt(columnName, filterValue) {
  return `${columnName}=gt.${filterValue}`
}

/**
 * Finds all rows whose value on the stated columnName is less than the specified filterValue. 
 * @param {string} columnName Name of the database column
 * @param { string | integer | boolean } filterValue Value to match
 * 
 * @example
 * Lt('id', 20)
 * //=>
 * 'id=lt.20'
 */
export function Lt(columnName, filterValue) {
  return `${columnName}=lt.${filterValue}`
}

/**
 * Finds all rows whose value on the stated columnName is greater than or equal to the specified filterValue. 
 * @param {string} columnName Name of the database column
 * @param { string | integer | boolean } filterValue Value to match
 * 
 * @example
 * Gte('id', 20)
 * //=>
 * 'id=gte.20'
 */
export function Gte(columnName, filterValue) {
  return `${columnName}=gte.${filterValue}`
}

/**
 * Finds all rows whose value on the stated columnName is less than or equal to the specified filterValue. 
 * @param {string} columnName Name of the database column
 * @param { string | integer | boolean } filterValue Value to match
 * 
 * @example
 * Lte('id', 20)
 * //=>
 * 'id=lte.20'
 */
export function Lte(columnName, filterValue) {
  return `${columnName}=lte.${filterValue}`
}

/**
 * Finds all rows whose value in the stated columnName matches the supplied pattern (case sensitive). 
 * @param {string} columnName Name of the database column
 * @param { string } stringPattern String pattern to compare to
 * 
 * @example
 * Like('name', '%United%')
 * //=>
 * 'name=like.*United*'
 * 
 * @example
 * Like('name', '%United States%')
 * //=>
 * 'name=like.*United States*'
 */
export function Like(columnName, stringPattern) {
  let stringPatternEnriched = stringPattern.replace(/%/g, '*')

  return `${columnName}=like.${stringPatternEnriched}`
}

/**
 * Finds all rows whose value in the stated columnName matches the supplied pattern (case insensitive). 
 * @param {string} columnName Name of the database column
 * @param { string } stringPattern String pattern to compare to
 * 
 * @example
 * Ilike('name', '%United%')
 * //=>
 * 'name=ilike.*United*'
 * 
 * @example
 * Ilike('name', '%United states%')
 * //=>
 * 'name=ilike.*United states*'
 */
export function Ilike(columnName, stringPattern) {
  let stringPatternEnriched = stringPattern.replace(/%/g, '*')

  return `${columnName}=ilike.${stringPatternEnriched}`
}

/**
 * A check for exact equality (null, true, false), finds all rows whose value on the state columnName exactly match the specified filterValue. 
 * @param {string} columnName Name of the database column
 * @param { string | integer | boolean } filterValue Value to match
 * 
 * @example
 * Is('name', null)
 * //=>
 * 'name=is.null'
 */
export function Is(columnName, filterValue) {
  return `${columnName}=is.${filterValue}`
}

/**
 * Finds all rows whose value on the stated columnName is found on the specified filterArray.
 * @param {string} columnName Name of the database column
 * @param { string | integer | boolean } filterValue Value to match
 * 
 * @example
 * In('name', ['China', 'France'])
 * //=>
 * 'name=in.China,France'
 */
export function In(columnName, filterArray) {
  return `${columnName}=in.${filterArray.join(',')}`
}

/**
 * Finds all rows whose value on the stated columnName is found on the specified filterArray.
 * @param {string} columnName Name of the database column
 * @param { string | integer | boolean } filterValue Value to match
 * 
 * @example
 * Not('name', 'China')
 * //=>
 * 'name=not.China'
 */
export function Not(columnName, filterValue) {
  return `${columnName}=not.${filterValue}`
}
