import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import ts from 'typescript'
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
import { nodeProjectFs, resolveProjectFiles } from '../src/generate'
import { entryCovers } from '../src/operations'
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

  describe('adds a file to include unless a pattern of include matches it as TypeScript does', () => {
    const included = async (include: string[]): Promise<string[]> => {
      put('tsconfig.json', JSON.stringify({ include }))
      await init(deps())
      return JSON.parse(read('tsconfig.json')).include
    }

    it.each([
      ['src/**/*.ts', ['src/**/*.ts', 'src/supabase.pgrst-index']], // the index extension is not .ts
      ['src/**/*.tsx', ['src/**/*.tsx', 'src/supabase.pgrst-index', 'src/supabase.types.d.ts']],
      ['src/*.d.ts', ['src/*.d.ts', 'src/supabase.pgrst-index']],
      [
        'src/sub/**/*.ts',
        ['src/sub/**/*.ts', 'src/supabase.pgrst-index', 'src/supabase.types.d.ts'],
      ],
      ['lib/**/*', ['lib/**/*', 'src/supabase.pgrst-index', 'src/supabase.types.d.ts']],
      // TypeScript takes nothing from a trailing `**`
      ['src/**', ['src/**', 'src/supabase.pgrst-index', 'src/supabase.types.d.ts']],
    ])('%s', async (pattern, expected) => {
      expect(await included([pattern])).toEqual(expected)
    })

    it.each([
      ['src/**/*'],
      ['src/*'],
      ['./src/'],
      ['**/*'],
      ['src/supabase.*'],
      ['src/**/supabase.*'],
    ])('%s covers both files', async (pattern) => {
      expect(await included([pattern])).toEqual([pattern])
    })

    it('reads a pattern that covers one file and not the other, per file', async () => {
      expect(await included(['src/**/*.d.ts', 'src/*.pgrst-index'])).toEqual([
        'src/**/*.d.ts',
        'src/*.pgrst-index',
      ])
    })
  })

  it('agrees with the files TypeScript itself takes for an include entry', () => {
    const files = [
      'src/a.ts',
      'src/a.tsx',
      'src/supabase.pgrst-index',
      'src/supabase.types.d.ts',
      'src/sub/b.ts',
      'src/sub/supabase.pgrst-index',
      'src/.hidden/c.ts',
      'src/app.min.js',
      'node_modules/x/n.ts',
      'lib/l.ts',
      'lib/supabase.pgrst-index',
    ]
    for (const file of files) put(file, '\n')
    const entries = [
      'src',
      './src/',
      'src/sub',
      'src/**',
      'src/**/*',
      'src/*',
      'src/**/*.ts',
      'src/**/*.tsx',
      'src/*.d.ts',
      'src/**/*.d.ts',
      'src/supabase.*',
      'src/**/supabase.*',
      'src/?.ts',
      'src/sub/**/*.ts',
      'lib/**/*',
      '**/*',
      '**/*.ts',
      '**/*.pgrst-index',
      'src/supabase.types.d.ts',
      'src/supabase.pgrst-index',
      '../project/src/*.ts',
    ]
    const extensions = ['.ts', '.tsx', '.d.ts', '.pgrst-index']
    const disagreements: string[] = []
    for (const entry of entries) {
      const taken = new Set(
        ts.sys
          .readDirectory(dir, extensions, undefined, [entry])
          .map((f) => f.slice(dir.length + 1))
      )
      for (const file of files) {
        if (entryCovers(entry, file) !== taken.has(file)) {
          disagreements.push(`${entry} ${file}: TypeScript ${taken.has(file) ? 'takes' : 'skips'}`)
        }
      }
    }
    expect(disagreements).toEqual([])
  })

  describe('respects the include an extends chain provides', () => {
    const run = async (): Promise<string[]> => {
      await init(deps(), { out: 'src/supabase.types.d.ts' })
      return JSON.parse(read('tsconfig.json')).include
    }
    const projectFiles = async (): Promise<string[]> =>
      (
        await resolveProjectFiles(nodeProjectFs, {
          projectDir: dir,
          configFileName: join(dir, 'tsconfig.json'),
        })
      ).files

    it('carries the inherited include over to the local tsconfig, so the project keeps its files and the new ones are listed', async () => {
      put('base.json', '{ "include": ["app"] }')
      put('tsconfig.json', '{ "extends": "./base.json" }')
      put('app/main.ts', SOURCE)
      put('src/supabase.types.d.ts', 'export {}\n')

      expect(await run()).toEqual(['app', 'src/supabase.pgrst-index', 'src/supabase.types.d.ts'])
      // a `.d.ts` is never scanned: the resolved program keeps the inherited `app` and no more
      expect(await projectFiles()).toEqual([join(dir, 'app', 'main.ts')])
    }, 60_000)

    it('rebases the inherited entries from the directory of the config that wrote them', async () => {
      put('configs/base.json', '{ "include": ["../app"] }')
      put('tsconfig.json', '{ "extends": "./configs/base.json" }')
      put('app/main.ts', SOURCE)

      expect(await run()).toEqual(['app', 'src/supabase.pgrst-index', 'src/supabase.types.d.ts'])
    }, 60_000)

    it('writes nothing when the inherited include already covers the new files', async () => {
      put('base.json', '{ "include": ["src"] }')
      put('tsconfig.json', '{ "extends": "./base.json" }')

      const result = await init(deps(), { out: 'src/supabase.types.d.ts' })
      expect(JSON.parse(read('tsconfig.json'))).not.toHaveProperty('include')
      expect(result.changes.map((c) => c.message)).toEqual([
        'added the .pgrst-index entry to contentMappers',
        'created the index file',
      ])
    }, 60_000)
  })

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
