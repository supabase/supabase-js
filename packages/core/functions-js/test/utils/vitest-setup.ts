// Setup file for Vitest
// Re-export utilities for backward compatibility with Jest tests
export function attach(name: string, content: string | Buffer, type: any): void {
  // Placeholder for future implementation
}

export function log(name: string, description?: string): void {
  console.info(description ? `${name}: ${description}` : name)
}
