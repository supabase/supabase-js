import { Worker } from 'node:worker_threads'
import type { LoadSuccess, PlannerError } from '@supabase/postgrest-planner'
import type { AcquiredSchema } from '../schema'
import { PLANNER_ABI } from './compat'
import { WORKER_SOURCE } from './worker-source'
import {
  HOST_ERROR,
  type InfoResult,
  type LoadResult,
  type PlanRequest,
  type PlanResult,
  type PlannerHost,
  type PlannerHostOptions,
  type WorkerLike,
  type WorkerRequest,
  type WorkerResponse,
} from './types'

export const DEFAULT_LOAD_TIMEOUT_MS = 20_000
export const DEFAULT_PLAN_TIMEOUT_MS = 2_000

/** Failure value of the host itself, shaped like the planner's. */
function failure(code: string, message: string): PlannerError {
  return { ok: false, error: { code, message } }
}

type Outcome =
  | { kind: 'response'; response: WorkerResponse }
  | { kind: 'failed'; error: PlannerError }

/** The default worker: a `worker_threads` worker that runs the planner (resolved lazily, once a worker starts). */
export function startPlannerWorker(wasmPath: string | undefined): WorkerLike {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const plannerModule = require.resolve('@supabase/postgrest-planner')
  return new Worker(WORKER_SOURCE, {
    eval: true,
    workerData: { plannerModule, wasmPath, abi: PLANNER_ABI },
  }) as unknown as WorkerLike
}

/**
 * Runs the planner (a wasm Haskell runtime: it can neither be interrupted nor given a deadline) in a worker thread so
 * that a call that hangs costs one worker, not the process (design v3 §4.3).
 *
 * Calls are serialised, one in flight at a time. On a timeout the worker is terminated and a new one starts with the
 * next call; the cache is reloaded from the inputs kept in memory, inside that call and with the load budget. Every
 * failure comes back as a `PlannerError`-shaped value: the host's own use `HOST_ERROR` codes.
 */
export function createPlannerHost(options: PlannerHostOptions = {}): PlannerHost {
  const loadTimeoutMs = options.loadTimeoutMs ?? DEFAULT_LOAD_TIMEOUT_MS
  const planTimeoutMs = options.planTimeoutMs ?? DEFAULT_PLAN_TIMEOUT_MS
  const logger = options.logger
  const createWorker = options.createWorker ?? (() => startPlannerWorker(options.wasmPath))

  let closed = false
  let worker: WorkerLike | undefined
  /** The call awaiting the current worker's answer (calls are serialised, so there is at most one) */
  let pending: { id: number; finish: (outcome: Outcome, killReason?: string) => void } | undefined
  let nextId = 1
  /** The load inputs, kept to repopulate a restarted worker */
  let input: Extract<WorkerRequest, { op: 'load' }>['input'] | undefined
  /** Handle of `input` in the current worker */
  let handle: number | undefined
  /** The build of the wasm: the same for every worker of this host */
  let plannerInfo: InfoResult | undefined
  let tail: Promise<unknown> = Promise.resolve()

  const kill = (reason: string): void => {
    const dead = worker
    worker = undefined
    handle = undefined
    pending = undefined
    if (dead) {
      logger?.warn(`planner worker terminated: ${reason}`)
      void Promise.resolve(dead.terminate()).catch(() => undefined)
    }
  }

  /** Starts a worker and routes everything it says to the pending call. */
  const start = (): WorkerLike => {
    const fresh = createWorker()
    const lost = (message: string, killReason: string): void => {
      // Events of a worker that was already replaced say nothing about the current one
      if (worker !== fresh) return
      if (pending)
        pending.finish(
          { kind: 'failed', error: failure(HOST_ERROR.workerFailed, message) },
          killReason
        )
      else kill(killReason)
    }
    fresh.on('message', (response) => {
      if (worker === fresh && pending?.id === response.id)
        pending.finish({ kind: 'response', response })
    })
    fresh.on('error', (error) =>
      lost(`planner worker failed: ${error.message}`, `worker error: ${error.message}`)
    )
    fresh.on('exit', (code) =>
      lost(`planner worker exited with code ${code}`, `worker exit ${code}`)
    )
    return fresh
  }

  /** One request, one answer, within `timeoutMs`. Never rejects. */
  const call = (request: WorkerRequest, timeoutMs: number): Promise<Outcome> =>
    new Promise<Outcome>((resolve) => {
      let current: WorkerLike
      try {
        worker ??= start()
        current = worker
      } catch (error) {
        worker = undefined
        resolve({
          kind: 'failed',
          error: failure(
            HOST_ERROR.workerFailed,
            `could not start the planner worker: ${error instanceof Error ? error.message : String(error)}`
          ),
        })
        return
      }
      let settled = false
      const finish = (outcome: Outcome, killReason?: string): void => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        if (pending?.id === request.id) pending = undefined
        if (killReason !== undefined && worker === current) kill(killReason)
        resolve(outcome)
      }
      const timer = setTimeout(() => {
        finish(
          {
            kind: 'failed',
            error: failure(
              HOST_ERROR.timeout,
              `planner ${request.op} exceeded ${timeoutMs} ms; the worker was restarted`
            ),
          },
          `${request.op} timed out after ${timeoutMs} ms`
        )
      }, timeoutMs)
      pending = { id: request.id, finish }
      try {
        current.postMessage(request)
      } catch (error) {
        finish(
          {
            kind: 'failed',
            error: failure(
              HOST_ERROR.workerFailed,
              `could not reach the planner worker: ${error instanceof Error ? error.message : String(error)}`
            ),
          },
          'postMessage failed'
        )
      }
    })

  /** Sends a `load` of the kept inputs. */
  const loadInput = async (): Promise<LoadResult> => {
    if (!input) return failure(HOST_ERROR.notLoaded, 'plan called before load')
    const outcome = await call({ id: nextId++, op: 'load', input }, loadTimeoutMs)
    if (outcome.kind === 'failed') return outcome.error
    if (!outcome.response.ok) {
      // The planner could not run (missing wasm, trap): the worker's planner is discarded and rebuilt on the next call.
      kill(outcome.response.message)
      return failure(HOST_ERROR.workerFailed, outcome.response.message)
    }
    const result = outcome.response.result as LoadResult
    if (result.ok) handle = (result as LoadSuccess).handle
    return result
  }

  const serial = <T>(task: () => Promise<T>): Promise<T> => {
    const run = tail.then(task, task)
    tail = run.catch(() => undefined)
    return run
  }

  const plan = (request: PlanRequest): Promise<PlanResult> =>
    serial(async () => {
      if (closed) return failure(HOST_ERROR.closed, 'planner host is closed')
      if (!input) return failure(HOST_ERROR.notLoaded, 'plan called before a successful load')
      if (handle === undefined) {
        logger?.debug('reloading the schema cache into a fresh planner worker')
        const reloaded = await loadInput()
        if (!reloaded.ok) return reloaded
      }
      const outcome = await call(
        { id: nextId++, op: 'plan', handle: handle as number, request },
        planTimeoutMs
      )
      if (outcome.kind === 'failed') return outcome.error
      if (!outcome.response.ok) {
        kill(outcome.response.message)
        return failure(HOST_ERROR.workerFailed, outcome.response.message)
      }
      return outcome.response.result as PlanResult
    })

  return {
    info(): Promise<InfoResult> {
      return serial(async () => {
        if (closed) return failure(HOST_ERROR.closed, 'planner host is closed')
        if (plannerInfo?.ok) return plannerInfo
        const outcome = await call({ id: nextId++, op: 'info' }, loadTimeoutMs)
        if (outcome.kind === 'failed') return outcome.error
        if (!outcome.response.ok) {
          kill(outcome.response.message)
          return failure(HOST_ERROR.workerFailed, outcome.response.message)
        }
        const result = outcome.response.result as InfoResult
        if (result.ok) plannerInfo = result
        return result
      })
    },

    load(acquired: AcquiredSchema): Promise<LoadResult> {
      return serial(async () => {
        if (closed) return failure(HOST_ERROR.closed, 'planner host is closed')
        const previous = handle
        if (previous !== undefined && worker) {
          // Best effort: the cache is replaced either way
          await call({ id: nextId++, op: 'free', handle: previous }, planTimeoutMs)
        }
        handle = undefined
        input = {
          config: acquired.config,
          schema: acquired.dump,
          supplementary: JSON.stringify(acquired.supplementary),
        }
        const result = await loadInput()
        if (!result.ok) {
          logger?.warn(`planner load failed: ${JSON.stringify(result.error)}`)
          input = undefined
        }
        return result
      })
    },

    plan,

    async planMany(requests: PlanRequest[]): Promise<PlanResult[]> {
      const results: PlanResult[] = []
      for (const request of requests) results.push(await plan(request))
      return results
    },
    close(): Promise<void> {
      return serial(async () => {
        closed = true
        input = undefined
        const dead = worker
        worker = undefined
        handle = undefined
        if (dead) await Promise.resolve(dead.terminate()).catch(() => undefined)
      })
    },
  }
}
