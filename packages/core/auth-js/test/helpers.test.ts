import { stackGuard, isInStackGuard } from '../src/lib/helpers'

describe('stackGuard and isInStackGuard', () => {
  it('should detect that a nested function is in a stack guard', async () => {
    let result: boolean | null = null

    const nested = async () => {
      result = isInStackGuard('TEST')
    }

    await stackGuard('TEST', async () => {
      await nested()
    })

    expect(result).toBe(true)
  })

  it('should not detect that a nested function is in a stack guard', async () => {
    let result: boolean | null = null

    const nested = async () => {
      result = isInStackGuard('TEST')
    }

    await stackGuard('DIFFERENT', async () => {
      await nested()
    })

    expect(result).toBe(false)
  })

  it('should not detect that a function called outside a stack guard is in one', async () => {
    let result: boolean | null = null

    const nested = async () => {
      result = isInStackGuard('TEST')
    }

    await stackGuard('TEST', async () => {
      // not calling nested
    })

    await nested()

    expect(result).toBe(false)
  })
})
