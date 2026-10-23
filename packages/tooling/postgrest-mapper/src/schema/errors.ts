export type SchemaErrorCode =
  | 'exec'
  | 'dump'
  | 'config'
  | 'database'
  | 'supabase'
  | 'snapshot-missing'
  | 'snapshot-invalid'
  | 'snapshot-io'

/** Every failure of this module. The message is already scrubbed of credentials; no raw cause is attached. */
export class SchemaAcquisitionError extends Error {
  readonly code: SchemaErrorCode

  constructor(code: SchemaErrorCode, message: string) {
    super(message)
    this.name = 'SchemaAcquisitionError'
    this.code = code
  }
}

export function messageOf(error: unknown): string {
  if (error instanceof Error) return error.message
  return typeof error === 'string' ? error : JSON.stringify(error)
}
