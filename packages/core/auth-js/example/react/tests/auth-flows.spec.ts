import { test, expect } from '@playwright/test'
import { waitForEmail, purgeAllMail, extractMagicLink } from './helpers'

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
    await expect(page.locator('button:has-text("Sign out")')).not.toBeVisible({ timeout: 5000 })
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

    await purgeAllMail()

    await page.goto('/')

    await page.fill('#email', email)
    await page.fill('#password', '')

    await page.click('button:has-text("Send magic link")')

    // Wait for the OTP request to complete (success or error)
    const statusEl = page.locator('[data-testid="magic-link-status"]')
    await expect(statusEl).toBeVisible({ timeout: 15000 })
    const statusText = await statusEl.textContent()
    expect(statusText).not.toContain('error:')

    const emailData = await waitForEmail(email)
    expect(emailData).not.toBeNull()

    const magicLink = extractMagicLink(emailData.Text)
    expect(magicLink).not.toBeNull()

    // Navigate to GoTrue verify URL, redirecting back to the app
    const verifyUrl = magicLink!.replace(/redirect_to=[^&\s]+/, 'redirect_to=http://localhost:5173')
    await page.goto(verifyUrl)

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
