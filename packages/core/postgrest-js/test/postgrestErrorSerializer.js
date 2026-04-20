/**
 * Custom Jest snapshot serializer for PostgrestError instances.
 * Serializes PostgrestError as a plain object so existing inline snapshots
 * remain compatible after the instanceof fix in PostgrestBuilder.
 */
module.exports = {
  test(val) {
    return (
      val !== null &&
      typeof val === 'object' &&
      val.constructor &&
      val.constructor.name === 'PostgrestError'
    )
  },
  print(val, serialize) {
    return serialize({
      code: val.code,
      details: val.details,
      hint: val.hint,
      message: val.message,
    })
  },
}
