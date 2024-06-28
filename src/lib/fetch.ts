type Fetch = typeof fetch

export const fetchWithAuth = (
  supabaseKey: string,
  getAccessToken: () => Promise<string | null>,
  customFetch?: Fetch
): Fetch => {
  return async (input, init) => {
    const fetch_ = customFetch ?? fetch
    const accessToken = (await getAccessToken()) ?? supabaseKey
    let headers = new Headers(init?.headers)

    if (!headers.has('apikey')) {
      headers.set('apikey', supabaseKey)
    }

    if (!headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${accessToken}`)
    }

    return fetch_(input, { ...init, headers })
  }
}
