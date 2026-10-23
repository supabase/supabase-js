import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { loadPlanner, parseConfigDump, type LoadInput, type Planner } from '../src'

const fixtures = join(__dirname, 'fixtures')

export const baseInput = (): LoadInput => ({
  config: parseConfigDump(readFileSync(join(fixtures, 'dump-config.txt'), 'utf8')),
  schema: readFileSync(join(fixtures, 'dump-schema.json'), 'utf8'),
})

export const supplementaryText = (): string =>
  readFileSync(join(fixtures, 'supplementary.json'), 'utf8')

export interface TrackedPlanner {
  planner: Planner
  /** Buffers the host got from `planner_alloc` and has not handed back to `planner_free`. */
  liveBuffers(): number
  /** Size of the wasm linear memory, in bytes. */
  memoryBytes(): number
}

/**
 * Loads a planner whose `planner_alloc` / `planner_free` exports are counted. `loadPlanner` keeps the instance
 * to itself, so the instance `WebAssembly.instantiate` returns is wrapped for the duration of the load.
 */
export async function loadTrackedPlanner(): Promise<TrackedPlanner> {
  const live = new Set<number>()
  let memory: WebAssembly.Memory | undefined
  const instantiate = WebAssembly.instantiate
  WebAssembly.instantiate = (async (...args: unknown[]) => {
    const result = await (instantiate as (...a: unknown[]) => Promise<unknown>).apply(
      WebAssembly,
      args
    )
    const { instance } = result as { instance: WebAssembly.Instance }
    memory = instance.exports['memory'] as WebAssembly.Memory
    // the exports object is frozen: a proxy over it may only return the real values, so it wraps a bare object
    const exports = new Proxy({} as WebAssembly.Exports, {
      get(_, key) {
        const value = Reflect.get(instance.exports, key)
        if (key === 'planner_alloc') {
          return (n: number) => {
            const ptr = (value as (n: number) => number)(n)
            live.add(ptr)
            return ptr
          }
        }
        if (key === 'planner_free') {
          return (ptr: number) => {
            live.delete(ptr)
            return (value as (ptr: number) => void)(ptr)
          }
        }
        return value
      },
    })
    const wrapped = new Proxy(instance, {
      get: (target, key) => (key === 'exports' ? exports : Reflect.get(target, key, target)),
    })
    return { ...(result as object), instance: wrapped }
  }) as typeof WebAssembly.instantiate
  let planner: Planner
  try {
    planner = await loadPlanner()
  } finally {
    WebAssembly.instantiate = instantiate
  }
  return {
    planner,
    liveBuffers: () => live.size,
    memoryBytes: () => memory!.buffer.byteLength,
  }
}
