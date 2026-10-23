import {
  createPlannerHost,
  generateDeclarations,
  type AcquiredSchema,
  type PlannerHost,
} from '../src'
import { acquireFromStack, plannerWasmPath } from './support/acquired'
import { createTempProject, type TempProject } from './support/project'

const APP = `
declare const supabase: any
export const call = supabase.rpc('get_status', { name_param: 'x' })
export const rows = supabase.from('messages').select('id')
`

let acquired: AcquiredSchema
beforeAll(async () => {
  acquired = await acquireFromStack()
}, 120_000)

let project: TempProject
afterEach(() => project?.remove())

type Request = Parameters<PlannerHost['plan']>[0]
type Result = Awaited<ReturnType<PlannerHost['plan']>>

/** The real planner, with some of its answers changed the way a degraded build would answer. */
function hostWith(change: (request: Request, result: Result) => Result): () => PlannerHost {
  return () => {
    const host = createPlannerHost({ wasmPath: plannerWasmPath() })
    const planned = async (request: Request) => change(request, await host.plan(request))
    return {
      ...host,
      close: () => host.close(),
      plan: planned,
      planMany: (requests) => Promise.all(requests.map(planned)),
    }
  }
}

async function generateWith(createHost: () => PlannerHost) {
  project = await createTempProject(acquired, { 'src/app.ts': APP })
  return generateDeclarations({
    configFileName: project.configFileName,
    options: { ...project.options, defaultSchema: 'public' },
    deps: { wasmPath: plannerWasmPath(), createHost, cacheDirectory: false },
  })
}

describe('what a degraded planner answer costs the output', () => {
  it('keeps the planner degraded note in the error of a call without a result form', async () => {
    const result = await generateWith(
      hostWith((request, answer) =>
        request.url.startsWith('/rpc/get_status') && answer.ok
          ? ({
              ...answer,
              form: undefined,
              degraded: ['media-handler:public.get_status'],
            } as unknown as Result)
          : answer
      )
    )
    expect(result.text).toMatch(
      /error: "the planner returned no result form for this call[^"]*media-handler:public\.get_status[^"]*"/
    )
  }, 120_000)

  it('reports a relation left out for want of a select=* shape as a warning', async () => {
    const result = await generateWith(
      hostWith((request, answer) =>
        request.url === '/users?select=*' && answer.ok
          ? ({ ...answer, shape: undefined } as unknown as Result)
          : answer
      )
    )
    expect(result.warnings).toContain(
      'the plan of select=* of public.users has no result shape: left out'
    )
  }, 120_000)
})
