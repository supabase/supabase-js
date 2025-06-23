import { test, expect } from '@playwright/test'

test.describe('Home Page', () => {
  test('should subscribe to realtime channel', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByTestId('realtime_status')).toHaveText('SUBSCRIBED')
  })
})
