declare const uni: any

export function fetch(input: RequestInfo, options: RequestInit = {}): Promise<Response> {
  const { body, ...restOptions } = options
  // console.log('uniFetch---supabase----', input, options)
  return new Promise((resolve, reject) => {
    uni.request({
      url: typeof input === 'string' ? input : input.url,
      method: restOptions.method || 'GET',
      data: body || {},
      header: {
        ...restOptions.headers,
      },
      success: (res: any) => {
        resolve(res)
      },
      fail: (err: any) => {
        reject(err)
      },
    })
  })
}
