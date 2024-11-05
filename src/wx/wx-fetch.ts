// @ts-nocheck

export const wxFetchSb: typeof fetch = (input, { headers, body, method, signal } = {}) => {
  let url: string
  if (typeof input !== 'string') {
    url = (input as Request).url ?? (input as URL).toString()
  } else {
    url = input
  }

  return new Promise((resolve, reject) => {
    const requestTask = wx.request({
      url: url,
      method: method as any,
      dataType: 'json',
      data: body ? body : undefined,
      responseType: 'text',
      header:
        Object.prototype.toString.call(headers) == '[object Headers]'
          ? // @ts-ignore
            Object.fromEntries(headers!.entries())
          : headers,
      // success: resolve
      success: (res: any) => {
        const responseData = res.data
        resolve({
          ok: !!(res.statusCode >= 200 && res.statusCode < 300),
          json: () =>
            new Promise((r) => {
              r(
                responseData && typeof responseData === 'string'
                  ? JSON.parse(responseData)
                  : responseData
              )
            }),
          text: () =>
            new Promise((r) => {
              r(
                responseData && typeof responseData !== 'string'
                  ? JSON.stringify(responseData)
                  : responseData
              )
            }),
          // @ts-ignore
          // headers: new Map(Object.entries(lowercasedJSONKey(res.header))),
          headers: new Map(Object.entries(res.header)),
          status: res.statusCode,
        })
      },
      fail: (error: any) => {
        reject(error)
      },
    })

    if (signal) {
      signal.addEventListener('abort', () => {
        console.log('abort')
        requestTask.abort()
        reject(new Error('Request aborted'))
      })
    }
  })
}
