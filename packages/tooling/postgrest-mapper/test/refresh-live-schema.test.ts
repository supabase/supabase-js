import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { createGenerator, createProjectGenerator, nodeExec, runCli, type ExecFn } from '../src'
import { STACK_WORKDIR, plannerWasmPath } from './support/acquired'

/**
 * A live schema is acquired once per process. `refresh` runs in another process: it must still make a long-lived
 * generator (content mapper server, watch) acquire again. Two library instances share the file system, as two
 * processes share the disk; the stack is the shared postgrest-js test stack (project `test`).
 */
let dir: string
beforeEach(() => {
  dir = mkdtempSync(join(realpathSync(tmpdir()), 'postgrest-mapper-refresh-'))
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
          options,
        },
      ],
    })
  )
})
afterEach(() => rmSync(dir, { recursive: true, force: true }))

/** The real `supabase`/`docker` of the stack, counting how many times the schema was dumped. */
function countingExec(): { exec: ExecFn; dumps: () => number } {
  let dumps = 0
  const exec: ExecFn = (command, args, options) => {
    if (command === 'supabase') {
      // the temp project only carries the project id; the stack's CLI project is the shared one
      const rewritten = args.map((a, i) => (args[i - 1] === '--workdir' ? STACK_WORKDIR : a))
      return nodeExec('npx', ['supabase', ...rewritten], options)
    }
    if (args.includes('--dump-schema')) dumps++
    return nodeExec(command, args, options)
  }
  return { exec, dumps: () => dumps }
}

const wasm = plannerWasmPath()
const options = {
  postgrest: '16.4',
  defaultSchema: 'public',
  schema: { source: 'supabase-local' },
} as const
const STAMP = (root: string) =>
  join(root, 'node_modules', '.cache', 'postgrest-mapper', 'refresh.stamp')

describe('refresh invalidates the live schema of another instance', () => {
  it('reacquires after a refresh run elsewhere, and lists the stamp as a dependency', async () => {
    const { exec, dumps } = countingExec()
    const generator = createGenerator({
      cwd: dir,
      schema: { exec },
      ...(wasm ? { wasmPath: wasm } : {}),
    })
    const params = { configFileName: join(dir, 'tsconfig.json'), options }
    try {
      const first = await generator.generate(params)
      expect(first.diagnostics).toEqual([])
      await generator.generate(params)
      expect(dumps()).toBe(1) // memoised for the process

      const refreshed = await runCli(['refresh', '--project', 'tsconfig.json'], {
        stdout: { write: () => undefined },
        stderr: { write: () => undefined },
        cwd: dir,
        env: { ...process.env },
        deps: { schema: { exec }, ...(wasm ? { wasmPath: wasm } : {}) },
      })
      expect(refreshed).toBe(0)
      const afterRefresh = dumps()

      const second = await generator.generate(params)
      expect(dumps()).toBe(afterRefresh + 1)
      // the stamp is a dependency of the generated module: the content mapper server regenerates when it changes
      expect(second.watchedFiles).toContain(STAMP(dir))

      await generator.generate(params)
      expect(dumps()).toBe(afterRefresh + 1) // memoised again until the next refresh
    } finally {
      await generator.close()
    }
  }, 180_000)

  it('reacquires after close: a closed generator keeps no live schema', async () => {
    const { exec, dumps } = countingExec()
    const generator = createGenerator({
      cwd: dir,
      schema: { exec },
      ...(wasm ? { wasmPath: wasm } : {}),
    })
    const params = { configFileName: join(dir, 'tsconfig.json'), options }
    try {
      await generator.generate(params)
      expect(dumps()).toBe(1)
      // nothing watches the database once closed: the schema read before may be stale
      await generator.close()
      const reopened = await generator.generate(params)
      expect(reopened.diagnostics).toEqual([])
      expect(dumps()).toBe(2)
    } finally {
      await generator.close()
    }
  }, 180_000)

  it('the content-mapper project generator lists the stamp too', async () => {
    const { exec } = countingExec()
    const run = createProjectGenerator({
      cwd: dir,
      schema: { exec },
      ...(wasm ? { wasmPath: wasm } : {}),
    })
    try {
      const result = await run({
        configFileName: join(dir, 'tsconfig.json'),
        projectHandle: dir,
        options,
        compilerOptions: {},
      })
      expect(result.watchedFiles).toContain(STAMP(dir))
    } finally {
      await run.close()
    }
  }, 120_000)
})
