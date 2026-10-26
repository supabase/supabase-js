const HEADER_END = Buffer.from('\r\n\r\n')

/**
 * Splits a byte stream into LSP-style frames: `Content-Length: <n>\r\n[other headers]\r\n\r\n<n bytes of UTF-8>`.
 * A header block without a usable `Content-Length` is dropped (reported through `onMalformed`) and parsing resumes
 * after it, so one bad frame cannot wedge the stream.
 */
export class FrameReader {
  private buffer: Buffer = Buffer.alloc(0)

  constructor(
    private readonly onFrame: (body: string) => void,
    private readonly onMalformed: (reason: string) => void
  ) {}

  push(chunk: Buffer | string): void {
    const bytes = typeof chunk === 'string' ? Buffer.from(chunk, 'utf8') : chunk
    this.buffer = this.buffer.length === 0 ? bytes : Buffer.concat([this.buffer, bytes])
    for (;;) {
      const headerEnd = this.buffer.indexOf(HEADER_END)
      if (headerEnd === -1) return
      const header = this.buffer.subarray(0, headerEnd).toString('ascii')
      const length = parseContentLength(header)
      if (length === undefined) {
        this.onMalformed(`frame header without a valid Content-Length: ${JSON.stringify(header)}`)
        this.buffer = this.buffer.subarray(headerEnd + HEADER_END.length)
        continue
      }
      const bodyStart = headerEnd + HEADER_END.length
      if (this.buffer.length < bodyStart + length) return
      const body = this.buffer.subarray(bodyStart, bodyStart + length).toString('utf8')
      this.buffer = this.buffer.subarray(bodyStart + length)
      this.onFrame(body)
    }
  }
}

function parseContentLength(header: string): number | undefined {
  for (const line of header.split('\r\n')) {
    const colon = line.indexOf(':')
    if (colon === -1 || line.slice(0, colon).trim().toLowerCase() !== 'content-length') continue
    const value = line.slice(colon + 1).trim()
    return /^\d+$/.test(value) ? Number(value) : undefined
  }
  return undefined
}

/** One outgoing frame. The length is in bytes, not characters. */
export function encodeFrame(message: unknown): Buffer {
  const body = Buffer.from(JSON.stringify(message), 'utf8')
  return Buffer.concat([Buffer.from(`Content-Length: ${body.length}\r\n\r\n`, 'ascii'), body])
}
