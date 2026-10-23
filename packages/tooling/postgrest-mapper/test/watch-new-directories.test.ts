import { mkdirSync, rmSync, utimesSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { nodeWatch, watch, type AcquiredSchema, type WatchEvent, type WatchFn } from '../src'
import { acquireFromStack, plannerWasmPath } from './support/acquired'
import { createTempProject, type TempProject } from './support/project'

let acquired: AcquiredSchema
beforeAll(async () => {
  acquired = await acquireFromStack()
}, 120_000)

const BUDGET_MS = 90_000
const QUERY = (columns: string) =>
  `declare const supabase: any\nexport const q = supabase.from('users').select('${columns}')\n`

/** A watch over a real project directory; what it waits for is an event of the watch, never a sleep. */
async function watching(run: (session: Session) => Promise<void>): Promise<void> {
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
  // files that predate the watch, so that the watch does not rerun for them: only the events below can
  const longAgo = new Date(Date.now() - 60_000)
  for (const name of ['tsconfig.json', 'schema.snapshot.json', 'src/app.ts']) {
    utimesSync(join(project.dir, name), longAgo, longAgo)
  }
  const events: WatchEvent[] = []
  const watchedDirectories = new Set<string>()
  const delivered = new Set<string>()
  const waiters = new Set<() => void>()
  const changed = (): void => waiters.forEach((wake) => wake())
  const spyWatch: WatchFn = (directory, onEvent) => {
    // inotify reports the entries of the directory only; FSEvents (macOS) also reports the ones below it
    const handle = nodeWatch(directory, (filename) => {
      if (filename === null || !filename.includes('/')) {
        if (filename !== null) delivered.add(join(directory, filename))
        changed()
        onEvent(filename)
      }
    })
    watchedDirectories.add(directory)
    changed()
    return handle
  }
  const until = <T>(what: string, probe: () => T | undefined): Promise<T> =>
    new Promise<T>((resolve, reject) => {
      const budget = setTimeout(() => reject(new Error(`timed out waiting for ${what}`)), BUDGET_MS)
      const check = (): void => {
        const found = probe()
        if (found === undefined) return
        clearTimeout(budget)
        waiters.delete(check)
        resolve(found)
      }
      waiters.add(check)
      check()
    })
  const controller = new AbortController()
  const wasm = plannerWasmPath()
  const watching = watch(
    {
      cwd: project.dir,
      env: { ...process.env },
      watch: spyWatch,
      cacheDirectory: false,
      ...(wasm ? { wasmPath: wasm } : {}),
    },
    { project: 'tsconfig.json', out: 'types/supabase.d.ts' },
    {
      debounceMs: 20,
      signal: controller.signal,
      onEvent: (event) => {
        events.push(event)
        changed()
      },
    }
  )
  const session: Session = {
    project,
    mkdir: (name) => mkdirSync(join(project.dir, name), { recursive: true }),
    write: (name, text) => {
      mkdirSync(join(project.dir, name, '..'), { recursive: true })
      writeFileSync(join(project.dir, name), text)
    },
    remove: (name) => rmSync(join(project.dir, name), { recursive: true, force: true }),
    // a file system watcher can miss what happens in its first moments: write until one event of it is seen
    ready: async (name) => {
      const probe = join(name, 'ready-probe.ts')
      const writing = setInterval(() => session.write(probe, 'export {}\n'), 50)
      try {
        await until(`an event of ${name}`, () =>
          delivered.has(join(project.dir, probe)) ? true : undefined
        )
      } finally {
        clearInterval(writing)
      }
    },
    runCount: () => events.length,
    watched: (name) =>
      until(`${name} to be watched`, () =>
        watchedDirectories.has(join(project.dir, name)) ? true : undefined
      ).then(() => {}),
    generated: (key) =>
      until(`a run that declares ${key}`, () =>
        events.some((e) => e.kind === 'run' && e.result.ok && e.result.text.includes(key))
          ? true
          : undefined
      ).then(() => {}),
    runAfter: (count) =>
      until(`a run after run ${count}`, () => (events.length > count ? true : undefined)).then(
        () => {}
      ),
  }
  try {
    await session.generated('r|public|users|username')
    // the loop watches the directories only after the run it reports
    await session.watched('src')
    await session.ready('src')
    await run(session)
  } finally {
    controller.abort()
    await watching
    project.remove()
  }
}

interface Session {
  project: TempProject
  mkdir(name: string): void
  write(name: string, text: string): void
  remove(name: string): void
  ready(name: string): Promise<void>
  runCount(): number
  watched(name: string): Promise<void>
  generated(key: string): Promise<void>
  runAfter(count: number): Promise<void>
}

describe('watch picks up new directories', () => {
  it('scans a directory created with its file already inside', async () => {
    await watching(async (s) => {
      s.write('src/feature/deep/query.ts', QUERY('status'))
      await s.generated('r|public|users|status')
    })
  }, 180_000)

  it('watches a new directory, so that a file written to it later is scanned', async () => {
    await watching(async (s) => {
      s.mkdir('src/later')
      await s.watched('src/later')
      const runs = s.runCount()
      await s.runAfter(runs) // the run that scanned the empty directory
      await s.ready('src/later')
      s.write('src/later/query.ts', QUERY('age_range'))
      await s.generated('r|public|users|age_range')
    })
  }, 180_000)

  it('watches the directories below a new one, and one created in it', async () => {
    await watching(async (s) => {
      s.mkdir('src/outer/inner')
      await s.watched('src/outer/inner')
      s.mkdir('src/outer/inner/deepest')
      await s.watched('src/outer/inner/deepest')
      await s.ready('src/outer/inner/deepest')
      s.write('src/outer/inner/deepest/query.ts', QUERY('catchphrase'))
      await s.generated('r|public|users|catchphrase')
    })
  }, 180_000)

  it('scans a directory that replaced another one', async () => {
    await watching(async (s) => {
      s.write('src/swap/first.ts', QUERY('status'))
      await s.generated('r|public|users|status')
      s.remove('src/swap')
      s.write('src/swap/second.ts', QUERY('data'))
      await s.generated('r|public|users|data')
    })
  }, 180_000)
})
