import { watchLoop } from '../src/operations/watch'
import type { WatchHandle } from '../src/cli'

const SRC = '/project/src'
const FILE = `${SRC}/app.ts`
const OUT = '/project/types/supabase.d.ts'

function deferred() {
  let resolve!: () => void
  const promise = new Promise<void>((r) => (resolve = r))
  return { promise, resolve }
}

/**
 * A watch loop over fakes. `run` may edit files while it runs, which is when no watch exists yet for them.
 * `idle` resolves once the loop has nothing left to do: the macrotask after the first watch is installed, by which
 * time every microtask-only follow-up of that cycle (a rerun included) has finished.
 */
function harness(
  onRun: (
    count: number,
    edit: (path: string) => void,
    abort: () => void
  ) => void | Promise<void> = () => {}
) {
  const controller = new AbortController()
  const idle = deferred()
  const mtimes = new Map<string, number>()
  const edit = (path: string) => mtimes.set(path, Date.now())
  const events = new Map<string, (filename: string | null) => void>()
  const log = { runs: 0, stats: [] as string[] }
  const finished = watchLoop({
    watch: (directory, onEvent): WatchHandle => {
      events.set(directory, onEvent)
      if (events.size === 1) setImmediate(() => idle.resolve())
      return { close: () => events.delete(directory) }
    },
    readdir: async () => {
      throw new Error('ENOTDIR')
    },
    mtime: async (path) => {
      log.stats.push(path)
      return mtimes.get(path)
    },
    debounceMs: 0,
    signal: controller.signal,
    ignore: OUT,
    run: async () => {
      await onRun(++log.runs, edit, () => controller.abort())
      return { files: [FILE], directories: [], entries: [] }
    },
  })
  return { controller, mtimes, events, log, finished, idle: idle.promise }
}

describe('watchLoop', () => {
  it('runs again when a dependency is edited after the run read it and before its directory is watched', async () => {
    const h = harness((count, edit) => {
      if (count === 1) edit(FILE) // saved while the first run is in flight: no event can come for it
    })
    await h.idle
    h.controller.abort()
    await h.finished
    expect(h.log.runs).toBe(2)
  })

  it('does not run again for a dependency that predates the run', async () => {
    const h = harness()
    h.mtimes.set(FILE, Date.now() - 60_000)
    await h.idle
    h.controller.abort()
    await h.finished
    expect(h.log.runs).toBe(1)
  })

  it('looks at the files of a directory once, when it starts watching it; later edits come as events', async () => {
    const third = deferred()
    const h = harness((count, edit) => {
      if (count === 1) edit(FILE)
      if (count === 3) third.resolve()
    })
    await h.idle
    expect(h.log.runs).toBe(2)
    h.events.get(SRC)!('app.ts')
    await third.promise
    h.controller.abort()
    await h.finished
    expect(h.log.runs).toBe(3)
    expect(h.log.stats).toEqual([FILE])
  })

  it('leaves no watch behind when a run outlives the abort', async () => {
    const h = harness(async (_count, _edit, abort) => {
      await new Promise((resolve) => setImmediate(resolve))
      abort()
      await new Promise((resolve) => setImmediate(resolve))
    })
    await h.finished
    expect(h.events.size).toBe(0)
  })
})
