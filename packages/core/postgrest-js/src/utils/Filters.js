import * as Helpers from './Helpers'

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
 * 
 * @example
 * _in('capitals', ['Beijing,China', 'Paris,France'])
 * //=>
 * 'capitals=in.("Beijing,China","Paris,France")'
 * 
 * @example
 * _in('food_supplies', ['carrot (big)', 'carrot (small)'])
 * //=>
 * 'food_supplies=in.("carrot (big)","carrot (small)")'
 */
export function _in(columnName, filterArray) {
  let cleanedFilterArray = Helpers.cleanFilterArray(filterArray)

  return `${columnName}=in.(${cleanedFilterArray.join(',')})`
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

/**
 * Finds all rows whose tsvector value on the stated columnName matches to_tsquery(queryText).
 * @param {string} columnName Name of the database column
 * @param { object } filterObject query text and optionally config to base the match on
 * @name fts
 * @function
 * @returns {string}
 * 
 * @example
 * _fts('phrase', {queryText: 'The Fat Cats'})
 * //=>
 * 'phrase=fts.The Fat Cats'
 * 
 * @example
 * _fts('phrase', {queryText: 'The Fat Cats', config: 'english'})
 * //=>
 * 'phrase=fts(english).The Fat Cats'
 */
export function _fts(columnName, filterObject) {
  if(typeof filterObject.config == 'undefined') return `${columnName}=fts.${filterObject.queryText}`
  return `${columnName}=fts(${filterObject.config}).${filterObject.queryText}`
}

/**
 * Finds all rows whose tsvector value on the stated columnName matches plainto_tsquery(queryText).
 * @param {string} columnName Name of the database column
 * @param { object } filterObject query text and optionally config to base the match on
 * @name plfts
 * @function
 * @returns {string}
 * 
 * @example
 * _plfts('phrase', {queryText: 'The Fat Cats'})
 * //=>
 * 'phrase=plfts.The Fat Cats'
 * 
 * @example
 * _plfts('phrase', {queryText: 'The Fat Cats', config: 'english'})
 * //=>
 * 'phrase=plfts(english).The Fat Cats'
 */
export function _plfts(columnName, filterObject) {
  if(typeof filterObject.config == 'undefined') return `${columnName}=plfts.${filterObject.queryText}`
  return `${columnName}=plfts(${filterObject.config}).${filterObject.queryText}`
}

/**
 * Finds all rows whose tsvector value on the stated columnName matches phraseto_tsquery(queryText).
 * @param {string} columnName Name of the database column
 * @param { object } filterObject query text and optionally config to base the match on
 * @name phfts
 * @function
 * @returns {string}
 * 
 * @example
 * _phfts('phrase', {queryText: 'The Fat Cats'})
 * //=>
 * 'phrase=phfts.The Fat Cats'
 * 
 * @example
 * _phfts('phrase', {queryText: 'The Fat Cats', config: 'english'})
 * //=>
 * 'phrase=phfts(english).The Fat Cats'
 */
export function _phfts(columnName, filterObject) {
  if(typeof filterObject.config == 'undefined') return `${columnName}=phfts.${filterObject.queryText}`
  return `${columnName}=phfts(${filterObject.config}).${filterObject.queryText}`
}

/**
 * Finds all rows whose tsvector value on the stated columnName matches websearch_to_tsquery(queryText).
 * @param {string} columnName Name of the database column
 * @param { object } filterObject query text and optionally config to base the match on
 * @name wfts
 * @function
 * @returns {string}
 * 
 * @example
 * _wfts('phrase', {queryText: 'The Fat Cats'})
 * //=>
 * 'phrase=wfts.The Fat Cats'
 * 
 * @example
 * _wfts('phrase', {queryText: 'The Fat Cats', config: 'english'})
 * //=>
 * 'phrase=wfts(english).The Fat Cats'
 */
export function _wfts(columnName, filterObject) {
  if(typeof filterObject.config == 'undefined') return `${columnName}=wfts.${filterObject.queryText}`
  return `${columnName}=wfts(${filterObject.config}).${filterObject.queryText}`
}

/**
 * Finds all rows whose json || array || range value on the stated columnName contains the values specified in the filterObject.
 * @param {string} columnName Name of the database column
 * @param { array | object } filterObject Value to compare to
 * @name cs
 * @function
 * @returns {string}
 *
 * @example
 * _cs('countries', ['China', 'France'])
 * //=>
 * 'countries=cs.{China,France}'
 * 
 * @example
 * _cs('capitals', ['Beijing,China', 'Paris,France'])
 * //=>
 * 'capitals=cs.{"Beijing,China","Paris,France"}'
 * 
 * @example
 * _cs('food_supplies', {fruits:1000, meat:800})
 * //=>
 * 'food_supplies=cs.{"fruits":1000,"meat":800}'
 */
export function _cs(columnName, filterObject) {
  if (Array.isArray(filterObject)) {
    let cleanedFilterArray = Helpers.cleanFilterArray(filterObject)

    return `${columnName}=cs.{${cleanedFilterArray.join(',')}}`
  }
  return `${columnName}=cs.${JSON.stringify(filterObject)}`
}

/**
 * Finds all rows whose json || array || range value on the stated columnName is contained by the specified filterObject.
 * @param {string} columnName Name of the database column
 * @param { array | object } filterObject Value to compare to
 * @name cd
 * @function
 * @returns {string}
 *
 * @example
 * _cd('countries', ['China', 'France'])
 * //=>
 * 'countries=cd.{China,France}'
 * 
 * @example
 * _cd('capitals', ['Beijing,China', 'Paris,France'])
 * //=>
 * 'capitals=cd.{"Beijing,China","Paris,France"}'
 * 
 * @example
 * _cd('food_supplies', {fruits:1000, meat:800})
 * //=>
 * 'food_supplies=cd.{"fruits":1000,"meat":800}'
 */
export function _cd(columnName, filterObject) {
  if (Array.isArray(filterObject)) {
    let cleanedFilterArray = Helpers.cleanFilterArray(filterObject)

    return `${columnName}=cd.{${cleanedFilterArray.join(',')}}`
  }
  return `${columnName}=cd.${JSON.stringify(filterObject)}`
}

/**
 * Finds all rows whose array value on the stated columnName overlaps on the specified filterArray.
 * @param {string} columnName Name of the database column
 * @param {array} filterValue Value to compare to
 * @name ova
 * @function
 * @returns {string}
 * 
 * @example
 * _ova('allies', ['China', 'France'])
 * //=>
 * 'allies=ov.{China,France}'
 * 
 * @example
 * _ova('capitals', ['Beijing,China', 'Paris,France'])
 * //=>
 * 'capitals=ov.{"Beijing,China","Paris,France"}'
 * 
 */
export function _ova(columnName, filterArray) {
  let cleanedFilterArray = Helpers.cleanFilterArray(filterArray)

  return `${columnName}=ov.{${cleanedFilterArray.join(',')}}`
}

/**
 * Finds all rows whose range value on the stated columnName overlaps on the specified filterRange.
 * @param {string} columnName Name of the database column
 * @param {array} filterRange Value to to compare to
 * @name ovr
 * @function
 * @returns {string}
 *
 * @example
 * _ovr('population_range', [100, 500])
 * //=>
 * 'population_range=ov.(100,500)'
 */
export function _ovr(columnName, filterRange) {
  return `${columnName}=ov.(${filterRange.join(',')})`
}

/**
 * Finds all rows whose range value on the stated columnName is strictly on the left of the specified filterRange.
 * @param {string} columnName Name of the database column
 * @param {array} filterRange Value to compare to
 * @name sl
 * @function
 * @returns {string}
 *
 * @example
 * _sl('population_range', [100, 500])
 * //=>
 * 'population_range=sl.(100,500)'
 */
export function _sl(columnName, filterRange) {
  return `${columnName}=sl.(${filterRange.join(',')})`
}

/**
 * Finds all rows whose range value on the stated columnName is strictly on the right of the specified filterRange.
 * @param {string} columnName Name of the database column
 * @param {array} filterRange Value to compare to
 * @name sr
 * @function
 * @returns {string}
 *
 * @example
 * _sr('population_range', [100,500])
 * //=>
 * 'population_range=sr.(100,500)'
 */
export function _sr(columnName, filterRange) {
  return `${columnName}=sr.(${filterRange.join(',')})`
}

/**
 * Finds all rows whose range value on the stated columnName does not extend to the left of the specified filterRange.
 * @param {string} columnName Name of the database column
 * @param {array} filterRange Value to compare to
 * @name nxl
 * @function
 * @returns {string}
 *
 * @example
 * _nxl('population_range', [100, 500])
 * //=>
 * 'population_range=nxl.(100,500)'
 */
export function _nxl(columnName, filterRange) {
  return `${columnName}=nxl.(${filterRange.join(',')})`
}

/**
 * Finds all rows whose range value on the stated columnName does not extend to the right of the specified filterRange.
 * @param {string} columnName Name of the database column
 * @param {array} filterRange Value to compare to
 * @name nxr
 * @function
 * @returns {string}
 *
 * @example
 * _nxr('population_range', [100, 500])
 * //=>
 * 'population_range=nxr.(100,500)'
 */
export function _nxr(columnName, filterRange) {
  return `${columnName}=nxr.(${filterRange.join(',')})`
}

/**
 * Finds all rows whose range value on the stated columnName is adjacent to the specified filterRange.
 * @param {string} columnName Name of the database column
 * @param {array} filterRange Value to compare to
 * @name adj
 * @function
 * @returns {string}
 *
 * @example
 * _adj('population_range', [100, 500])
 * //=>
 * 'population_range=adj.(100,500)'
 */
export function _adj(columnName, filterRange) {
  return `${columnName}=adj.(${filterRange.join(',')})`
}

/**
 * Finds all rows that satisfy at least one of the specified `filters`.
 * @param {string} filters Filters to satisfy
 * @name or
 * @function
 * @returns {string}
 *
 * @example
 * _or('id.gt.20,and(name.eq.New Zealand,name.eq.France)')
 * //=>
 * 'or=(id.gt.20,and(name.eq.New Zealand,name.eq.France))'
 */
export function _or(filters) {
  return `or=(${filters})`
}
