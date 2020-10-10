export function uuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    var r = (Math.random() * 16) | 0,
      v = c == 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

export const isBrowser = () => typeof window !== 'undefined'

export function getParameterByName(name: string, url?: string) {
  if (!url) url = window.location.href
  name = name.replace(/[\[\]]/g, '\\$&')
  var regex = new RegExp('[?&]' + name + '(=([^&#]*)|&|#|$)'),
    results = regex.exec(url)
  if (!results) return null
  if (!results[2]) return ''
  return decodeURIComponent(results[2].replace(/\+/g, ' '))
}

export class LocalStorage implements Storage{
  localStorage!: Storage
  constructor(localStorage: Storage) {
    this.localStorage = localStorage;
  }
  [name: string]: any
  length!: number
  clear(): void {
    return this.localStorage.clear();
  }
  key(index: number): string | null {
    return this.localStorage.key(index);
  }
  setItem(key: string, value: any) {
    return this.localStorage.setItem(key, value);
  }
  getItem(key: string) {
    return this.localStorage.getItem(key);
  }
  removeItem(key: string) {
    return this.localStorage.removeItem(key);
  }
  async getItemAsync(key: string) {
    return await this.localStorage.getItem(key);
  }
  async removeItemAsync(key: string) {
    return await this.localStorage.removeItem(key);
  }
}
