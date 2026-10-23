import { rm } from 'node:fs/promises'
import {
  nodeGeneratorFs,
  type CacheOutcome,
  type GeneratorDeps,
  type GeneratorFs,
} from '../generate'

/** The file system the operations read and write: the generator's, plus removal. */
export interface OperationFs extends GeneratorFs {
  /** Removes a file or directory; a missing path is not an error */
  rm(path: string): Promise<void>
}

export const nodeOperationFs: OperationFs = {
  ...nodeGeneratorFs,
  rm: (path) => rm(path, { recursive: true, force: true }),
}

/**
 * Everything an operation touches outside itself. Every field has a production default: `node:fs`, `process.env`,
 * `process.cwd()`, the real planner, schema sources, clock and watcher. The generator's own dependencies
 * (`wasmPath`, `createHost`, `schema` with its `timeoutMs`, ...) are passed through.
 */
export interface OperationDeps extends Omit<GeneratorDeps, 'fs'> {
  fs?: OperationFs
}

/** `OperationDeps` with the defaults every operation needs filled in. */
export interface ResolvedDeps extends OperationDeps {
  fs: OperationFs
  env: Record<string, string | undefined>
  cwd: string
}

export const resolveDeps = (deps: OperationDeps = {}): ResolvedDeps => ({
  ...deps,
  fs: deps.fs ?? nodeOperationFs,
  env: deps.env ?? process.env,
  cwd: deps.cwd ?? process.cwd(),
})

export type OperationErrorCode =
  | 'config-unreadable'
  | 'config-invalid'
  | 'no-mapper-entry'
  | 'edit-failed'
  | 'planner-unavailable'
  | 'invalid-input'

/** A problem with the project's configuration, for the caller to show. Everything else is a bug or an I/O failure. */
export class OperationError extends Error {
  constructor(
    readonly code: OperationErrorCode,
    message: string
  ) {
    super(message)
  }
}

/** Replaces the `schema` option the tsconfig holds, for this run only. */
export interface SchemaOverrides {
  schemaSource?: 'supabase-local' | 'postgrest' | 'snapshot'
  /** Snapshot file, relative to `cwd` (implies `schemaSource: 'snapshot'`) */
  snapshot?: string
  /** Environment variable holding the database URL (postgrest source) */
  dbUrlEnv?: string
}

/** Which project an operation works on. */
export interface ProjectInput extends SchemaOverrides {
  /** The tsconfig, absolute or relative to `cwd`. Defaults to `tsconfig.json` */
  project?: string
}

/** A diagnostic placed in a file: option diagnostics at the value in the tsconfig, the others at 1:1. */
export interface LocatedDiagnostic {
  /** Absolute path */
  file: string
  /** 1-based */
  line: number
  /** 1-based */
  column: number
  code: number
  message: string
}

export interface GenerateResult {
  /** No diagnostic: the text is complete */
  ok: boolean
  /** Absolute path of the tsconfig */
  configFileName: string
  /** The declarations; an empty module when `ok` is false */
  text: string
  diagnostics: LocatedDiagnostic[]
  /** Problems that do not stop the module (releases of another patch, selects left out, ...) */
  warnings: string[]
  /** Absolute paths the text depends on, the tsconfig included */
  watchedFiles: string[]
  cache: CacheOutcome
  /** Fingerprint of everything that can change `text` */
  identity: string
}

export interface WatchHandle {
  close(): void
}

/** Watches a directory (not recursively); `filename` is relative to it, or null when the platform does not say. */
export type WatchFn = (directory: string, onEvent: (filename: string | null) => void) => WatchHandle

/** Last modification time of a file in milliseconds since the epoch, or undefined when it cannot be read. */
export type MtimeFn = (path: string) => Promise<number | undefined>

/** Time, as `watch` reads it. */
export interface Clock {
  now(): number
  setTimeout(run: () => void, ms: number): unknown
  clearTimeout(handle: unknown): void
}
