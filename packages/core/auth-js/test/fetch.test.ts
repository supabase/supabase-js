import { MockServer } from 'jest-mock-server'
import fetch from 'cross-fetch'
import { AuthUnknownError, AuthApiError, AuthRetryableFetchError } from '../src/lib/errors'
import { _request } from '../src/lib/fetch'

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
          ctx.body = {'message': 'invalid params'}
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

    test('should throw AuthRetryableFetchError upon internal server error', async () => {
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
            return {'message': 'invalid params'}
          }
        };
      }) as unknown as typeof fetch

      const url = server.getURL().toString()

      await expect(_request(customFetch, 'GET', url)).rejects.toBeInstanceOf(AuthApiError)
    })
  })
})
