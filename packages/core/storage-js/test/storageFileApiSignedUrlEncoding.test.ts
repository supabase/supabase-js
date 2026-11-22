import StorageFileApi from '../src/packages/StorageFileApi'

const BASE_URL = 'https://example.supabase.co/storage/v1'

function createJsonResponse(payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })
}

describe('StorageFileApi signed URL query parameter encoding', () => {
  test('createSignedUrl does not double-encode special characters or UTF-8 in download filename', async () => {
    const fetchMock = jest.fn(async () =>
      createJsonResponse({
        signedURL: '/object/sign/uploads/my folder/report.pdf?token=test-token',
      })
    )
    const api = new StorageFileApi(BASE_URL, {}, 'uploads', fetchMock)

    const { data, error } = await api.createSignedUrl('my folder/report.pdf', 60, {
      download: 'report #1&final+v2.pdf',
    })

    expect(error).toBeNull()
    expect(data?.signedUrl).toBe(
      `${BASE_URL}/object/sign/uploads/my%20folder/report.pdf?token=test-token&download=report+%231%26final%2Bv2.pdf`
    )
    expect(data?.signedUrl).not.toContain('%25')

    const utf8Res = await api.createSignedUrl('my folder/report.pdf', 60, {
      download: 'résumé #1.pdf',
    })
    expect(utf8Res.error).toBeNull()
    expect(utf8Res.data?.signedUrl).toBe(
      `${BASE_URL}/object/sign/uploads/my%20folder/report.pdf?token=test-token&download=r%C3%A9sum%C3%A9+%231.pdf`
    )
    expect(utf8Res.data?.signedUrl).not.toContain('%25')
  })

  test('createSignedUrls does not double-encode query params and keeps null for failed entries', async () => {
    const fetchMock = jest.fn(async () =>
      createJsonResponse([
        {
          error: null,
          path: 'my folder/report.pdf',
          signedURL: '/object/sign/uploads/my folder/report.pdf?token=test-token',
        },
        {
          error: 'not found',
          path: 'missing.pdf',
          signedURL: null,
        },
      ])
    )
    const api = new StorageFileApi(BASE_URL, {}, 'uploads', fetchMock)

    const { data, error } = await api.createSignedUrls(
      ['my folder/report.pdf', 'missing.pdf'],
      60,
      {
        download: 'résumé #1&v=2.pdf',
      }
    )

    expect(error).toBeNull()
    expect(data).toEqual([
      {
        error: null,
        path: 'my folder/report.pdf',
        signedURL: '/object/sign/uploads/my folder/report.pdf?token=test-token',
        signedUrl: `${BASE_URL}/object/sign/uploads/my%20folder/report.pdf?token=test-token&download=r%C3%A9sum%C3%A9+%231%26v%3D2.pdf`,
      },
      {
        error: 'not found',
        path: 'missing.pdf',
        signedURL: null,
        signedUrl: null,
      },
    ])
  })
})
