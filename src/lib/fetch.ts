import { fetch } from './uniFetch'

type Fetch = typeof fetch

export const resolveFetch = (customFetch?: Fetch): Fetch => {
  let _fetch: Fetch
  if (customFetch) {
    _fetch = customFetch
  } else if (typeof fetch === 'undefined') {
    _fetch = fetch as unknown as Fetch
  } else {
    _fetch = fetch
  }
  return (...args) => _fetch(...args)
}

// export const resolveHeadersConstructor = () => {
//   if (typeof Headers === 'undefined') {
//     return CrossFetchHeaders
//   }

//   return Headers
// }

export const fetchWithAuth = (
  supabaseKey: string,
  getAccessToken: () => Promise<string | null>,
  customFetch?: Fetch
): Fetch => {
  const fetch = resolveFetch(customFetch)
  console.log('fetchWithAuth---supabase----')
  return async (input, init) => {
    const accessToken = (await getAccessToken()) ?? supabaseKey

    let headers: any = init?.headers

    if (!headers['apikey']) {
      headers['apikey'] = supabaseKey
    }

    if (!headers['Authorization']) {
      headers['Authorization'] = `Bearer ${accessToken}`
    }

    return fetch(input, { ...init, headers })
  }
}

export const getHostName = (url: string) => {
  const regex = /^(?:https?:\/\/)?(?:[^@\n]+@)?(?:www\.)?([^:\/\n]+\.[^:\/\n]+)/g
  const match = regex.exec(url)
  return match && match[1]
}
