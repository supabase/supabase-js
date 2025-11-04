import { Fetch } from './types'

export const resolveFetch = (customFetch?: Fetch): Fetch => {
  if (customFetch) {
    return (...args) => customFetch(...args)
  }
  return (...args) => fetch(...args)
}
