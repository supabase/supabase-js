export function lowercasedJSONKey(jsonObj: any) {
  for (var key in jsonObj) {
    if (/[A-Z]/.test(key)) {
      jsonObj[key.toLowerCase()] = jsonObj[key]
      delete jsonObj[key]
    }
  }
  return jsonObj
}
