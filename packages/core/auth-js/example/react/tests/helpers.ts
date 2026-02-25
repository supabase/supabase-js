const INBUCKET_URL = 'http://127.0.0.1:54324'

/**
 * Fetch the latest email from Inbucket for a given mailbox.
 * Inbucket ships with Supabase CLI — captures all emails locally.
 * Mailbox = the part before @ in the email address.
 */
export async function getLatestEmail(emailAddress: string) {
  const mailbox = emailAddress.split('@')[0]
  const res = await fetch(`${INBUCKET_URL}/api/v1/mailbox/${mailbox}`)
  const messages = await res.json()
  if (!messages.length) return null
  const latest = messages[messages.length - 1]
  const detail = await fetch(`${INBUCKET_URL}/api/v1/mailbox/${mailbox}/${latest.id}`)
  return detail.json()
}

/**
 * Purge all emails in a mailbox (call before tests that check for specific emails).
 */
export async function purgeMailbox(emailAddress: string) {
  const mailbox = emailAddress.split('@')[0]
  await fetch(`${INBUCKET_URL}/api/v1/mailbox/${mailbox}`, {
    method: 'DELETE',
  })
}

/**
 * Extract the token_hash from a Supabase auth email body.
 * The CLI sends emails with a link containing token_hash=<hash>&type=<type>.
 */
export function extractTokenHash(emailBodyText: string): string | null {
  const match = emailBodyText.match(/token_hash=([a-zA-Z0-9_-]+)/)
  return match ? match[1] : null
}
