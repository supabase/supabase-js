declare const uni: any
interface FetchOptions extends Omit<RequestInit, 'body'> {
  data?: Record<string, unknown>
}

interface _Response {
  arrayBuffer(): Promise<ArrayBuffer>
  blob(): Promise<Blob>
  formData(): Promise<FormData>
  json(): Promise<any>
  text(): string
  body: ReadableStream<Uint8Array> | null
  bodyUsed: boolean
  headers: Record<string, string> | null
  ok: boolean
  redirected: boolean
  status: number
  statusText: string
  trailer: Promise<Record<string, string>> | null
  url: string
  clone(): Response
}

class MyResponse implements _Response {
  constructor() {}
  arrayBuffer(): Promise<ArrayBuffer> {
    throw new Error('Method not implemented.')
  }
  blob(): Promise<Blob> {
    throw new Error('Method not implemented.')
  }
  formData(): Promise<FormData> {
    throw new Error('Method not implemented.')
  }
  json(): Promise<any> {
    throw new Error('Method not implemented.')
  }
  text(): string {
    throw new Error('Method not implemented.')
  }
  body = null
  bodyUsed = false
  headers = null
  ok = true
  redirected = false
  status = 200
  statusText = 'OK'
  trailer = null

  url = ''
  clone(): Response {
    throw new Error('Method not implemented.')
  }
}

export function fetch(input: RequestInfo, options: FetchOptions = {}): Promise<Response> {
  const { data, ...restOptions } = options
  console.log('uniFetch---supabase----', input, options)
  return new Promise((resolve, reject) => {
    uni.request({
      url: typeof input === 'string' ? input : input.url,
      method: restOptions.method || 'GET',
      data: data || {},
      header: {
        ...restOptions.headers,
      },
      success: (res: any) => {
        resolve(res.data)
      },
      fail: (err: any) => {
        reject(new Error(`Request failed: ${err}`))
      },
    })
  })
}
