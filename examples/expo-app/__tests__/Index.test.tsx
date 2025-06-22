import { render, waitFor, cleanup } from '@testing-library/react-native'
import Index from '../app/index.tsx'

describe('Index', () => {
  afterEach(() => {
    cleanup()
  })

  it('should display SUBSCRIBED status when realtime connection is established', async () => {
    console.log('Starting realtime connection test...')
    console.log('Environment variables:')
    console.log('- SUPABASE_URL:', process.env.SUPABASE_URL || 'not set')
    console.log('- SUPABASE_ANON_KEY:', process.env.SUPABASE_ANON_KEY ? 'set' : 'not set')

    const { getByTestId, unmount } = render(<Index />)

    // Initially, the text should be empty
    expect(getByTestId('realtime_status')).toHaveTextContent('')

    // Add some initial debugging
    console.log('Component rendered, waiting for realtime status')

    // Wait for the subscription status to be updated
    await waitFor(
      () => {
        const status = getByTestId('realtime_status').props.children
        console.log('Current realtime status:', status)

        // Add more debugging for CI
        if (status === 'TIMED_OUT') {
          console.log('Status is TIMED_OUT - this indicates a connection issue')
        } else if (status === 'CHANNEL_ERROR') {
          console.log('Status is CHANNEL_ERROR - this indicates a channel subscription issue')
        } else if (status === 'CLOSED') {
          console.log('Status is CLOSED')
        } else if (!status) {
          console.log('Status is empty')
        }

        expect(status).toBe('SUBSCRIBED')
      },
      {
        timeout: 90000, // 90 seconds timeout for waitFor (increased for CI)
        interval: 1000, // Check every second
        onTimeout: (error) => {
          const currentStatus = getByTestId('realtime_status').props.children
          console.error('Test timeout. Current status:', currentStatus)
          console.error('Environment check:')
          console.error('- SUPABASE_URL:', process.env.SUPABASE_URL)
          console.error(
            '- SUPABASE_ANON_KEY:',
            process.env.SUPABASE_ANON_KEY ? 'present' : 'missing'
          )
          console.error('the realtime connection failed')
          throw new Error(
            `Timeout waiting for SUBSCRIBED status. Current status: ${currentStatus}. ${error.message}`
          )
        },
      }
    )

    console.log('Test completed successfully')
    // Unmount the component to trigger cleanup.
    unmount()
  }, 100000) // 100 seconds timeout for the entire test (increased for CI)
})
