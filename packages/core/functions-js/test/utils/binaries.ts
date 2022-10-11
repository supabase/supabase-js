/**
 * Convert a buffer to a string
 * @param buf - the buffer to convert to a string
 * @returns The string representation of the buffer.
 */
export function ab2str(buf: ArrayBufferLike) {
  let str = ''

  new Uint16Array(buf).forEach(function (byte: number) {
    str += String.fromCharCode(byte)
  })
  return str
}

/**
 * Convert a string to an array buffer
 * @param str - The string to be converted into an ArrayBuffer.
 * @returns The array buffer that contains the string.
 */
export function str2ab(str: string) {
  var buf = new ArrayBuffer(str.length * 2) // 2 bytes for each char
  var bufView = new Uint16Array(buf)
  for (var i = 0, strLen = str.length; i < strLen; i++) {
    bufView[i] = str.charCodeAt(i)
  }
  return buf
}
