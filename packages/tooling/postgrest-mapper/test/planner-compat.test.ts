import { mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Worker } from 'node:worker_threads'
import {
  HOST_ERROR,
  PLANNER_ABI,
  compareReleases,
  createGenerator,
  createPlannerHost,
  generateDeclarations,
  startPlannerWorker,
  type AcquiredSchema,
  type GeneratorDeps,
  type PlannerHost,
  type WorkerLike,
} from '../src'
import { WORKER_SOURCE } from '../src/host/worker-source'
import { acquireFromStack, plannerWasmPath } from './support/acquired'
import { createTempProject, type TempProject } from './support/project'

/**
 * The planner and the generator must agree: on the ABI of the wasm (checked when the planner starts) and on the
 * PostgREST release the planner models (design v3 §4.4: another line is a failure, another patch a warning).
 */
describe('planner ABI', () => {
  const dirs: string[] = []
  afterEach(() => {
    for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true })
  })

  /** A planner module that reports `abi`, loaded by the production worker program */
  function hostReporting(abi: number): PlannerHost {
    const dir = mkdtempSync(join(realpathSync(tmpdir()), 'postgrest-mapper-abi-'))
    dirs.push(dir)
    const plannerModule = join(dir, 'planner.js')
    writeFileSync(
      plannerModule,
      `exports.loadPlanner = () => ({
        info: () => ({ ok: true, abi: ${abi}, ghc: 'ghc 9.10', postgrest: { version: '16.4', tag: 'v16.4', commit: 'abc' } }),
        load: () => ({ ok: true, handle: 1, schemas: [], summary: '', degraded: [] }),
        plan: () => ({ ok: true }),
        freeCache: () => undefined,
      })`
    )
    return createPlannerHost({
      createWorker: () =>
        new Worker(WORKER_SOURCE, {
          eval: true,
          workerData: { plannerModule, abi: PLANNER_ABI },
        }) as unknown as WorkerLike,
    })
  }
  const NOTHING = { config: {}, dump: '', supplementary: {} } as unknown as AcquiredSchema

  it('reports the planner build of the real wasm', async () => {
    const host = createPlannerHost({
      createWorker: () => startPlannerWorker(plannerWasmPath()),
    })
    try {
      const info = await host.info()
      expect(info).toMatchObject({
        ok: true,
        abi: PLANNER_ABI,
        postgrest: { version: expect.stringMatching(/^\d+\.\d+/) },
      })
    } finally {
      await host.close()
    }
  })

  it('fails every call, clearly, when the wasm speaks another ABI', async () => {
    const host = hostReporting(PLANNER_ABI + 1)
    try {
      const info = await host.info()
      expect(info).toMatchObject({
        ok: false,
        error: {
          code: HOST_ERROR.workerFailed,
          message: expect.stringContaining(`ABI ${PLANNER_ABI + 1}`),
        },
      })
      const loaded = await host.load(NOTHING)
      expect(loaded).toMatchObject({ ok: false, error: { code: HOST_ERROR.workerFailed } })
      expect(JSON.stringify(loaded)).toContain(`expected ${PLANNER_ABI}`)
    } finally {
      await host.close()
    }
  })

  it('accepts the ABI it was built for', async () => {
    const host = hostReporting(PLANNER_ABI)
    try {
      expect(await host.info()).toMatchObject({ ok: true, abi: PLANNER_ABI })
      expect(await host.load(NOTHING)).toMatchObject({ ok: true })
    } finally {
      await host.close()
    }
  })

  it('is reported as 2003 by the generator', async () => {
    const p = await createTempProject(acquired, {
      'src/app.ts': `supabase.from('users').select('username')`,
    })
    projects.push(p)
    const result = await generateDeclarations({
      configFileName: p.configFileName,
      options: { ...p.options, postgrest: '16.4', defaultSchema: 'public' } as never,
      deps: {
        cacheDirectory: false,
        createHost: () => hostReporting(PLANNER_ABI + 1),
      },
    })
    expect(result.text).toBe('export {}\n')
    expect(result.diagnostics).toMatchObject([
      { code: 2003, messageText: expect.stringContaining(`ABI ${PLANNER_ABI + 1}`) },
    ])
  }, 60_000)
})

describe('release comparison', () => {
  it('accepts the same release and ignores a missing patch as .0', () => {
    expect(compareReleases('16.4', '16.4')).toEqual({ kind: 'same' })
    expect(compareReleases('16.4.0', '16.4')).toEqual({ kind: 'same' })
  })
  it('warns for another patch of the same line', () => {
    expect(compareReleases('16.4.1', '16.4')).toEqual({ kind: 'patch' })
    expect(compareReleases('16.4', '16.4.2')).toEqual({ kind: 'patch' })
  })
  it('fails for another line, in either component', () => {
    expect(compareReleases('14.4', '16.4')).toEqual({ kind: 'line' })
    expect(compareReleases('16.5', '16.4')).toEqual({ kind: 'line' })
  })
  it('fails for a release it cannot read', () => {
    expect(compareReleases('latest', '16.4')).toEqual({ kind: 'line' })
  })
})

let acquired: AcquiredSchema
beforeAll(async () => {
  acquired = await acquireFromStack()
}, 120_000)

const projects: TempProject[] = []
afterEach(() => {
  for (const p of projects.splice(0)) p.remove()
})

const APP = `supabase.from('users').select('username')`

describe('release policy of the generator', () => {
  const optionsOf = (p: TempProject, postgrest: string) =>
    ({ ...p.options, postgrest, defaultSchema: 'public' }) as never
  const deps = (): GeneratorDeps => ({ wasmPath: plannerWasmPath(), cacheDirectory: false })

  it('generates with no warning when configuration, server and planner agree', async () => {
    const p = await createTempProject(acquired, { 'src/app.ts': APP }, '16.4')
    projects.push(p)
    const result = await generateDeclarations({
      configFileName: p.configFileName,
      options: optionsOf(p, '16.4'),
      deps: deps(),
    })
    expect(result.diagnostics).toEqual([])
    expect(result.warnings).toEqual([])
    expect(result.text).toContain('username')
  }, 120_000)

  it('fails with 2006 when the configured release is another line than the planner', async () => {
    const p = await createTempProject(acquired, { 'src/app.ts': APP }, '14.4')
    projects.push(p)
    const result = await generateDeclarations({
      configFileName: p.configFileName,
      options: optionsOf(p, '14.4'),
      deps: deps(),
    })
    expect(result.text).toBe('export {}\n')
    expect(result.diagnostics).toMatchObject([
      { code: 2006, messageText: expect.stringMatching(/'14\.4'.*16\.4/) },
    ])
  }, 120_000)

  it('fails with 2006 when the server is another line than the planner', async () => {
    const p = await createTempProject(
      { ...acquired, postgrestVersion: '15.0' },
      {
        'src/app.ts': APP,
      }
    )
    projects.push(p)
    const result = await generateDeclarations({
      configFileName: p.configFileName,
      options: optionsOf(p, '16.4'),
      deps: deps(),
    })
    expect(result.text).toBe('export {}\n')
    expect(result.diagnostics).toMatchObject([
      { code: 2006, messageText: expect.stringMatching(/server.*15\.0.*16\.4/) },
    ])
  }, 120_000)

  it('warns, and still generates, when only the patch differs', async () => {
    const p = await createTempProject(acquired, { 'src/app.ts': APP })
    projects.push(p)
    const result = await generateDeclarations({
      configFileName: p.configFileName,
      options: optionsOf(p, '16.4.1'),
      deps: deps(),
    })
    expect(result.diagnostics).toEqual([])
    expect(result.warnings).toEqual([expect.stringMatching(/'16\.4\.1'.*16\.4/)])
    expect(result.text).toContain('username')
  }, 120_000)

  it('applies the policy to a cache hit without starting the planner', async () => {
    const p = await createTempProject(acquired, { 'src/app.ts': APP })
    projects.push(p)
    const warm = createGenerator({ wasmPath: plannerWasmPath() })
    const miss = await warm.generate({
      configFileName: p.configFileName,
      options: optionsOf(p, '16.4'),
    })
    await warm.close()
    expect(miss.cache).toBe('miss')

    let hosts = 0
    const cold = createGenerator({
      wasmPath: plannerWasmPath(),
      createHost: () => {
        hosts++
        return createPlannerHost({ wasmPath: plannerWasmPath() })
      },
    })
    try {
      const wrong = await cold.generate({
        configFileName: p.configFileName,
        options: optionsOf(p, '14.4'),
      })
      expect(wrong.diagnostics).toMatchObject([{ code: 2006 }])
      expect(wrong.text).toBe('export {}\n')
      const patch = await cold.generate({
        configFileName: p.configFileName,
        options: optionsOf(p, '16.4.3'),
      })
      expect(patch.cache).toBe('hit')
      expect(patch.warnings).toHaveLength(1)
      expect(hosts).toBe(0)
    } finally {
      await cold.close()
    }
  }, 120_000)
})
