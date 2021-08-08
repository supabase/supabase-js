/**
 * Helpers to convert the change Payload into native JS types.
 */

// Adapted from epgsql (src/epgsql_binary.erl), this module licensed under
// 3-clause BSD found here: https://raw.githubusercontent.com/epgsql/epgsql/devel/LICENSE

export enum PostgresTypes {
  abstime = 'abstime',
  bool = 'bool',
  date = 'date',
  daterange = 'daterange',
  float4 = 'float4',
  float8 = 'float8',
  int2 = 'int2',
  int4 = 'int4',
  int4range = 'int4range',
  int8 = 'int8',
  int8range = 'int8range',
  json = 'json',
  jsonb = 'jsonb',
  money = 'money',
  numeric = 'numeric',
  oid = 'oid',
  reltime = 'reltime',
  time = 'time',
  timestamp = 'timestamp',
  timestamptz = 'timestamptz',
  timetz = 'timetz',
  tsrange = 'tsrange',
  tstzrange = 'tstzrange',
}

type Column = {
  flags: string[] // any special flags for the column. eg: ["key"]
  name: string // the column name. eg: "user_id"
  type: string // the column type. eg: "uuid"
  type_modifier: number // the type modifier. eg: 4294967295
}

type Records = {
  [key: string]: string
}

/**
 * Takes an array of columns and an object of string values then converts each string value
 * to its mapped type.
 *
 * @param {{name: String, type: String}[]} columns
 * @param {Object} records
 * @param {Object} options The map of various options that can be applied to the mapper
 * @param {Array} options.skipTypes The array of types that should not be converted
 *
 * @example convertChangeData([{name: 'first_name', type: 'text'}, {name: 'age', type: 'int4'}], {first_name: 'Paul', age:'33'}, {})
 * //=>{ first_name: 'Paul', age: 33 }
 */
export const convertChangeData = (
  columns: Column[],
  records: Records,
  options: { skipTypes?: string[] } = {}
) => {
  let result: { [key: string]: any } = {}
  let skipTypes =
    typeof options.skipTypes !== 'undefined' ? options.skipTypes : []
  Object.entries(records).map(([key, value]) => {
    result[key] = convertColumn(key, columns, records, skipTypes)
  })
  return result
}

/**
 * Converts the value of an individual column.
 *
 * @param {String} columnName The column that you want to convert
 * @param {{name: String, type: String}[]} columns All of the columns
 * @param {Object} records The map of string values
 * @param {Array} skipTypes An array of types that should not be converted
 * @return {object} Useless information
 *
 * @example convertColumn('age', [{name: 'first_name', type: 'text'}, {name: 'age', type: 'int4'}], {first_name: 'Paul', age: '33'}, [])
 * //=> 33
 * @example convertColumn('age', [{name: 'first_name', type: 'text'}, {name: 'age', type: 'int4'}], {first_name: 'Paul', age: '33'}, ['int4'])
 * //=> "33"
 */
export const convertColumn = (
  columnName: string,
  columns: Column[],
  records: Records,
  skipTypes: string[]
): any => {
  let column = columns.find((x) => x.name == columnName)
  if (!column || skipTypes.includes(column.type)) {
    return noop(records[columnName])
  } else {
    return convertCell(column.type, records[columnName])
  }
}

/**
 * If the value of the cell is `null`, returns null.
 * Otherwise converts the string value to the correct type.
 * @param {String} type A postgres column type
 * @param {String} stringValue The cell value
 *
 * @example convertCell('bool', 't')
 * //=> true
 * @example convertCell('int8', '10')
 * //=> 10
 * @example convertCell('_int4', '{1,2,3,4}')
 * //=> [1,2,3,4]
 */
export const convertCell = (type: string, stringValue: string) => {
  try {
    if (stringValue === null) return null

    // if data type is an array
    if (type.charAt(0) === '_') {
      let arrayValue = type.slice(1, type.length)
      return toArray(stringValue, arrayValue)
    }

    // If not null, convert to correct type.
    switch (type) {
      case PostgresTypes.abstime:
        return noop(stringValue) // To allow users to cast it based on Timezone
      case PostgresTypes.bool:
        return toBoolean(stringValue)
      case PostgresTypes.date:
        return noop(stringValue) // To allow users to cast it based on Timezone
      case PostgresTypes.daterange:
        return toDateRange(stringValue)
      case PostgresTypes.float4:
        return toFloat(stringValue)
      case PostgresTypes.float8:
        return toFloat(stringValue)
      case PostgresTypes.int2:
        return toInt(stringValue)
      case PostgresTypes.int4:
        return toInt(stringValue)
      case PostgresTypes.int4range:
        return toIntRange(stringValue)
      case PostgresTypes.int8:
        return toInt(stringValue)
      case PostgresTypes.int8range:
        return toIntRange(stringValue)
      case PostgresTypes.json:
        return toJson(stringValue)
      case PostgresTypes.jsonb:
        return toJson(stringValue)
      case PostgresTypes.money:
        return toFloat(stringValue)
      case PostgresTypes.numeric:
        return toFloat(stringValue)
      case PostgresTypes.oid:
        return toInt(stringValue)
      case PostgresTypes.reltime:
        return noop(stringValue) // To allow users to cast it based on Timezone
      case PostgresTypes.time:
        return noop(stringValue) // To allow users to cast it based on Timezone
      case PostgresTypes.timestamp:
        return toTimestampString(stringValue) // Format to be consistent with PostgREST
      case PostgresTypes.timestamptz:
        return noop(stringValue) // To allow users to cast it based on Timezone
      case PostgresTypes.timetz:
        return noop(stringValue) // To allow users to cast it based on Timezone
      case PostgresTypes.tsrange:
        return toDateRange(stringValue)
      case PostgresTypes.tstzrange:
        return toDateRange(stringValue)
      default:
        // All the rest will be returned as strings
        return noop(stringValue)
    }
  } catch (error) {
    console.log(
      `Could not convert cell of type ${type} and value ${stringValue}`
    )
    console.log(`This is the error: ${error}`)
    return stringValue
  }
}

const noop = (stringValue: string): string => {
  return stringValue
}
export const toBoolean = (stringValue: string) => {
  switch (stringValue) {
    case 't':
      return true
    case 'f':
      return false
    default:
      return null
  }
}
export const toDate = (stringValue: string) => {
  return new Date(stringValue)
}
export const toDateRange = (stringValue: string) => {
  let arr = JSON.parse(stringValue)
  return [new Date(arr[0]), new Date(arr[1])]
}
export const toFloat = (stringValue: string) => {
  return parseFloat(stringValue)
}
export const toInt = (stringValue: string) => {
  return parseInt(stringValue)
}
export const toIntRange = (stringValue: string) => {
  let arr = JSON.parse(stringValue)
  return [parseInt(arr[0]), parseInt(arr[1])]
}
export const toJson = (stringValue: string) => {
  return JSON.parse(stringValue)
}

/**
 * Converts a Postgres Array into a native JS array
 *
 * @example toArray('{1,2,3,4}', 'int4')
 * //=> [1,2,3,4]
 * @example toArray('{}', 'int4')
 * //=> []
 */
export const toArray = (stringValue: string, type: string) => {
  // this takes off the '{' & '}'
  let stringEnriched = stringValue.slice(1, stringValue.length - 1)

  // converts the string into an array
  // if string is empty (meaning the array was empty), an empty array will be immediately returned
  let stringArray = stringEnriched.length > 0 ? stringEnriched.split(',') : []
  let array: any[] = stringArray.map((string) => {
    return convertCell(type, string)
  })

  return array
}

/**
 * Fixes timestamp to be ISO-8601. Swaps the space between the date and time for a 'T'
 * See https://github.com/supabase/supabase/issues/18
 *
 * @example toTimestampString('2019-09-10 00:00:00')
 * //=> '2019-09-10T00:00:00'
 */
export const toTimestampString = (stringValue: string) => {
  return stringValue.replace(' ', 'T')
}
