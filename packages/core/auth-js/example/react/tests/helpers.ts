const MAILPIT_URL = 'http://127.0.0.1:54324'

/**
 * Fetch the latest email from Mailpit for a given address.
 * Mailpit ships with Supabase CLI — captures all emails locally.
 */
export async function getLatestEmail(emailAddress: string) {
  const res = await fetch(
    `${MAILPIT_URL}/api/v1/search?query=to:${encodeURIComponent(emailAddress)}&limit=1`
  )
  if (!res.ok) return null
  const data = await res.json()
  if (!data.messages?.length) return null
  const latest = data.messages[0]
  const detail = await fetch(`${MAILPIT_URL}/api/v1/message/${latest.ID}`)
  if (!detail.ok) return null
  return detail.json()
}

/**
 * Clears ALL messages in Mailpit. Call before tests that assert on specific emails.
 * Note: this is global, not per-address — fine for isolated CI environments.
 */
export async function purgeAllMail() {
  await fetch(`${MAILPIT_URL}/api/v1/messages`, { method: 'DELETE' })
}

/**
 * Poll Mailpit until an email arrives for the given address, then return it.
 * Returns null if no email arrives within the timeout.
 */
export async function waitForEmail(emailAddress: string, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const email = await getLatestEmail(emailAddress)
    if (email) return email
    await new Promise((r) => setTimeout(r, 1_000))
  }
  return null
}

/**
 * Extract the GoTrue magic link verify URL from the email body text.
 */
export function extractMagicLink(emailBodyText: string): string | null {
  const match = emailBodyText.match(/https?:\/\/\S+\/auth\/v1\/verify\?\S+/)
  return match ? match[0].replace(/[)\s].*$/, '') : null
}
