import { StorageClient } from './storage'

export class SupabaseStorageClient extends StorageClient {
  constructor(url: string, headers: { [key: string]: string } = {}) {
    super(url, headers)
  }
}
