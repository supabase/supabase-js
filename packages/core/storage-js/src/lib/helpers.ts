export const getGlobalFetch = (): typeof fetch | undefined => {
  if (typeof fetch === 'undefined') {
    return undefined
  } else {
    return fetch
  }
}
