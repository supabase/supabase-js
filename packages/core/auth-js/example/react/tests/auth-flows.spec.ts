import { test, expect } from '@playwright/test'
import { getLatestEmail, purgeMailbox, extractTokenHash } from './helpers'

test.describe('Auth E2E Flows', () => {
  test('email + password sign-up creates a session', async ({ page }) => {
    const email = `signup-${Date.now()}@test.com`
    const password = 'TestPassword123!'

    await page.goto('/')

    await expect(page.locator('pre')).toContainText('None')

    await page.fill('#email', email)
    await page.fill('#password', password)

    await page.click('button:has-text("Sign Up")')

    await expect(page.locator('button:has-text("Sign out")')).toBeVisible({ timeout: 10000 })
    await expect(page.locator('pre')).not.toContainText('None')
  })

  test('email + password sign-in works for existing user', async ({ page }) => {
    const email = `signin-${Date.now()}@test.com`
    const password = 'TestPassword123!'

    await page.goto('/')
    await page.fill('#email', email)
    await page.fill('#password', password)
    await page.click('button:has-text("Sign Up")')
    await expect(page.locator('button:has-text("Sign out")')).toBeVisible({ timeout: 10000 })

    await page.click('button:has-text("Sign out")')
    await expect(page.locator('pre')).toContainText('None', { timeout: 5000 })

    await page.fill('#email', email)
    await page.fill('#password', password)

    await page.click('button:has-text("Sign in")')
    await expect(page.locator('button:has-text("Sign out")')).toBeVisible({ timeout: 10000 })
  })

  test('sign-out clears the session', async ({ page }) => {
    const email = `signout-${Date.now()}@test.com`
    const password = 'TestPassword123!'

    await page.goto('/')
    await page.fill('#email', email)
    await page.fill('#password', password)
    await page.click('button:has-text("Sign Up")')
    await expect(page.locator('button:has-text("Sign out")')).toBeVisible({ timeout: 10000 })

    await page.click('button:has-text("Sign out")')

    await expect(page.locator('pre')).toContainText('None', { timeout: 5000 })
    await expect(page.locator('button:has-text("Sign out")')).not.toBeVisible()
  })

  test('anonymous sign-in creates a session', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('pre')).toContainText('None')

    await page.click('button:has-text("Sign In Anonymously")')

    await expect(page.locator('button:has-text("Sign out")')).toBeVisible({ timeout: 10000 })
    await expect(page.locator('pre')).not.toContainText('None')
  })

  test('magic link flow via Inbucket', async ({ page }) => {
    const email = `magic-${Date.now()}@test.com`

    await purgeMailbox(email)

    await page.goto('/')

    await page.fill('#email', email)
    await page.fill('#password', '')

    await page.click('button:has-text("Send magic link")')

    let emailData = null
    for (let i = 0; i < 10; i++) {
      await page.waitForTimeout(1000)
      emailData = await getLatestEmail(email)
      if (emailData) break
    }
    expect(emailData).not.toBeNull()

    const tokenHash = extractTokenHash(emailData.body.text)
    expect(tokenHash).not.toBeNull()

    await page.goto(`/?token_hash=${tokenHash}&type=magiclink`)

    await expect(page.locator('button:has-text("Sign out")')).toBeVisible({ timeout: 15000 })
  })

  test('session persists across page reload', async ({ page }) => {
    const email = `persist-${Date.now()}@test.com`
    const password = 'TestPassword123!'

    await page.goto('/')
    await page.fill('#email', email)
    await page.fill('#password', password)
    await page.click('button:has-text("Sign Up")')
    await expect(page.locator('button:has-text("Sign out")')).toBeVisible({ timeout: 10000 })

    await page.reload()

    await expect(page.locator('button:has-text("Sign out")')).toBeVisible({ timeout: 10000 })
    await expect(page.locator('pre')).not.toContainText('None')
  })
})
