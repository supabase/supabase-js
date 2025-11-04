type Fetch = typeof fetch

export const resolveFetch = (customFetch?: Fetch): Fetch => {
  if (customFetch) {
    return (...args: Parameters<Fetch>) => customFetch(...args)
  }
  return (...args: Parameters<Fetch>) => fetch(...args)
}

export const resolveHeadersConstructor = () => {
  return Headers
}

export const fetchWithAuth = (
  supabaseKey: string,
  getAccessToken: () => Promise<string | null>,
  customFetch?: Fetch
): Fetch => {
  const fetch = resolveFetch(customFetch)
  const HeadersConstructor = resolveHeadersConstructor()

  return async (input, init) => {
    const accessToken = (await getAccessToken()) ?? supabaseKey
    let headers = new HeadersConstructor(init?.headers)

    if (!headers.has('apikey')) {
      headers.set('apikey', supabaseKey)
    }

    if (!headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${accessToken}`)
    }

    return fetch(input, { ...init, headers })
  }
}
