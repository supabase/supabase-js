import { test, expect } from '@playwright/test'

test.describe('WebSocket Browser Tests', () => {
  test('should test WebSocket transport', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('#log')).toBeVisible()
    await page.waitForTimeout(5000)

    const logContent = await page.locator('#log').textContent()
    console.log('WebSocket test log content:', logContent)

    expect(logContent).toContain('WebSocket constructor called')
    //Try to check fix for https://github.com/supabase/realtime-js/issues/493
    expect(logContent).not.toContain('WebSocket constructor called with 3 parameters')

    // Handle channel errors gracefully - if there's an error, ensure recovery happened
    if (logContent && logContent.includes('CHANNEL_ERROR')) {
      expect(logContent).toContain('WebSocket subscribe callback called with: SUBSCRIBED')
      console.log('Channel experienced initial error but recovered successfully')
    } else {
      // If no channel error, just verify successful subscription
      expect(logContent).toContain('WebSocket subscribe callback called with: SUBSCRIBED')
    }

    expect(logContent).not.toContain('Global error')
    expect(logContent).not.toContain('Unhandled promise rejection')
  })
})
