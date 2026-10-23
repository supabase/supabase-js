import {
  DEFAULT_LOAD_TIMEOUT_MS,
  DEFAULT_PLAN_TIMEOUT_MS,
  HOST_ERROR,
  createPlannerHost,
  startPlannerWorker,
  type AcquiredSchema,
  type PlannerHost,
  type WorkerLike,
  type WorkerRequest,
} from '../src'
import { acquireFromStack, plannerWasmPath } from './support/acquired'

/**
 * The planner host against the real planner (a worker thread running the wasm) loaded with the schema of the
 * running postgrest-js test stack. Hangs and crashes are staged by wrapping the real worker, so every path
 * (timeout, restart, reload) runs the production code.
 */
const USERS = { method: 'GET', url: '/users?select=*', headers: { 'Accept-Profile': 'public' } }

interface Control {
  /** Operations the wrapped worker swallows, as if the planner hung */
  hang: Set<WorkerRequest['op']>
  /** Every request that reached the wrapper, in order */
  seen: WorkerRequest[]
  workers: WorkerLike[]
}

/** A host over real workers that the test can make hang or kill. */
function stagedHost(options: { loadTimeoutMs?: number; planTimeoutMs?: number } = {}): {
  host: PlannerHost
  control: Control
} {
  const control: Control = { hang: new Set(), seen: [], workers: [] }
  const host = createPlannerHost({
    ...options,
    createWorker: () => {
      const real = startPlannerWorker(plannerWasmPath())
      control.workers.push(real)
      const wrapped: WorkerLike = {
        postMessage(message) {
          control.seen.push(message)
          if (!control.hang.has(message.op)) real.postMessage(message)
        },
        terminate: () => real.terminate(),
        on: (event: string, listener: never) =>
          (real.on as (e: string, l: never) => unknown)(event, listener),
      }
      return wrapped
    },
  })
  return { host, control }
}

describe('planner host over the real planner', () => {
  let acquired: AcquiredSchema
  const open: PlannerHost[] = []
  const track = <T extends { host: PlannerHost }>(staged: T): T => {
    open.push(staged.host)
    return staged
  }

  beforeAll(async () => {
    acquired = await acquireFromStack()
  }, 120_000)
  afterEach(async () => {
    await Promise.all(open.splice(0).map((host) => host.close()))
  })

  test('the documented budgets are the defaults', () => {
    expect(DEFAULT_LOAD_TIMEOUT_MS).toBe(20_000)
    expect(DEFAULT_PLAN_TIMEOUT_MS).toBe(2_000)
  })

  test('loads the acquired schema and plans select=* with its output shape', async () => {
    const { host } = track(stagedHost())
    const loaded = await host.load(acquired)
    expect(loaded.ok).toBe(true)
    const [users, channels, missing] = await host.planMany([
      USERS,
      { ...USERS, url: '/channels?select=*' },
      { ...USERS, url: '/does_not_exist?select=*' },
    ])
    expect(users).toMatchObject({ ok: true })
    const names = (users as { shape: { fields: { name: string }[] } }).shape.fields.map(
      (f) => f.name
    )
    expect(names).toEqual(expect.arrayContaining(['username', 'status', 'data']))
    expect(channels).toMatchObject({ ok: true })
    // a planner failure is a value carrying the planner's own code
    expect(missing).toMatchObject({ ok: false, error: { code: 'PGRST205' } })
  }, 60_000)

  test('a plan that hangs times out, the worker is replaced and the cache reloads into the new one', async () => {
    const { host, control } = track(stagedHost({ planTimeoutMs: 200 }))
    expect((await host.load(acquired)).ok).toBe(true)
    expect(await host.plan(USERS)).toMatchObject({ ok: true })
    expect(control.workers).toHaveLength(1)

    control.hang.add('plan')
    const started = Date.now()
    const timedOut = await host.plan(USERS)
    expect(timedOut).toMatchObject({ ok: false, error: { code: HOST_ERROR.timeout } })
    expect(Date.now() - started).toBeLessThan(5_000)

    control.hang.clear()
    const loadsBefore = control.seen.filter((m) => m.op === 'load').length
    const recovered = await host.plan(USERS)
    expect(recovered).toMatchObject({ ok: true })
    // a second worker came up and was repopulated from the inputs the host kept, without a new `load` call
    expect(control.workers).toHaveLength(2)
    expect(control.seen.filter((m) => m.op === 'load').length).toBe(loadsBefore + 1)
  }, 60_000)

  test('a load that hangs times out as a value, and the next load succeeds on a fresh worker', async () => {
    const { host, control } = track(stagedHost({ loadTimeoutMs: 200 }))
    control.hang.add('load')
    expect(await host.load(acquired)).toMatchObject({
      ok: false,
      error: { code: HOST_ERROR.timeout },
    })
    // nothing is loaded after a failed load
    expect(await host.plan(USERS)).toMatchObject({
      ok: false,
      error: { code: HOST_ERROR.notLoaded },
    })

    control.hang.clear()
    expect((await host.load(acquired)).ok).toBe(true)
    expect(control.workers).toHaveLength(2)
    expect(await host.plan(USERS)).toMatchObject({ ok: true })
  }, 60_000)

  test('a worker that dies is reported as a value and replaced by the next call', async () => {
    const { host, control } = track(stagedHost({ planTimeoutMs: 10_000 }))
    expect((await host.load(acquired)).ok).toBe(true)

    control.hang.add('plan')
    const pending = host.plan(USERS)
    // the request is in flight when the worker dies
    await new Promise((resolve) => setTimeout(resolve, 100))
    await control.workers[0]!.terminate()
    expect(await pending).toMatchObject({ ok: false, error: { code: HOST_ERROR.workerFailed } })

    control.hang.clear()
    expect(await host.plan(USERS)).toMatchObject({ ok: true })
    expect(control.workers).toHaveLength(2)
  }, 60_000)

  test('an idle worker that dies is replaced without any failure being observed', async () => {
    const { host, control } = track(stagedHost())
    expect((await host.load(acquired)).ok).toBe(true)
    await control.workers[0]!.terminate()
    await new Promise((resolve) => setTimeout(resolve, 100))
    expect(await host.plan(USERS)).toMatchObject({ ok: true })
    expect(control.workers).toHaveLength(2)
  }, 60_000)

  test('a second load replaces the first cache', async () => {
    const { host } = track(stagedHost())
    expect((await host.load(acquired)).ok).toBe(true)
    expect((await host.load(acquired)).ok).toBe(true)
    expect(await host.plan(USERS)).toMatchObject({ ok: true })
  }, 60_000)

  test('load failures are values: a missing wasm, a worker that cannot start, a schema the planner rejects', async () => {
    const noWasm = track({
      host: createPlannerHost({ wasmPath: '/nonexistent/postgrest-planner.wasm' }),
    })
    expect(await noWasm.host.load(acquired)).toMatchObject({
      ok: false,
      error: { code: HOST_ERROR.workerFailed },
    })

    const noWorker = track({
      host: createPlannerHost({
        createWorker: () => {
          throw new Error('no threads here')
        },
      }),
    })
    const failed = await noWorker.host.load(acquired)
    expect(failed).toMatchObject({ ok: false, error: { code: HOST_ERROR.workerFailed } })
    expect(JSON.stringify(failed)).toContain('no threads here')

    const { host } = track(stagedHost())
    const rejected = await host.load({ ...acquired, dump: 'not json' })
    expect(rejected.ok).toBe(false)
    expect(await host.plan(USERS)).toMatchObject({
      ok: false,
      error: { code: HOST_ERROR.notLoaded },
    })
  }, 60_000)

  test('plan before load and any call after close are failure values', async () => {
    const { host } = track(stagedHost())
    expect(await host.plan(USERS)).toMatchObject({
      ok: false,
      error: { code: HOST_ERROR.notLoaded },
    })
    await host.close()
    expect(await host.load(acquired)).toMatchObject({
      ok: false,
      error: { code: HOST_ERROR.closed },
    })
    expect(await host.plan(USERS)).toMatchObject({ ok: false, error: { code: HOST_ERROR.closed } })
  }, 60_000)
})
