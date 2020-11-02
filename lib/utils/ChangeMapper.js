'use strict'
Object.defineProperty(exports, '__esModule', { value: !0 }),
  (exports.toTimestampString = exports.toArray = exports.toJson = exports.toIntRange = exports.toInt = exports.toFloat = exports.toDateRange = exports.toDate = exports.toBoolean = exports.noop = exports.convertCell = exports.convertColumn = exports.convertChangeData = void 0) // # Lifted from epgsql (src/epgsql_binary.erl), this module licensed under
// # 3-clause BSD found here: https://raw.githubusercontent.com/epgsql/epgsql/devel/LICENSE
/**
 * Takes an array of columns and an object of string values then converts each string value
 * to its mapped type
 * @param {{name: String, type: String}[]} columns
 * @param {Object} records
 * @param {Object} options The map of various options that can be applied to the mapper
 * @param {Array} options.skipTypes The array of types that should not be converted
 *
 * @example convertChangeData([{name: 'first_name', type: 'text'}, {name: 'age', type: 'int4'}], {first_name: 'Paul', age:'33'}, {})
 * //=>{ first_name: 'Paul', age: 33 }
 */ var convertChangeData = function (a, b) {
  var c = 2 < arguments.length && void 0 !== arguments[2] ? arguments[2] : {},
    d = {},
    e = 'undefined' == typeof c.skipTypes ? [] : c.skipTypes
  return (
    Object.entries(b).map((c) => {
      var [f, g] = c
      d[f] = convertColumn(f, a, b, e)
    }),
    d
  )
}
/**
 * Converts the value of an individual column
 * @param {String} columnName The column that you want to convert
 * @param {{name: String, type: String}[]} columns All of the columns
 * @param {Object} records The map of string values
 * @param {Array} skipTypes An array of types that should not be converted
 * @return {object} Useless information
 *
 * @example convertColumn('age', [{name: 'first_name', type: 'text'}, {name: 'age', type: 'int4'}], ['Paul', '33'], [])
 * //=> 33
 * @example convertColumn('age', [{name: 'first_name', type: 'text'}, {name: 'age', type: 'int4'}], ['Paul', '33'], ['int4'])
 * //=> "33"
 */ exports.convertChangeData = convertChangeData
var convertColumn = (a, b, c, d) => {
  var e = b.find((b) => b.name == a)
  return d.includes(e.type) ? noop(c[a]) : convertCell(e.type, c[a])
}
/**
 * If the value of the cell is `null`, returns null.
 * Otherwise converts the string value to the correct type.
 * @param {String} type A postgres column type
 * @param {String} stringValue The cell value
 *
 * @example convertCell('bool', 'true')
 * //=> true
 * @example convertCell('int8', '10')
 * //=> 10
 * @example convertCell('_int4', '{1,2,3,4}')
 * //=> [1,2,3,4]
 */ exports.convertColumn = convertColumn
var convertCell = (a, b) => {
  try {
    if (null === b) return null // if data type is an array
    if ('_' === a.charAt(0)) {
      var c = a.slice(1, a.length)
      return toArray(b, c)
    } // If not null, convert to correct type.
    return 'abstime' === a
      ? noop(b)
      : 'bool' === a
      ? toBoolean(b)
      : 'date' === a
      ? noop(b)
      : 'daterange' === a
      ? toDateRange(b)
      : 'float4' === a
      ? toFloat(b)
      : 'float8' === a
      ? toFloat(b)
      : 'int2' === a
      ? toInt(b)
      : 'int4' === a
      ? toInt(b)
      : 'int4range' === a
      ? toIntRange(b)
      : 'int8' === a
      ? toInt(b)
      : 'int8range' === a
      ? toIntRange(b)
      : 'json' === a
      ? toJson(b)
      : 'jsonb' === a
      ? toJson(b)
      : 'money' === a
      ? toFloat(b)
      : 'numeric' === a
      ? toFloat(b)
      : 'oid' === a
      ? toInt(b)
      : 'reltime' === a
      ? noop(b)
      : 'time' === a
      ? noop(b)
      : 'timestamp' === a
      ? toTimestampString(b)
      : 'timestamptz' === a
      ? noop(b)
      : 'timetz' === a
      ? noop(b)
      : 'tsrange' === a
      ? toDateRange(b)
      : 'tstzrange' === a
      ? toDateRange(b)
      : noop(b)
  } catch (c) {
    return (
      console.log('Could not convert cell of type '.concat(a, ' and value ').concat(b)),
      console.log('This is the error: '.concat(c)),
      b
    )
  }
}
exports.convertCell = convertCell
var noop = (a) => a
exports.noop = noop
var toBoolean = (a) => 't' === a || ('f' !== a && null)
exports.toBoolean = toBoolean
var toDate = (a) => new Date(a)
exports.toDate = toDate
var toDateRange = (a) => {
  var b = JSON.parse(a)
  return [new Date(b[0]), new Date(b[1])]
}
exports.toDateRange = toDateRange
var toFloat = (a) => parseFloat(a)
exports.toFloat = toFloat
var toInt = (a) => parseInt(a)
exports.toInt = toInt
var toIntRange = (a) => {
  var b = JSON.parse(a)
  return [parseInt(b[0]), parseInt(b[1])]
}
exports.toIntRange = toIntRange
var toJson = (a) => JSON.parse(a)
/**
 * Converts a Postgres Array into a native JS array
 * @example toArray('{1,2,3,4}', 'int4')
 * //=> [1,2,3,4]
 * @example toArray('{}', 'int4')
 * //=> []
 */ exports.toJson = toJson
var toArray = (a, b) => {
  // this takes off the '{' & '}'
  var c = a.slice(1, a.length - 1),
    d = 0 < c.length ? c.split(',') : [],
    e = d.map((a) => convertCell(b, a)) // converts the string into an array
  // if string is empty (meaning the array was empty), an empty array will be immediately returned
  return e
}
/**
 * Fixes timestamp to be ISO-8601. Swaps the space between the date and time for a 'T'
 * See https://github.com/supabase/supabase/issues/18
 * @returns {string}
 * @example toTimestampString('2019-09-10 00:00:00')
 * //=> '2019-09-10T00:00:00'
 */ exports.toArray = toArray
var toTimestampString = (a) => a.replace(' ', 'T')
exports.toTimestampString = toTimestampString
