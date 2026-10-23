import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  HOST_ERROR,
  createGenerator,
  createPlannerHost,
  type AcquiredSchema,
  type GeneratorDeps,
  type PlannerHost,
} from '../src'
import type { PlanRequest, PlanResult } from '@supabase/postgrest-planner'
import { acquireFromStack, plannerWasmPath } from './support/acquired'
import { createTempProject, type TempProject } from './support/project'

/**
 * A generation whose plans did not all come back (a timeout, a crashed worker) is incomplete: it says so, it is not
 * cached, and recovering the plan is a different generation.
 */
let acquired: AcquiredSchema
beforeAll(async () => {
  acquired = await acquireFromStack()
}, 120_000)

const projects: TempProject[] = []
afterEach(() => {
  for (const p of projects.splice(0)) p.remove()
})
async function project(files: Record<string, string>): Promise<TempProject> {
  const p = await createTempProject(acquired, files)
  projects.push(p)
  return p
}
const optionsOf = (p: TempProject) => ({ ...p.options, defaultSchema: 'public' }) as never

const CHAINS = `
  supabase.from('users').select('username')
  supabase.from('messages').select('id, channels(id)')
`

/** A host over the real planner that answers the requests `failing` accepts with a transient host failure. */
function flakyDeps(failing: (request: PlanRequest) => boolean): GeneratorDeps {
  return {
    wasmPath: plannerWasmPath(),
    createHost: () => {
      const host = createPlannerHost({ wasmPath: plannerWasmPath() })
      const timeout: PlanResult = {
        ok: false,
        error: { code: HOST_ERROR.timeout, message: 'planning exceeded its time budget' },
      } as PlanResult
      const planMany = async (requests: PlanRequest[]): Promise<PlanResult[]> => {
        const results = await host.planMany(requests)
        return results.map((r, i) => (failing(requests[i]!) ? timeout : r))
      }
      return {
        info: () => host.info(),
        load: (a) => host.load(a),
        close: () => host.close(),
        plan: async (r) => (await planMany([r]))[0]!,
        planMany,
      } as PlannerHost
    },
  }
}

const cacheFiles = (p: TempProject): string[] => {
  const dir = join(p.dir, 'node_modules', '.cache', 'postgrest-mapper')
  return existsSync(dir) ? readdirSync(dir) : []
}

describe('an incomplete generation', () => {
  it('reports a relation whose select=* timed out, does not cache the context, and recovers on the next run', async () => {
    const p = await project({ 'src/app.ts': CHAINS })
    const flaky = createGenerator(flakyDeps((r) => r.url === '/users?select=*'))
    const broken = await flaky.generate({ configFileName: p.configFileName, options: optionsOf(p) })
    await flaky.close()
    expect(broken.diagnostics.map((d) => d.code)).toContain(2003)
    expect(broken.diagnostics.map((d) => d.messageText).join('\n')).toContain('public.users')
    expect(cacheFiles(p)).toEqual([])

    const healthy = createGenerator({ wasmPath: plannerWasmPath() })
    const fixed = await healthy.generate({
      configFileName: p.configFileName,
      options: optionsOf(p),
    })
    await healthy.close()
    expect(fixed.diagnostics).toEqual([])
    expect(fixed.cache).toBe('miss')
    expect(fixed.text).toContain("username: SupabaseColumnType<'public.users.username', string>")
    expect(fixed.text).not.toBe(broken.text)
    expect(cacheFiles(p)).toHaveLength(1)
    const stored = JSON.parse(
      readFileSync(
        join(p.dir, 'node_modules', '.cache', 'postgrest-mapper', cacheFiles(p)[0]!),
        'utf8'
      )
    )
    expect(stored.context.plans.map((p: [string]) => p[0])).toContain('public.users')
  }, 120_000)

  it('gives another identity once a timed-out plan recovers', async () => {
    const p = await project({ 'src/app.ts': CHAINS })
    const flaky = createGenerator(flakyDeps((r) => r.url.startsWith('/messages?select=id')))
    const broken = await flaky.generate({ configFileName: p.configFileName, options: optionsOf(p) })
    await flaky.close()
    expect(broken.diagnostics.map((d) => d.code)).toContain(2003)

    const healthy = createGenerator({ wasmPath: plannerWasmPath(), cacheDirectory: false })
    const fixed = await healthy.generate({
      configFileName: p.configFileName,
      options: optionsOf(p),
    })
    await healthy.close()
    expect(fixed.keys).toEqual(broken.keys)
    expect(fixed.text).not.toBe(broken.text)
    expect(fixed.identity).not.toBe(broken.identity)
  }, 120_000)
})
