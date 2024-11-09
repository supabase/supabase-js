import { resolveFetch, resolveHeadersConstructor } from './helpers'
import { Fetch } from './types'

export const fetchWithAuth = (
  supabaseKey: string,
  getAccessToken: () => Promise<string | null>,
  customFetch?: Fetch
): Fetch => {
  const fetch = resolveFetch(customFetch)

  return async (input, init) => {
    const accessToken = (await getAccessToken()) ?? supabaseKey

    const HeadersConstructor = await resolveHeadersConstructor()
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
