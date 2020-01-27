import BaseApi from './BaseApi'
import BaseRequest from './BaseRequest'

class PostgrestClient {
  constructor(restUrl, additionalParameters = {}) {
    this.restUrl = restUrl
    this.additionalParameters = additionalParameters
  }

  from(tableName){
    let path = `${this.restUrl}/${tableName}?`

    Object.keys(this.additionalParameters).forEach(param => {
      path =`${path}${param}=${this.additionalParameters[param]}&`
    })

    // We want to remove the last '&'
    let pathCleaned = path.slice(0,-1)
  
    let api = new BaseApi(pathCleaned)
    return api
  }

  rpc(functionName, functionParameters = null){
    let path =`${this.restUrl}/rpc/${functionName}?`

    Object.keys(this.additionalParameters).forEach(param => {
      path =`${path}${param}=${this.additionalParameters[param]}&`
    })

    // We want to remove the last '&'
    let pathCleaned = path.slice(0,-1)

    let request = new BaseRequest('post', pathCleaned)
    if(functionParameters != null) request.send(functionParameters)
    return request
  }
  
}

export { PostgrestClient }
