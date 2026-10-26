/** Credential scrubbing for every message that leaves this module (errors and logs). */

const MASK = '***'

/** `scheme://user:password@host`, whatever the scheme. */
const URL_USERINFO = /([a-z][a-z0-9+.-]*:\/\/[^\s/@:?#]*):[^\s/@]*@/gi

/** `PGPASSWORD=x`, `password=x`, `password: "x"`, `PGRST_DB_URI=...`, `jwt-secret = "..."`. */
const KEYED_SECRET =
  /\b((?:PGPASSWORD|PGRST_[A-Z0-9_]*|password|passwd|pwd|[a-z-]*secret|[a-z-]*token|db-uri)\s*[=:]\s*)("(?:[^"\\]|\\.)*"|'[^']*'|[^\s,;]+)/gi

/** A literal secret shorter than this is only masked inside URLs and `key=value` pairs: bare, it would shred the text. */
const MIN_LITERAL = 3

/** Returns a function that masks credentials in a message, plus every literal secret it is told about. */
export function createScrubber(
  secrets: Iterable<string | undefined> = []
): (text: string) => string {
  const literals = new Set<string>()
  for (const secret of secrets) {
    if (!secret) continue
    literals.add(secret)
    try {
      literals.add(decodeURIComponent(secret))
    } catch {
      // not percent-encoded
    }
    literals.add(encodeURIComponent(secret))
  }
  const ordered = [...literals]
    .filter((l) => l.length >= MIN_LITERAL)
    .sort((a, b) => b.length - a.length)
  return (text) => {
    let out = text.replace(URL_USERINFO, `$1:${MASK}@`).replace(KEYED_SECRET, `$1${MASK}`)
    for (const secret of ordered) out = out.split(secret).join(MASK)
    return out
  }
}

/** The password of a connection URL, when it has one. Never throws. */
export function urlPassword(url: string): string | undefined {
  try {
    const password = new URL(url).password
    return password ? decodeURIComponent(password) : undefined
  } catch {
    return /:\/\/[^:@/]*:([^@/]*)@/.exec(url)?.[1]
  }
}
