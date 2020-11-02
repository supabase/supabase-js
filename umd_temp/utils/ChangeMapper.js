;(function (a, b) {
  if ('function' == typeof define && define.amd) define(['exports'], b)
  else if ('undefined' != typeof exports) b(exports)
  else {
    var c = { exports: {} }
    b(c.exports), (a.ChangeMapper = c.exports)
  }
})(
  'undefined' == typeof globalThis ? ('undefined' == typeof self ? this : self) : globalThis,
  function (a) {
    'use strict'
    Object.defineProperty(a, '__esModule', { value: !0 }),
      (a.toTimestampString = a.toArray = a.toJson = a.toIntRange = a.toInt = a.toFloat = a.toDateRange = a.toDate = a.toBoolean = a.noop = a.convertCell = a.convertColumn = a.convertChangeData = void 0)
    a.convertChangeData = function convertChangeData(a, c) {
      var d = 2 < arguments.length && void 0 !== arguments[2] ? arguments[2] : {},
        e = {},
        f = 'undefined' == typeof d.skipTypes ? [] : d.skipTypes
      return (
        Object.entries(c).map((d) => {
          var [g, h] = d
          e[g] = b(g, a, c, f)
        }),
        e
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
     */ var b = (a, b, e, f) => {
      var g = b.find((b) => b.name == a)
      return f.includes(g.type) ? d(e[a]) : c(g.type, e[a])
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
     */ a.convertColumn = b
    var c = (a, b) => {
      try {
        if (null === b) return null // if data type is an array
        if ('_' === a.charAt(0)) {
          var c = a.slice(1, a.length)
          return k(b, c)
        } // If not null, convert to correct type.
        return 'abstime' === a
          ? d(b)
          : 'bool' === a
          ? e(b)
          : 'date' === a
          ? d(b)
          : 'daterange' === a
          ? f(b)
          : 'float4' === a
          ? g(b)
          : 'float8' === a
          ? g(b)
          : 'int2' === a
          ? h(b)
          : 'int4' === a
          ? h(b)
          : 'int4range' === a
          ? i(b)
          : 'int8' === a
          ? h(b)
          : 'int8range' === a
          ? i(b)
          : 'json' === a
          ? j(b)
          : 'jsonb' === a
          ? j(b)
          : 'money' === a
          ? g(b)
          : 'numeric' === a
          ? g(b)
          : 'oid' === a
          ? h(b)
          : 'reltime' === a
          ? d(b)
          : 'time' === a
          ? d(b)
          : 'timestamp' === a
          ? l(b)
          : 'timestamptz' === a
          ? d(b)
          : 'timetz' === a
          ? d(b)
          : 'tsrange' === a
          ? f(b)
          : 'tstzrange' === a
          ? f(b)
          : d(b)
      } catch (c) {
        return (
          console.log('Could not convert cell of type '.concat(a, ' and value ').concat(b)),
          console.log('This is the error: '.concat(c)),
          b
        )
      }
    }
    a.convertCell = c
    var d = (a) => a
    a.noop = d
    var e = (a) => 't' === a || ('f' !== a && null)
    a.toBoolean = e
    a.toDate = (a) => new Date(a)
    var f = (a) => {
      var b = JSON.parse(a)
      return [new Date(b[0]), new Date(b[1])]
    }
    a.toDateRange = f
    var g = (a) => parseFloat(a)
    a.toFloat = g
    var h = (a) => parseInt(a)
    a.toInt = h
    var i = (a) => {
      var b = JSON.parse(a)
      return [parseInt(b[0]), parseInt(b[1])]
    }
    a.toIntRange = i
    var j = (a) => JSON.parse(a)
    /**
     * Converts a Postgres Array into a native JS array
     * @example toArray('{1,2,3,4}', 'int4')
     * //=> [1,2,3,4]
     * @example toArray('{}', 'int4')
     * //=> []
     */ a.toJson = j
    var k = (a, b) => {
      // this takes off the '{' & '}'
      var d = a.slice(1, a.length - 1),
        e = 0 < d.length ? d.split(',') : [],
        f = e.map((a) => c(b, a)) // converts the string into an array
      // if string is empty (meaning the array was empty), an empty array will be immediately returned
      return f
    }
    /**
     * Fixes timestamp to be ISO-8601. Swaps the space between the date and time for a 'T'
     * See https://github.com/supabase/supabase/issues/18
     * @returns {string}
     * @example toTimestampString('2019-09-10 00:00:00')
     * //=> '2019-09-10T00:00:00'
     */ a.toArray = k
    var l = (a) => a.replace(' ', 'T')
    a.toTimestampString = l
  }
)
