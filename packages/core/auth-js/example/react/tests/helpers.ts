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
 * Purge all emails in Mailpit (call before tests that check for specific emails).
 */
export async function purgeMailbox(_emailAddress: string) {
  await fetch(`${MAILPIT_URL}/api/v1/messages`, { method: 'DELETE' })
}

/**
 * Extract the GoTrue magic link verify URL from the email body text.
 */
export function extractMagicLink(emailBodyText: string): string | null {
  const match = emailBodyText.match(/https?:\/\/\S+\/auth\/v1\/verify\?\S+/)
  return match ? match[0].replace(/[)\s].*$/, '') : null
}
