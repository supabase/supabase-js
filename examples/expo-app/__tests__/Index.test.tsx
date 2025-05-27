import { render, waitFor, cleanup } from '@testing-library/react-native'
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
        expect(getByTestId('realtime_status')).toHaveTextContent('SUBSCRIBED')
      },
      {
        timeout: 2000,
      }
    )

    // Unmount the component to trigger cleanup.
    unmount()
  })
})
