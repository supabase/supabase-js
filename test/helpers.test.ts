import * as helpers from '../src/lib/helpers'

test('uuid', async () => {
  expect(helpers.uuid()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)
})
