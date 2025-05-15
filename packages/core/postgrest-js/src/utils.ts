export class HeaderManager {
  private headers: Map<string, Set<string>> = new Map()

  /**
   * Create a new HeaderManager, optionally parsing an existing header string
   * @param header The header name to manage
   * @param existingValue Optional existing header value to parse
   */
  constructor(private readonly header: string, existingValue?: string) {
    if (existingValue) {
      this.parseHeaderString(existingValue)
    }
  }

  /**
   * Parse an existing header string into the internal Set
   * @param headerString The header string to parse
   */
  private parseHeaderString(headerString: string): void {
    if (!headerString.trim()) return

    const values = headerString.split(',')
    values.forEach((value) => {
      const trimmedValue = value.trim()
      if (trimmedValue) {
        this.add(trimmedValue)
      }
    })
  }

  /**
   * Add a value to the header. If the header doesn't exist, it will be created.
   * @param value The value to add
   */
  add(value: string): void {
    if (!this.headers.has(this.header)) {
      this.headers.set(this.header, new Set())
    }
    this.headers.get(this.header)!.add(value)
  }

  /**
   * Get the formatted string value for the header
   */
  get(): string {
    const values = this.headers.get(this.header)
    return values ? Array.from(values).join(',') : ''
  }

  /**
   * Check if the header has a specific value
   * @param value The value to check
   */
  has(value: string): boolean {
    return this.headers.get(this.header)?.has(value) ?? false
  }

  /**
   * Clear all values for the header
   */
  clear(): void {
    this.headers.delete(this.header)
  }
}
