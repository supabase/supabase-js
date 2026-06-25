import { cleanup, render, waitFor } from '@testing-library/react-native'
import Index from '../app/index.tsx'

describe('Index', () => {
  afterEach(() => {
    cleanup()
  })

  const versions = [{ vsn: '1.0.0' }, { vsn: '2.0.0' }]

  versions.forEach(({ vsn }) => {
    describe(`Realtime with vsn: ${vsn}`, () => {
      it('should display SUBSCRIBED status when realtime connection is established', async () => {
        const { getByTestId, unmount } = render(<Index vsn={vsn} />)

        // Verify correct version is being used
        expect(getByTestId('vsn')).toHaveTextContent(vsn)

        // Initially, the status should be empty
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
                `Timeout waiting for SUBSCRIBED status with vsn ${vsn}. Current status: ${currentStatus}. ${error.message}`
              )
            },
          }
        )

        // Unmount the component to trigger cleanup
        unmount()
      }, 35000) // 35 seconds timeout for the entire test

      it('can broadcast and receive messages', async () => {
        const { getByTestId, unmount } = render(<Index vsn={vsn} />)

        // Wait for subscription
        await waitFor(
          () => {
            const status = getByTestId('realtime_status').props.children
            expect(status).toBe('SUBSCRIBED')
          },
          {
            timeout: 30000,
            interval: 1000,
          }
        )

        // Wait for broadcast message to be received
        await waitFor(
          () => {
            const message = getByTestId('received_message').props.children
            expect(message).toBe('Hello from Expo!')
          },
          {
            timeout: 30000,
            interval: 1000,
            onTimeout: (error) => {
              const currentMessage = getByTestId('received_message').props.children
              throw new Error(
                `Timeout waiting for broadcast message with vsn ${vsn}. Current message: ${currentMessage}. ${error.message}`
              )
            },
          }
        )

        // Unmount the component to trigger cleanup
        unmount()
      }, 35000) // 35 seconds timeout for the entire test
    })
  })
})
