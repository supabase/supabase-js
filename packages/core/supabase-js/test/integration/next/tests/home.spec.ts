import { test, expect } from '@playwright/test'

test.describe('Home Page', () => {
  const versions = [{ vsn: '1.0.0' }, { vsn: '2.0.0' }]

  versions.forEach(({ vsn }) => {
    test.describe(`Realtime throttle with vsn: ${vsn}`, () => {
      test('should subscribe all channels even when rate is exceeded', async ({ page }) => {
        await page.goto(`/?vsn=${vsn}&throttle=true`)

        await expect(page.getByTestId('throttle_subscribed')).toHaveText(
          String(5),
          { timeout: 30000 }
        )

        const total = await page.getByTestId('throttle_channel_count').textContent()
        const subscribed = await page.getByTestId('throttle_subscribed').textContent()
        expect(subscribed).toBe(total)
      })
    })

    test.describe(`Realtime with vsn: ${vsn}`, () => {
      test('should subscribe to realtime channel', async ({ page }) => {
        await page.goto(`/?vsn=${vsn}`)

        // Verify correct version is being used
        await expect(page.getByTestId('vsn')).toHaveText(vsn)

        // Verify subscription
        await expect(page.getByTestId('realtime_status')).toHaveText('SUBSCRIBED')
      })

      test('can broadcast and receive messages', async ({ page }) => {
        await page.goto(`/?vsn=${vsn}`)

        // Wait for subscription
        await expect(page.getByTestId('realtime_status')).toHaveText('SUBSCRIBED')

        // Wait for and verify broadcast message was received
        await expect(page.getByTestId('received_message')).toHaveText('Hello from Next.js!', {
          timeout: 5000
        })
      })
    })
  })
})
