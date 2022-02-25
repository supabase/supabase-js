import crossFetch from 'cross-fetch'

type Fetch = typeof fetch

export const resolveFetch = (customFetch?: Fetch): Fetch => {
  if (customFetch) {
    return customFetch
  } else if (typeof fetch === 'undefined') {
    return (crossFetch as unknown) as Fetch
  } else {
    return fetch
  }
}
