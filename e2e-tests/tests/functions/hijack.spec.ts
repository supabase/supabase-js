import 'jest'

import { createFunctionsClient } from '../../helpers/functions-client'

describe('hijack connection', () => {
  const func = 'hijack'

  test('invoke func', async () => {
    /**
     * @feature hijack
     */
    const fclient = createFunctionsClient()

    const { data, error } = await fclient.invoke(func, {})

    expect(error).not.toBeNull()
  })
})
