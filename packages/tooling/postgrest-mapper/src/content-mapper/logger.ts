export interface ContentMapperLogger {
  /** Protocol traffic and timings. Dropped unless debugging is on. */
  debug(message: string): void
  error(message: string, error?: unknown): void
}

/** Environment variable that makes tsc capture the mapper's stderr and log the JSON-RPC traffic. */
export const DEBUG_ENV = 'TS_CONTENT_MAPPER_DEBUG'

/** Logs to a stream (stderr in the executable). `debug` is silent unless `TS_CONTENT_MAPPER_DEBUG` is set. */
export function createStreamLogger(
  stream: { write(chunk: string): unknown },
  env: Record<string, string | undefined>
): ContentMapperLogger {
  const verbose = env[DEBUG_ENV] !== undefined && env[DEBUG_ENV] !== ''
  const line = (level: string, message: string) =>
    stream.write(`[postgrest-mapper] ${level} ${message}\n`)
  return {
    debug: (message) => {
      if (verbose) line('debug', message)
    },
    error: (message, error) => {
      const detail = error instanceof Error ? (error.stack ?? error.message) : error
      line('error', detail === undefined ? message : `${message}: ${String(detail)}`)
    },
  }
}
