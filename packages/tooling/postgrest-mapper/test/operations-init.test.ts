import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import {
  generate,
  init,
  nodeExec,
  runCli,
  write,
  writeSnapshot,
  type AcquiredSchema,
  type ExecFn,
  type OperationDeps,
} from '../src'
import { STACK_WORKDIR, acquireFromStack, plannerWasmPath } from './support/acquired'

let acquired: AcquiredSchema
beforeAll(async () => {
  acquired = await acquireFromStack()
}, 120_000)

let dir: string
beforeEach(() => {
  dir = mkdtempSync(join(realpathSync(tmpdir()), 'postgrest-mapper-init-'))
})
afterEach(() => rmSync(dir, { recursive: true, force: true }))

const put = (name: string, text: string): void => {
  mkdirSync(dirname(join(dir, name)), { recursive: true })
  writeFileSync(join(dir, name), text)
}
const read = (name: string): string => readFileSync(join(dir, name), 'utf8')

/** The real `supabase`/`docker` of the stack: the temp project only carries the project id */
const stackExec: ExecFn = (command, args, options) =>
  command === 'supabase'
    ? nodeExec(
        'npx',
        ['supabase', ...args.map((a, i) => (args[i - 1] === '--workdir' ? STACK_WORKDIR : a))],
        options
      )
    : nodeExec(command, args, options)

const wasm = plannerWasmPath()
const deps = (extra: OperationDeps = {}): OperationDeps => ({
  cwd: dir,
  env: { ...process.env },
  ...(wasm ? { wasmPath: wasm } : {}),
  ...extra,
})

const SOURCE =
  "declare const supabase: any\nexport const q = supabase.from('users').select('username')\n"

describe('init sets a fresh project up so that generate succeeds', () => {
  it('writes the entry and the index file, with a snapshot source when there is no supabase/config.toml', async () => {
    put(
      'tsconfig.json',
      '{\n  // my project\n  "compilerOptions": { "strict": true },\n  "include": ["src"]\n}\n'
    )
    put('src/app.ts', SOURCE)

    const result = await init(deps(), { out: 'src/supabase.types.d.ts' })
    expect(result).toMatchObject({
      configFileName: join(dir, 'tsconfig.json'),
      out: join(dir, 'src', 'supabase.types.d.ts'),
      index: join(dir, 'src', 'supabase.pgrst-index'),
      schemaSource: 'snapshot',
    })
    expect(result.changes.map((c) => [c.file, c.action])).toEqual([
      [join(dir, 'tsconfig.json'), 'edited'],
      [join(dir, 'src', 'supabase.pgrst-index'), 'created'],
    ])
    expect(read('tsconfig.json')).toContain('// my project')
    const tsconfig = JSON.parse(read('tsconfig.json').replace(/\/\/.*\n/g, ''))
    expect(tsconfig.contentMappers).toEqual([
      {
        package: '@supabase/postgrest-mapper',
        extensions: ['.pgrst-index'],
        options: {
          postgrest: expect.stringMatching(/^\d+\.\d+$/),
          schema: { source: 'snapshot', path: 'supabase/postgrest-schema.json' },
        },
      },
    ])
    expect(read('src/supabase.pgrst-index')).toMatch(/^\/\/ postgrest-mapper index file/)

    // the snapshot is what the user produces next; then generate works on the project init left
    await writeSnapshot(join(dir, 'supabase', 'postgrest-schema.json'), acquired)
    const generated = await generate(deps())
    expect(generated.diagnostics).toEqual([])
    expect(generated.ok).toBe(true)
    const written = await write(deps(), { out: 'src/supabase.types.d.ts' })
    expect(written.changed).toBe(true)
    expect(read('src/supabase.types.d.ts')).toContain('r|public|users|username')
  }, 120_000)

  it('names the supabase-local source when it finds a supabase/config.toml, and generate reads the stack', async () => {
    put('supabase/config.toml', 'project_id = "test"\n')
    put('tsconfig.json', '{ "include": ["src"] }')
    put('src/app.ts', SOURCE)

    const result = await init(deps())
    expect(result.schemaSource).toBe('supabase-local')
    expect(JSON.parse(read('tsconfig.json')).contentMappers[0].options.schema).toEqual({
      source: 'supabase-local',
    })

    const generated = await generate(deps({ schema: { exec: stackExec } }))
    expect(generated.diagnostics).toEqual([])
    expect(generated.text).toContain('r|public|users|username')
  }, 180_000)

  it('is idempotent: a project that is set up gets no change, and the index file is not overwritten', async () => {
    put('tsconfig.json', '{ "include": ["src"] }')
    const first = await init(deps())
    expect(first.changes.length).toBeGreaterThan(0)
    const tsconfig = read('tsconfig.json')
    put('src/supabase.pgrst-index', '// edited by the user\n')

    const second = await init(deps())
    expect(second.changes).toEqual([])
    expect(second.schemaSource).toBeUndefined()
    expect(read('tsconfig.json')).toBe(tsconfig)
    expect(read('src/supabase.pgrst-index')).toBe('// edited by the user\n')
  }, 60_000)

  it('does not start the planner when the tsconfig already has the entry', async () => {
    put(
      'tsconfig.json',
      JSON.stringify({
        include: ['src'],
        contentMappers: [
          { package: '@supabase/postgrest-mapper', extensions: ['.pgrst-index'], options: {} },
        ],
      })
    )
    const result = await init(
      deps({
        createHost: () => {
          throw new Error('the planner must not start')
        },
      })
    )
    expect(result.changes).toEqual([])
  })

  it('reports an unreadable tsconfig as an OperationError, and the CLI prints it', async () => {
    await expect(init(deps(), { project: 'missing.json' })).rejects.toMatchObject({
      code: 'config-unreadable',
    })
    let stderr = ''
    const code = await runCli(['init', '--project', 'missing.json'], {
      stdout: { write: () => undefined },
      stderr: { write: (chunk) => (stderr += chunk) },
      cwd: dir,
      env: {},
    })
    expect(code).toBe(1)
    expect(stderr).toContain('cannot read missing.json')
  })
})
