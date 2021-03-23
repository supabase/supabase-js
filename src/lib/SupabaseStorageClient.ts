import { StorageApi } from './storage'

export class SupabaseStorageClient extends StorageApi {
  constructor(url: string, headers: { [key: string]: string } = {}) {
    super(url, headers)
  }
}
