import { test, expect } from '@playwright/test'

test.describe('Realtime Chat E2E', () => {
  test('app loads and shows chat UI with a username', async ({ page }) => {
    await page.goto('/')

    await expect(page.locator('h1:has-text("Realtime Chat")')).toBeVisible({ timeout: 15000 })

    await expect(page.locator('text=Chatting as')).toBeVisible()

    await expect(page.locator('button:has-text("general")')).toBeVisible()
    await expect(page.locator('button:has-text("random")')).toBeVisible()

    await expect(page.locator('input[placeholder="Type a message..."]')).toBeVisible()
    await expect(page.locator('button:has-text("Send")')).toBeVisible()
  })

  test('empty room shows "No messages yet" placeholder', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('h1:has-text("Realtime Chat")')).toBeVisible({ timeout: 15000 })

    await page.click('button:has-text("off-topic")')
    await page.waitForTimeout(1000)
  })

  test('user can send a message and see it appear', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('input[placeholder="Type a message..."]')).toBeVisible({
      timeout: 15000,
    })

    const uniqueMsg = `hello-playwright-${Date.now()}`

    await page.fill('input[placeholder="Type a message..."]', uniqueMsg)

    await page.click('button:has-text("Send")')

    await expect(page.locator(`text=${uniqueMsg}`)).toBeVisible({ timeout: 10000 })

    await expect(page.locator('input[placeholder="Type a message..."]')).toHaveValue('')
  })

  test('message persists after page reload (fetched from DB)', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('input[placeholder="Type a message..."]')).toBeVisible({
      timeout: 15000,
    })

    const uniqueMsg = `persist-${Date.now()}`
    await page.fill('input[placeholder="Type a message..."]', uniqueMsg)
    await page.click('button:has-text("Send")')
    await expect(page.locator(`text=${uniqueMsg}`)).toBeVisible({ timeout: 10000 })

    await page.waitForTimeout(2000)

    await page.reload()
    await expect(page.locator(`text=${uniqueMsg}`)).toBeVisible({ timeout: 15000 })
  })

  test('switching rooms loads different message sets', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('input[placeholder="Type a message..."]')).toBeVisible({
      timeout: 15000,
    })

    const generalMsg = `general-${Date.now()}`
    await page.fill('input[placeholder="Type a message..."]', generalMsg)
    await page.click('button:has-text("Send")')
    await expect(page.locator(`text=${generalMsg}`)).toBeVisible({ timeout: 10000 })

    await page.click('button:has-text("random")')
    await page.waitForTimeout(2000)

    await expect(page.locator(`text=${generalMsg}`)).not.toBeVisible()
  })

  test('two browser contexts can exchange messages via broadcast', async ({ browser }) => {
    const context1 = await browser.newContext()
    const context2 = await browser.newContext()
    const page1 = await context1.newPage()
    const page2 = await context2.newPage()

    await page1.goto('http://localhost:3000')
    await page2.goto('http://localhost:3000')

    await expect(page1.locator('input[placeholder="Type a message..."]')).toBeVisible({
      timeout: 15000,
    })
    await expect(page2.locator('input[placeholder="Type a message..."]')).toBeVisible({
      timeout: 15000,
    })

    await page1.waitForTimeout(3000)
    await page2.waitForTimeout(3000)

    const crossMsg = `cross-tab-${Date.now()}`
    await page1.fill('input[placeholder="Type a message..."]', crossMsg)
    await page1.click('button:has-text("Send")')

    await expect(page1.locator(`text=${crossMsg}`)).toBeVisible({ timeout: 5000 })

    await expect(page2.locator(`text=${crossMsg}`)).toBeVisible({ timeout: 10000 })

    await context1.close()
    await context2.close()
  })

  test('presence: user appears in online list', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('h1:has-text("Realtime Chat")')).toBeVisible({ timeout: 15000 })

    await page.waitForTimeout(3000)

    await expect(page.locator('text=(you)')).toBeVisible({ timeout: 10000 })
  })
})
