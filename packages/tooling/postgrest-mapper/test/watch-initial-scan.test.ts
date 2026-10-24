import { mkdirSync, utimesSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { nodeOperationFs, watch, type AcquiredSchema, type WatchEvent } from '../src'
import { acquireFromStack, plannerWasmPath } from './support/acquired'
import { createTempProject } from './support/project'

let acquired: AcquiredSchema
beforeAll(async () => {
  acquired = await acquireFromStack()
}, 120_000)

const BUDGET_MS = 90_000
const QUERY = (columns: string) =>
  `declare const supabase: any\nexport const q = supabase.from('users').select('${columns}')\n`

/**
 * Starts a watch whose first generation creates `created` right after it has read the sources, which is after the
 * scan listed the directories and before any directory is watched. Resolves with the events up to the first run that
 * declares `key`, or rejects when none does.
 */
async function watchWhileCreating(
  created: Record<string, string>,
  key: string
): Promise<WatchEvent[]> {
  const project = await createTempProject(acquired, { 'src/app.ts': QUERY('username') })
  project.write(
    'tsconfig.json',
    JSON.stringify({
      include: ['src'],
      contentMappers: [
        {
          package: '@supabase/postgrest-mapper',
          extensions: ['.pgrst-index'],
          options: { ...project.options, defaultSchema: 'public' },
        },
      ],
    })
  )
  // files that predate the watch: only what is created during the first run can make it run again
  const longAgo = new Date(Date.now() - 60_000)
  for (const name of ['tsconfig.json', 'schema.snapshot.json', 'src/app.ts']) {
    utimesSync(join(project.dir, name), longAgo, longAgo)
  }
  let creating = false
  const events: WatchEvent[] = []
  const controller = new AbortController()
  let found: (() => void) | undefined
  const reached = new Promise<void>((resolve) => (found = resolve))
  const wasm = plannerWasmPath()
  const watching = watch(
    {
      cwd: project.dir,
      env: { ...process.env },
      cacheDirectory: false,
      ...(wasm ? { wasmPath: wasm } : {}),
      fs: {
        ...nodeOperationFs,
        readFile: async (path) => {
          const text = await nodeOperationFs.readFile(path)
          if (!creating && path === join(project.dir, 'src/app.ts')) {
            creating = true
            for (const [name, content] of Object.entries(created)) {
              mkdirSync(dirname(join(project.dir, name)), { recursive: true })
              writeFileSync(join(project.dir, name), content)
            }
          }
          return text
        },
      },
    },
    { project: 'tsconfig.json', out: 'types/supabase.d.ts' },
    {
      debounceMs: 20,
      signal: controller.signal,
      onEvent: (event) => {
        events.push(event)
        if (event.kind === 'run' && event.result.text.includes(key)) found?.()
      },
    }
  )
  let budget: NodeJS.Timeout | undefined
  try {
    await Promise.race([
      reached,
      new Promise<never>((_, reject) => {
        budget = setTimeout(
          () => reject(new Error(`timed out waiting for a run that declares ${key}`)),
          BUDGET_MS
        )
      }),
    ])
    return events
  } finally {
    clearTimeout(budget)
    controller.abort()
    await watching
    project.remove()
  }
}

describe('watch sees what is created while the first generation runs', () => {
  it('runs again for a file created in a scanned directory after it was listed', async () => {
    const events = await watchWhileCreating(
      { 'src/created.ts': QUERY('status') },
      'r|public|users|status'
    )
    const first = events[0]
    expect(first?.kind === 'run' && first.result.text).not.toContain('r|public|users|status')
  }, 180_000)

  it('runs again for a directory created with its file after the scan listed its parent', async () => {
    const events = await watchWhileCreating(
      { 'src/feature/deep/query.ts': QUERY('catchphrase') },
      'r|public|users|catchphrase'
    )
    const first = events[0]
    expect(first?.kind === 'run' && first.result.text).not.toContain('r|public|users|catchphrase')
  }, 180_000)
})
