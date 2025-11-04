import { MockServer } from 'jest-mock-server'
import { API_VERSION_HEADER_NAME } from '../src/lib/constants'
import { AuthUnknownError, AuthApiError, AuthRetryableFetchError } from '../src/lib/errors'
import { _request, handleError } from '../src/lib/fetch'

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

    test('should not throw AuthRetryableFetchError upon internal server error', async () => {
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

      await expect(_request(fetch, 'GET', url)).rejects.not.toBeInstanceOf(AuthRetryableFetchError)

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
