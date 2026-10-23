import type { GeneratorDeps } from '../generate'
import type { MtimeFn, OperationFs, WatchFn, WatchHandle } from '../operations'

/** Where the CLI writes. `process.stdout` and `process.stderr` fit. */
export interface CliOutput {
  write(chunk: string): unknown
}

/** The file system the commands use: the operations' own. */
export type CliFs = OperationFs

export type { MtimeFn, WatchFn, WatchHandle }

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
  /** Defaults to `fs.stat`. `--watch` uses it to catch edits made while a generation was running. */
  mtime?: MtimeFn
  /** Quiet time before `--watch` regenerates. Defaults to 100. */
  debounceMs?: number
  /** Printed by `--version`. */
  version?: string
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
