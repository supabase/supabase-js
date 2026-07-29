import { MockServer } from 'jest-mock-server'
import { API_VERSION_HEADER_NAME } from '../src/lib/constants'
import { AuthUnknownError, AuthApiError, AuthRetryableFetchError } from '../src/lib/errors'
import { _request, _sessionResponse, handleError } from '../src/lib/fetch'

describe('fetch', () => {
  const server = new MockServer()

  beforeAll(async () => await server.start())
  afterAll(async () => await server.stop())
  beforeEach(() => server.reset())

  describe('Error handling', () => {
    test('should throw AuthApiError if the error response does contain valid json', async () => {
      const route = server
        .get('/')
        .mockImplementationOnce((ctx) => {
          ctx.status = 400
          ctx.body = { message: 'invalid params' }
        })
        .mockImplementation((ctx) => {
          ctx.status = 200
        })

      const url = server.getURL().toString()

      await expect(_request(fetch, 'GET', url)).rejects.toBeInstanceOf(AuthApiError)

      expect(route).toHaveBeenCalledTimes(1)
    })

    test('should throw AuthUnknownError if the error response does not contain valid json', async () => {
      const route = server
        .get('/')
        .mockImplementationOnce((ctx) => {
          ctx.status = 400
          ctx.body = 'Bad Request'
        })
        .mockImplementation((ctx) => {
          ctx.status = 200
        })

      const url = server.getURL().toString()

      await expect(_request(fetch, 'GET', url)).rejects.toBeInstanceOf(AuthUnknownError)

      expect(route).toHaveBeenCalledTimes(1)
    })

    test('should throw AuthRetryableFetchError upon internal server error (500)', async () => {
      const route = server
        .get('/')
        .mockImplementationOnce((ctx) => {
          ctx.status = 500
          ctx.body = 'Internal Server Error'
        })
        .mockImplementation((ctx) => {
          ctx.status = 200
        })

      const url = server.getURL().toString()

      await expect(_request(fetch, 'GET', url)).rejects.toBeInstanceOf(AuthRetryableFetchError)

      expect(route).toHaveBeenCalledTimes(1)
    })

    test('should throw AuthRetryableFetchError upon Cloudflare edge errors (525)', async () => {
      const route = server
        .get('/')
        .mockImplementationOnce((ctx) => {
          ctx.status = 525
          ctx.body = 'SSL Handshake Failed'
        })
        .mockImplementation((ctx) => {
          ctx.status = 200
        })

      const url = server.getURL().toString()

      await expect(_request(fetch, 'GET', url)).rejects.toBeInstanceOf(AuthRetryableFetchError)

      expect(route).toHaveBeenCalledTimes(1)
    })

    test('should throw AuthRetryableFetchError when the server aborts the request without sending any response', async () => {
      const route = server
        .get('/')
        .mockImplementationOnce((ctx) => {
          // abort the request without sending any response
          ctx.req.destroy()
        })
        .mockImplementation((ctx) => {
          ctx.status = 200
        })

      const url = server.getURL().toString()

      await expect(_request(fetch, 'GET', url)).rejects.toBeInstanceOf(AuthRetryableFetchError)

      expect(route).toHaveBeenCalledTimes(1)
    })

    test('should throw AuthRetryableFetchError when the server is not reachable', async () => {
      const route = server
        .get('/')
        .mockImplementationOnce((ctx) => {
          ctx.status = 500
          ctx.body = 'Internal Server Error'
        })
        .mockImplementation((ctx) => {
          ctx.status = 200
        })

      const url = server.getURL().toString()
      await server.stop()

      await expect(_request(fetch, 'GET', url)).rejects.toBeInstanceOf(AuthRetryableFetchError)

      expect(route).toHaveBeenCalledTimes(0)

      await server.start()
    })

    test('should not log the raw error to console.error when the fetch fails', async () => {
      // A network / CORS / aborted fetch is a transient condition surfaced to
      // the caller as AuthRetryableFetchError. It must not be logged raw here,
      // as that pollutes production consoles.
      const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})

      const route = server
        .get('/')
        .mockImplementationOnce((ctx) => {
          // abort the request without sending any response
          ctx.req.destroy()
        })
        .mockImplementation((ctx) => {
          ctx.status = 200
        })

      const url = server.getURL().toString()

      await expect(_request(fetch, 'GET', url)).rejects.toBeInstanceOf(AuthRetryableFetchError)
      expect(errorSpy).not.toHaveBeenCalled()
      expect(route).toHaveBeenCalledTimes(1)

      errorSpy.mockRestore()
    })

    test('should work with custom fetch implementation', async () => {
      const customFetch = (async () => {
        return {
          status: 400,
          ok: false,
          json: async () => {
            return { message: 'invalid params' }
          },
          headers: {
            get: () => {
              return null
            },
          },
        }
      }) as unknown as typeof fetch

      const url = server.getURL().toString()

      await expect(_request(customFetch, 'GET', url)).rejects.toBeInstanceOf(AuthApiError)
    })
  })
})

describe('handleError', () => {
  ;[
    {
      name: 'without API version and error code',
      code: 'error_code',
      ename: 'AuthApiError',
      response: new Response(
        JSON.stringify({
          code: 400,
          msg: 'Error code message',
          error_code: 'error_code',
        }),
        {
          status: 400,
          statusText: 'Bad Request',
        }
      ),
    },
    {
      name: 'without API version and weak password error code with payload',
      code: 'weak_password',
      ename: 'AuthWeakPasswordError',
      response: new Response(
        JSON.stringify({
          code: 400,
          msg: 'Error code message',
          error_code: 'weak_password',
          weak_password: {
            reasons: ['characters'],
          },
        }),
        {
          status: 400,
          statusText: 'Bad Request',
        }
      ),
    },
    {
      name: 'without API version, no error code and weak_password payload',
      code: 'weak_password',
      ename: 'AuthWeakPasswordError',
      response: new Response(
        JSON.stringify({
          msg: 'Error code message',
          weak_password: {
            reasons: ['characters'],
          },
        }),
        {
          status: 400,
          statusText: 'Bad Request',
        }
      ),
    },
    {
      name: 'with API version 2024-01-01 and error code',
      code: 'error_code',
      ename: 'AuthApiError',
      response: new Response(
        JSON.stringify({
          code: 'error_code',
          message: 'Error code message',
        }),
        {
          status: 400,
          statusText: 'Bad Request',
          headers: {
            [API_VERSION_HEADER_NAME]: '2024-01-01',
          },
        }
      ),
    },
  ].forEach((example) => {
    it(`should handle error response ${example.name}`, async () => {
      let error: any = null

      try {
        await handleError(example.response)
      } catch (e: any) {
        error = e
      }

      expect(error).not.toBeNull()
      expect(error.name).toEqual(example.ename)
      expect(error.code).toEqual(example.code)
    })
  })
})

describe('_sessionResponse', () => {
  test('returns session and user when the response carries an access token', () => {
    const user = { id: 'user-id', email: 'user@example.com' } as any
    const data = {
      access_token: 'access-token',
      refresh_token: 'refresh-token',
      expires_in: 3600,
      token_type: 'bearer',
      user,
    } as any

    const result = _sessionResponse(data)

    expect(result.error).toBeNull()
    expect(result.data.user).toEqual(user)
    expect(result.data.session).not.toBeNull()
    expect(result.data.session?.access_token).toEqual('access-token')
    expect(result.data.session?.user).toEqual(user)
    expect(typeof result.data.session?.expires_at).toEqual('number')
  })

  test('returns null user and null session for the email_change single-confirmation response', () => {
    // gotrue's POST /verify returns this body (200 OK) after the first of two
    // confirmations succeeds when secure email change is enabled.
    const data = {
      code: '200',
      msg: 'Confirmation link accepted. Please proceed to confirm link sent to the other email',
    } as any

    const result = _sessionResponse(data)

    expect(result).toEqual({ data: { session: null, user: null }, error: null })
  })

  test('returns the user but no session when the response has a user but no access token', () => {
    const user = { id: 'user-id', email: 'user@example.com' } as any

    const result = _sessionResponse({ user } as any)

    expect(result.error).toBeNull()
    expect(result.data.session).toBeNull()
    expect(result.data.user).toEqual(user)
  })
})

describe('header merging', () => {
  // Header names are case-insensitive (RFC 9110), but an object spread only
  // overrides on an exact key match, so two entries differing only in case both
  // survive and `fetch` joins them into one comma-separated value.
  const capture = () => {
    const sent: Record<string, string>[] = []
    const fetcher = (async (_url: string, init: RequestInit) => {
      sent.push(init.headers as Record<string, string>)
      return new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } })
    }) as unknown as typeof fetch
    return { fetcher, headerValue: (name: string) => new Headers(sent[0]).get(name) }
  }

  test('a caller-supplied lowercase authorization is not duplicated by the jwt', async () => {
    const { fetcher, headerValue } = capture()

    await _request(fetcher, 'GET', 'http://localhost/user', {
      headers: { authorization: 'Bearer caller' },
      jwt: 'from-jwt-option',
    })

    expect(headerValue('authorization')).toBe('Bearer from-jwt-option')
  })

  test('a caller-supplied api version header is not duplicated by the default', async () => {
    const { fetcher, headerValue } = capture()

    await _request(fetcher, 'GET', 'http://localhost/user', {
      headers: { [API_VERSION_HEADER_NAME.toLowerCase()]: '2024-01-01' },
    })

    expect(headerValue(API_VERSION_HEADER_NAME)).toBe('2024-01-01')
  })

  test('a caller-supplied content-type is not duplicated by the json default', async () => {
    const { fetcher, headerValue } = capture()

    await _request(fetcher, 'POST', 'http://localhost/user', {
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: { a: 1 },
    })

    expect(headerValue('content-type')).toBe('application/x-www-form-urlencoded')
  })
})
