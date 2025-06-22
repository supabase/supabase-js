import { render, waitFor, cleanup } from '@testing-library/react-native'
import Index from '../app/index.tsx'

describe('Index', () => {
  afterEach(() => {
    cleanup()
  })

  it('should display SUBSCRIBED status when realtime connection is established', async () => {
    console.log('Starting realtime connection test...')
    const { getByTestId, unmount } = render(<Index />)

    // Initially, the text should be empty
    expect(getByTestId('realtime_status')).toHaveTextContent('')

    // Wait for the subscription status to be updated
    await waitFor(
      () => {
        const status = getByTestId('realtime_status').props.children
        console.log('Current realtime status:', status)
        expect(status).toBe('SUBSCRIBED')
      },
      {
        timeout: 60000, // 60 seconds timeout for waitFor (increased for CI)
        interval: 1000, // Check every second
        onTimeout: (error) => {
          const currentStatus = getByTestId('realtime_status').props.children
          console.error('Test timeout. Current status:', currentStatus)
          throw new Error(
            `Timeout waiting for SUBSCRIBED status. Current status: ${currentStatus}. ${error.message}`
          )
        },
      }
    )

    console.log('Test completed successfully')
    // Unmount the component to trigger cleanup.
    unmount()
  }, 70000) // 70 seconds timeout for the entire test (increased for CI)
})
