import type { GeneratorDeps, GeneratorFs } from '../generate'

/** Where the CLI writes. `process.stdout` and `process.stderr` fit. */
export interface CliOutput {
  write(chunk: string): unknown
}

export interface CliFs extends GeneratorFs {
  /** Removes a file or directory; a missing path is not an error */
  rm(path: string): Promise<void>
}

export interface WatchHandle {
  close(): void
}

/** Watches a directory (not recursively); `filename` is relative to it, or null when the platform does not say. */
export type WatchFn = (directory: string, onEvent: (filename: string | null) => void) => WatchHandle

export interface CliOptions {
  stdout: CliOutput
  stderr: CliOutput
  /** Defaults to `node:fs`. */
  fs?: CliFs
  /** Defaults to `process.env`. */
  env?: Record<string, string | undefined>
  /** Defaults to `process.cwd()`. */
  cwd?: string
  /** Handed to the library's generator (planner wasm, host and tracer factories, schema `exec` and `connect`). */
  deps?: Omit<GeneratorDeps, 'fs' | 'env' | 'cwd' | 'logger'>
  /** Ends `generate --watch` (the executable wires SIGINT to it). */
  signal?: AbortSignal
  /** Defaults to `fs.watch`. */
  watch?: WatchFn
  /** Quiet time before `--watch` regenerates. Defaults to 100. */
  debounceMs?: number
  /** Printed by `--version`. */
  version?: string
}

/** What a command runs with: `CliOptions` with the defaults filled in. */
export interface CliContext {
  stdout: CliOutput
  stderr: CliOutput
  fs: CliFs
  env: Record<string, string | undefined>
  cwd: string
  deps: NonNullable<CliOptions['deps']>
  signal?: AbortSignal
  watch: WatchFn
  debounceMs: number
}

export interface Flags {
  project?: string
  out?: string
  check: boolean
  watch: boolean
  schemaSource?: 'supabase-local' | 'postgrest' | 'snapshot'
  snapshot?: string
  dbUrlEnv?: string
  workdir?: string
  projectId?: string
  supabaseCommand?: string
  image?: string
  network?: string
}
