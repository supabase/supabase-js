import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { nodeExec, refresh, watch, type ExecFn, type WatchEvent } from '../src'
import { STACK_WORKDIR, plannerWasmPath } from './support/acquired'

/**
 * A watch that starts while the live schema cannot be acquired, in a project that has no cache directory yet (so no
 * refresh stamp and no directory to put a watch on), must regenerate once `refresh` creates the stamp.
 */
let dir: string
beforeEach(() => {
  dir = mkdtempSync(join(realpathSync(tmpdir()), 'postgrest-mapper-watch-recovery-'))
  const write = (name: string, text: string): void => {
    mkdirSync(dirname(join(dir, name)), { recursive: true })
    writeFileSync(join(dir, name), text)
  }
  write('supabase/config.toml', 'project_id = "test"\n')
  write(
    'src/app.ts',
    "declare const supabase: any\nexport const q = supabase.from('users').select('username')\n"
  )
  write(
    'tsconfig.json',
    JSON.stringify({
      include: ['src'],
      contentMappers: [
        {
          package: '@supabase/postgrest-mapper',
          extensions: ['.pgrst-index'],
          options: {
            postgrest: '16.4',
            defaultSchema: 'public',
            schema: { source: 'supabase-local' },
          },
        },
      ],
    })
  )
})
afterEach(() => rmSync(dir, { recursive: true, force: true }))

const wasm = plannerWasmPath()

describe('watch recovers a schema that could not be acquired', () => {
  it('regenerates when refresh creates the stamp in a directory that did not exist', async () => {
    let up = false
    const exec: ExecFn = (command, args, options) => {
      if (!up) return Promise.reject(new Error('the stack is down'))
      return command === 'supabase'
        ? nodeExec(
            'npx',
            ['supabase', ...args.map((a, i) => (args[i - 1] === '--workdir' ? STACK_WORKDIR : a))],
            options
          )
        : nodeExec(command, args, options)
    }
    const deps = {
      cwd: dir,
      env: { ...process.env },
      schema: { exec },
      ...(wasm ? { wasmPath: wasm } : {}),
    }
    const events: WatchEvent[] = []
    const controller = new AbortController()
    const watching = watch(
      deps,
      { project: 'tsconfig.json', out: 'types/supabase.d.ts' },
      { debounceMs: 20, signal: controller.signal, onEvent: (event) => events.push(event) }
    )
    const until = async (predicate: () => boolean, what: string): Promise<void> => {
      const deadline = Date.now() + 90_000
      while (!predicate()) {
        if (Date.now() > deadline) throw new Error(`timed out waiting for ${what}`)
        await new Promise((r) => setTimeout(r, 50))
      }
    }
    try {
      await until(() => events.length > 0, 'the first run')
      const first = events[0]!
      expect(first.kind === 'run' && first.result.ok).toBe(false)
      expect(existsSync(join(dir, 'node_modules'))).toBe(false)

      up = true
      await refresh(deps, { project: 'tsconfig.json' })
      // the run's event, not the file's existence: the file shows up before it is fully written
      await until(
        () => events.some((event) => event.kind === 'run' && event.result.ok),
        'a run that generated after refresh'
      )
      expect(readFileSync(join(dir, 'types', 'supabase.d.ts'), 'utf8')).toContain(
        'r|public|users|username'
      )
    } finally {
      controller.abort()
      await watching
    }
  }, 180_000)
})
