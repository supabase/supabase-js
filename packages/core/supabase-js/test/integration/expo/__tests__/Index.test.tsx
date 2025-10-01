import { cleanup, render, waitFor } from '@testing-library/react-native'
import Index from '../app/index.tsx'

describe('Index', () => {
  afterEach(() => {
    cleanup()
  })

  it('should display SUBSCRIBED status when realtime connection is established', async () => {
    const { getByTestId, unmount } = render(<Index />)

    // Initially, the text should be empty
    expect(getByTestId('realtime_status')).toHaveTextContent('')

    // Wait for the subscription status to be updated
    await waitFor(
      () => {
        const status = getByTestId('realtime_status').props.children
        expect(status).toBe('SUBSCRIBED')
      },
      {
        timeout: 30000, // 30 seconds timeout for waitFor
        interval: 1000, // Check every second
        onTimeout: (error) => {
          const currentStatus = getByTestId('realtime_status').props.children
          throw new Error(
            `Timeout waiting for SUBSCRIBED status. Current status: ${currentStatus}. ${error.message}`
          )
        },
      }
    )

    // Unmount the component to trigger cleanup.
    unmount()
  }, 35000) // 35 seconds timeout for the entire test
})
