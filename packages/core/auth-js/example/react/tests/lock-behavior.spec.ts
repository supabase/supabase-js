import { test, expect } from '@playwright/test'

const STORAGE_KEY = 'supabase.auth.token'
const DEADLOCK_TIMEOUT_MS = 5000

/** Expire the stored session so the next getSession() triggers a token refresh. */
async function expireStoredSession(page: any) {
  await page.evaluate((key: string) => {
    const raw = localStorage.getItem(key)
    if (!raw) return
    const session = JSON.parse(raw)
    session.expires_at = Math.floor(Date.now() / 1000) - 10
    localStorage.setItem(key, JSON.stringify(session))
  }, STORAGE_KEY)
}

test.describe('Lock behavior', () => {
  test('concurrent getSession calls all resolve without deadlock', async ({ page }) => {
    const email = `concurrent-${Date.now()}@test.com`

    await page.goto('/')
    await page.fill('#email', email)
    await page.fill('#password', 'TestPassword123!')
    await page.click('button:has-text("Sign Up")')
    await expect(page.locator('button:has-text("Sign out")')).toBeVisible({ timeout: 10000 })

    // Fire 10 concurrent getSession calls — each races against a hard deadline.
    // With navigatorLock this would deadlock; with processLock all should resolve.
    const results: { error: string | null }[] = await page.evaluate(
      async ({ timeoutMs }: { timeoutMs: number }) => {
        const auth = (window as any).__auth__
        return Promise.all(
          Array.from({ length: 10 }, () =>
            Promise.race([
              auth.getSession().then((r: any) => ({ error: r.error?.message ?? null })),
              new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error('deadlock: getSession did not resolve')), timeoutMs)
              ),
            ])
          )
        )
      },
      { timeoutMs: DEADLOCK_TIMEOUT_MS }
    )

    expect(results).toHaveLength(10)
    for (const r of results) {
      expect(r.error).toBeNull()
    }
  })

  test('two tabs refreshing concurrently both remain authenticated', async ({ browser }) => {
    const context = await browser.newContext()
    const page1 = await context.newPage()
    const page2 = await context.newPage()

    try {
      // Sign in on tab 1
      await page1.goto('/')
      await page1.fill('#email', `multitab-${Date.now()}@test.com`)
      await page1.fill('#password', 'TestPassword123!')
      await page1.click('button:has-text("Sign Up")')
      await expect(page1.locator('button:has-text("Sign out")')).toBeVisible({ timeout: 10000 })

      // Tab 2 navigates — picks up the session from shared localStorage
      await page2.goto('/')
      await expect(page2.locator('button:has-text("Sign out")')).toBeVisible({ timeout: 5000 })

      // Expire the token so both tabs will hit /token?grant_type=refresh_token
      await expireStoredSession(page1)

      // Both tabs call getSession simultaneously — triggers a concurrent refresh
      const [r1, r2] = await Promise.all([
        page1.evaluate(async ({ timeoutMs }: { timeoutMs: number }) => {
          return Promise.race([
            (window as any).__auth__
              .getSession()
              .then((r: any) => ({ session: !!r.data?.session, error: r.error?.message ?? null })),
            new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error('deadlock: tab 1 getSession did not resolve')), timeoutMs)
            ),
          ])
        }, { timeoutMs: DEADLOCK_TIMEOUT_MS }),
        page2.evaluate(async ({ timeoutMs }: { timeoutMs: number }) => {
          return Promise.race([
            (window as any).__auth__
              .getSession()
              .then((r: any) => ({ session: !!r.data?.session, error: r.error?.message ?? null })),
            new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error('deadlock: tab 2 getSession did not resolve')), timeoutMs)
            ),
          ])
        }, { timeoutMs: DEADLOCK_TIMEOUT_MS }),
      ])

      expect(r1.error).toBeNull()
      expect(r2.error).toBeNull()
      expect(r1.session).toBe(true)
      expect(r2.session).toBe(true)
    } finally {
      await context.close()
    }
  })

  test('signOut during token refresh results in signed-out state', async ({ page }) => {
    await page.goto('/')
    await page.fill('#email', `signout-race-${Date.now()}@test.com`)
    await page.fill('#password', 'TestPassword123!')
    await page.click('button:has-text("Sign Up")')
    await expect(page.locator('button:has-text("Sign out")')).toBeVisible({ timeout: 10000 })

    // Expire the token so getSession() triggers a refresh, then fire both concurrently
    await expireStoredSession(page)

    await page.evaluate(async () => {
      const auth = (window as any).__auth__
      // getSession will attempt a refresh; signOut should win and clear the session
      await Promise.allSettled([auth.getSession(), auth.signOut()])
    })

    await expect(page.locator('pre')).toContainText('None', { timeout: 5000 })
  })
})
