import { lowercasedJSONKey } from './utils'

export function createWxCloudFetchSb(wxClousFnName: string) {
  const wxCloudFetchSb: typeof fetch = (input, { headers, body, method } = {}) => {
    let url: string
    if (typeof input !== 'string') {
      url = (input as Request).url ?? (input as URL).toString()
    } else {
      url = input
    }

    return new Promise((resolve, reject) => {
      // @ts-ignore
      wx.cloud.callFunction({
        name: wxClousFnName,
        data: {
          reqeustOptions: {
            url: url,
            method: method as any,
            data: body ? body : undefined,
            responseType: 'text',
            headers:
              Object.prototype.toString.call(headers) == '[object Headers]'
                ? // @ts-ignore
                  Object.fromEntries(headers!.entries())
                : headers,
          },
        },
        success: (cloudFnRes: any) => {
          const response = cloudFnRes.result
          const responseData = response.data
          resolve({
            ok: true,
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
            headers: new Map(Object.entries(lowercasedJSONKey(response.headers))),
            status: response.status,
          })
        },
        fail(err: any) {
          reject(err)
        },
      })
    })
  }
  return wxCloudFetchSb
}
