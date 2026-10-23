import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { acquireFromStack, plannerWasmPath } from './support/acquired'
import { createTempProject, type TempProject } from './support/project'
import type { AcquiredSchema } from '../src'

const PACKAGE_DIR = join(__dirname, '..')
const TSC = join(PACKAGE_DIR, 'node_modules', 'typescript-7.1', 'bin', 'tsc')
const POSTGREST_JS_SRC = resolve(__dirname, '../../../core/postgrest-js/src/index.ts')

let acquired: AcquiredSchema
beforeAll(async () => {
  acquired = await acquireFromStack()
}, 120_000)

let project: TempProject
afterEach(() => project.remove())

interface Scenario {
  /** Replaces the default options (a snapshot source with `defaultSchema: 'public'`) */
  options?: (defaults: Record<string, unknown>) => unknown
  files: Record<string, string>
}

/**
 * A temp project whose tsconfig lists the built mapper for `.pgrst-index` and a snapshot of the test stack as the
 * schema; returns tsc 7.1's verdict. The planner is the pinned build the tests run against, handed to the mapper
 * process through the environment.
 */
async function check({ options, files }: Scenario) {
  if (!existsSync(join(PACKAGE_DIR, 'dist', 'main', 'generate', 'index.js'))) {
    throw new Error('dist is missing: run `pnpm nx build postgrest-mapper` first')
  }
  project = await createTempProject(acquired, files)
  const { dir } = project
  const link = join(dir, 'node_modules', '@supabase', 'postgrest-mapper')
  mkdirSync(dirname(link), { recursive: true })
  symlinkSync(PACKAGE_DIR, link, 'dir')
  const defaults = { ...project.options, defaultSchema: 'public', unplanned: 'error' }
  writeFileSync(
    join(dir, 'tsconfig.json'),
    JSON.stringify({
      compilerOptions: {
        strict: true,
        noEmit: true,
        module: 'esnext',
        moduleResolution: 'bundler',
        target: 'es2022',
        lib: ['es2022', 'dom'],
        types: [],
        paths: { '@supabase/postgrest-js': [POSTGREST_JS_SRC] },
      },
      include: ['src'],
      contentMappers: [
        {
          package: '@supabase/postgrest-mapper',
          extensions: ['.pgrst-index'],
          options: options ? options(defaults) : defaults,
        },
      ],
    })
  )
  const wasm = plannerWasmPath()
  const run = spawnSync(
    process.execPath,
    [TSC, '--runExternalCode', '--noEmit', '--pretty', 'false', '-p', '.'],
    {
      cwd: dir,
      encoding: 'utf8',
      timeout: 120_000,
      env: { ...process.env, ...(wasm ? { POSTGREST_PLANNER_WASM: wasm } : {}) },
    }
  )
  return {
    status: run.status,
    output: `${run.stdout}${run.stderr}`.replaceAll(realpathSync(dir), '<dir>'),
  }
}

const INDEX = {
  'src/supabase.pgrst-index': '# Types are generated here. This content is ignored.\n',
}

const CLIENT = [
  "import type { PostgrestClient } from '@supabase/postgrest-js'",
  'declare const supabase: PostgrestClient',
]

describe('tsc 7.1 with the content mapper', () => {
  it('types a builder chain from the entries the real generator printed', async () => {
    const result = await check({
      files: {
        ...INDEX,
        'src/app.ts': [
          ...CLIENT,
          "export const q = supabase.from('users').select('username, messages(id)')",
          'export async function run() {',
          '  const { data, error } = await q',
          '  if (error) return',
          '  const name: string = data[0]!.username',
          '  const id: number = data[0]!.messages[0]!.id',
          '  return [name, id]',
          '}',
        ].join('\n'),
      },
    })
    expect(result).toEqual({ status: 0, output: '' })
  }, 180_000)

  it('reports a wrong usage of the generated types in the user file', async () => {
    const result = await check({
      files: {
        ...INDEX,
        'src/app.ts': [
          ...CLIENT,
          "export const q = supabase.from('users').select('username, messages(id)')",
          'export async function run() {',
          '  const { data, error } = await q',
          '  if (error) return',
          '  const id: string = data[0]!.messages[0]!.id',
          '  return id',
          '}',
        ].join('\n'),
      },
    })
    expect(result.status).toBe(2)
    expect(result.output).toContain('src/app.ts(7,9): error TS2322')
    expect(result.output).toContain("'number' is not assignable to type 'string'")
  }, 180_000)

  it('rejects a select the planner rejected', async () => {
    const result = await check({
      files: {
        ...INDEX,
        'src/app.ts': [
          ...CLIENT,
          "export const q = supabase.from('users').select('username, nope(id)')",
          'export const run = async () => (await q).data',
        ].join('\n'),
      },
    })
    expect(result.status).toBe(2)
    expect(result.output).toContain('src/app.ts')
    expect(result.output).toContain('PGRST200')
  }, 180_000)

  it('reports invalid options at the tsconfig value', async () => {
    const result = await check({
      options: (defaults) => ({ ...defaults, postgrest: 'latest', extra: 1 }),
      files: INDEX,
    })
    expect(result.status).toBe(2)
    expect(result.output).toMatch(
      /tsconfig\.json\(\d+,\d+\): error postgrest-mapper1003: Option 'postgrest'/
    )
    expect(result.output).toMatch(
      /tsconfig\.json\(\d+,\d+\): error postgrest-mapper1004: Unknown option 'extra'/
    )
  })

  it('flags a second index file', async () => {
    const result = await check({ files: { ...INDEX, 'src/other.pgrst-index': '# second\n' } })
    expect(result.status).toBe(2)
    // which of the two is "second" depends on the order TypeScript transforms them in
    expect(result.output).toMatch(
      /src\/(supabase|other)\.pgrst-index\(1,1\): error postgrest-mapper2001: Only one index file/
    )
  })
})
