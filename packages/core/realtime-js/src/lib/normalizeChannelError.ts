/**
 * Normalize the various shapes a channel error reason can take into a real `Error`.
 *
 * Transport-level channel errors arrive as a `CloseEvent`, a transport `Event`, an `Error`,
 * a string, or `undefined` depending on which path in the underlying socket fired. Server-reply
 * errors arrive as a payload object. This helper produces a consistent `Error` for every case
 * and preserves the original via `cause` so callers can still inspect the raw event.
 */
export function normalizeChannelError(reason: unknown): Error {
  if (reason instanceof Error) {
    return reason
  }

  if (typeof reason === 'string') {
    return new Error(reason)
  }

  if (reason && typeof reason === 'object') {
    const obj = reason as Record<string, unknown>

    if (typeof obj.code === 'number') {
      const detail = typeof obj.reason === 'string' && obj.reason ? ` (${obj.reason})` : ''
      return new Error(`socket closed: ${obj.code}${detail}`, { cause: reason })
    }

    return new Error('channel error: transport failure', { cause: reason })
  }

  return new Error('channel error: connection lost')
}
