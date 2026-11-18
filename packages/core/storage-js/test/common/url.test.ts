import { StorageError } from '../../src/lib/common/errors'
import { validateStorageUrl } from '../../src/lib/common/url'

const base = 'https://example.invalid/proxy/storage/v1'

test.each([
  'https://other.invalid/proxy/storage/v1/object/uploads/file',
  `${base}/object/uploads-other/file`,
  `${base}/object/uploads`,
  `${base}/object/uploads/../../rest/v1/example`,
])('URL validation rejects a different origin or endpoint: %s', (url) => {
  expect(() => validateStorageUrl(url, new URL(`${base}/object/uploads`))).toThrow(StorageError)
})
