import { createPlannerHost, type GeneratorDeps, type PlannerHost } from '../../src'
import { plannerWasmPath } from './acquired'

/** What the planner was asked: hosts created and schemas loaded, to see what a cache hit saves. */
export function countingDeps(extra: GeneratorDeps = {}) {
  const calls = { hosts: 0, loads: 0 }
  const logs: string[] = []
  const deps: GeneratorDeps = {
    wasmPath: plannerWasmPath(),
    logger: { debug: (m) => logs.push(m), warn: (m) => logs.push(`warn: ${m}`) },
    createHost: () => {
      calls.hosts++
      const host: PlannerHost = createPlannerHost({ wasmPath: plannerWasmPath() })
      return {
        ...host,
        load: (a) => (calls.loads++, host.load(a)),
        close: () => host.close(),
        plan: (r) => host.plan(r),
        planMany: (r) => host.planMany(r),
      }
    },
    ...extra,
  }
  return { deps, calls, logs }
}
