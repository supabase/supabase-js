export type SchemaErrorCode =
  | 'exec'
  | 'dump'
  | 'config'
  | 'database'
  | 'timeout'
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

/** What `ExecFn` rejects with when it killed the child process because `ExecOptions.timeoutMs` ran out. */
export class ExecTimeoutError extends Error {
  constructor(readonly timeoutMs: number) {
    super(`timed out after ${timeoutMs} ms`)
    this.name = 'ExecTimeoutError'
  }
}

export function timeoutError(what: string, timeoutMs: number): SchemaAcquisitionError {
  return new SchemaAcquisitionError('timeout', `${what} did not finish within ${timeoutMs} ms`)
}

export function messageOf(error: unknown): string {
  if (error instanceof Error) return error.message
  return typeof error === 'string' ? error : JSON.stringify(error)
}
