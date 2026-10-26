import type {
  LoadResult,
  PlanRequest,
  PlanResult,
  PlannerError,
  PlannerInfo,
} from '@supabase/postgrest-planner'
import type { AcquiredSchema } from '../schema'

export type { LoadResult, PlanRequest, PlanResult, PlannerInfo }

/** What the planner says about its own build, or why the host could not ask. */
export type InfoResult = PlannerInfo | PlannerError

export interface HostLogger {
  debug(message: string): void
  warn(message: string): void
}

/** `error.code` of the failure values the host itself produces (the planner's own codes pass through unchanged). */
export const HOST_ERROR = {
  /** A call exceeded its time budget; the worker was killed and will be restarted by the next call */
  timeout: 'HOST_TIMEOUT',
  /** The worker crashed, could not start, or the planner could not be instantiated (missing wasm, trap) */
  workerFailed: 'HOST_WORKER_FAILED',
  /** `plan` before a successful `load` */
  notLoaded: 'HOST_NOT_LOADED',
  /** A call after `close` */
  closed: 'HOST_CLOSED',
} as const

/** Whether a plan result is a failure of the host itself (a timeout, a dead worker) and not the planner's verdict. */
export function isHostFailure(result: PlanResult): boolean {
  return !result.ok && (Object.values(HOST_ERROR) as string[]).includes(String(result.error.code))
}

/** Request sent to the worker: one at a time, answered by one `WorkerResponse` with the same id. */
export type WorkerRequest =
  | {
      id: number
      op: 'load'
      input: { config: Record<string, unknown>; schema: string; supplementary: string }
    }
  | { id: number; op: 'plan'; handle: number; request: PlanRequest }
  | { id: number; op: 'free'; handle: number }
  | { id: number; op: 'info' }

export type WorkerResponse =
  | { id: number; ok: true; result: unknown }
  /** The planner could not run at all (it throws for host failures such as a missing wasm) */
  | { id: number; ok: false; message: string }

/** The slice of `worker_threads.Worker` the host uses. Tests inject fakes through `createWorker`. */
export interface WorkerLike {
  postMessage(message: WorkerRequest): void
  terminate(): Promise<unknown> | unknown
  on(event: 'message', listener: (message: WorkerResponse) => void): unknown
  on(event: 'error', listener: (error: Error) => void): unknown
  on(event: 'exit', listener: (code: number) => void): unknown
}

export interface PlannerHostOptions {
  /** Path to postgrest-planner.wasm. Defaults to the planner package's own copy. */
  wasmPath?: string
  /** Budget of one `load` (and of the implicit reload after a restart). Default 20000. */
  loadTimeoutMs?: number
  /** Budget of one `plan`. Default 2000. */
  planTimeoutMs?: number
  /** Defaults to silence. */
  logger?: HostLogger
  /** Starts a worker; defaults to a `worker_threads` worker running the planner. For tests. */
  createWorker?: () => WorkerLike
}

export interface PlannerHost {
  /**
   * The planner build (ABI, upstream release). Starts the worker if needed; a wasm that speaks another ABI than
   * `PLANNER_ABI` is a `HOST_WORKER_FAILED` failure here, as it is for `load` and `plan`. Failures are values.
   */
  info(): Promise<InfoResult>
  /**
   * Loads the schema cache from the acquired inputs (the whole supplementary document goes to the planner, which
   * ignores the keys it does not know). Replaces a previous load. A failure is a value, never a throw.
   */
  load(acquired: AcquiredSchema): Promise<LoadResult>
  /** Plans one request against the loaded cache. Failures, timeouts included, are values. */
  plan(request: PlanRequest): Promise<PlanResult>
  /** `plan` for each request, in order. Every request has its own time budget. */
  planMany(requests: PlanRequest[]): Promise<PlanResult[]>
  /** Terminates the worker. Later calls return `HOST_CLOSED` failures. */
  close(): Promise<void>
}
