import { StorageError } from './errors'

/** Validate a fully assembled URL against a trusted endpoint directory. */
export function validateStorageUrl(input: string, expected: URL): string {
  const url = new URL(input)
  // WHATWG parsing handles literal/encoded dot segments, backslashes, and
  // stripped control characters. Validate that same representation and send it.
  const prefix = expected.pathname.endsWith('/') ? expected.pathname : `${expected.pathname}/`
  if (url.origin !== expected.origin || !url.pathname.startsWith(prefix)) {
    throw new StorageError('Object path escapes the intended bucket endpoint')
  }
  return url.href
}
