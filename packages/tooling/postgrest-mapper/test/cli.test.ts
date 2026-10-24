import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { AcquiredSchema } from '../src'
import { runCli, type CliOptions } from '../src/cli'
import { STACK_WORKDIR, acquireFromStack, plannerWasmPath } from './support/acquired'
import { createTempProject, type TempProject } from './support/project'

const PACKAGE_DIR = join(__dirname, '..')
const BIN = join(PACKAGE_DIR, 'bin', 'postgrest-mapper.cjs')

let acquired: AcquiredSchema
beforeAll(async () => {
  acquired = await acquireFromStack()
}, 120_000)

let project: TempProject
afterEach(() => project?.remove())

const APP = (columns: string) =>
  `declare const supabase: any\nexport const q = supabase.from('users').select('${columns}')\n`

const TSCONFIG = (options: unknown = undefined) => `{
  // the project
  "compilerOptions": { "strict": true, /* inline */ "noEmit": true },
  "include": ["src"],
  "contentMappers": [
    {
      "package": "@supabase/postgrest-mapper",
      "extensions": [".pgrst-index"],
      "options": ${JSON.stringify(
        options ?? {
          postgrest: '16.4',
          defaultSchema: 'public',
          schema: { source: 'snapshot', path: 'schema.snapshot.json' },
        },
        null,
        2
      ).replace(/\n/g, '\n      ')},
    },
  ],
}
`

/** A tsconfig `contentMappers` entry that `init` finds already in place */
const ENTRY = `{ "package": "@supabase/postgrest-mapper", "extensions": [".pgrst-index"], "options": { "postgrest": "16.4", "schema": { "source": "snapshot", "path": "schema.snapshot.json" } } }`

async function setup(files: Record<string, string> = {}, tsconfig = TSCONFIG()) {
  project = await createTempProject(acquired, { 'src/app.ts': APP('username'), ...files })
  project.write('tsconfig.json', tsconfig)
  return project
}

interface Run {
  code: number
  stdout: string
  stderr: string
}

async function run(args: string[], options: Partial<CliOptions> = {}): Promise<Run> {
  let stdout = ''
  let stderr = ''
  const wasm = plannerWasmPath()
  const code = await runCli(args, {
    stdout: { write: (chunk) => (stdout += chunk) },
    stderr: { write: (chunk) => (stderr += chunk) },
    cwd: project?.dir ?? process.cwd(),
    env: { ...process.env },
    ...(wasm ? { deps: { wasmPath: wasm } } : {}),
    ...options,
  })
  return { code, stdout, stderr }
}

const generate = (...extra: string[]) =>
  run(['generate', '--project', 'tsconfig.json', '--out', 'types/supabase.d.ts', ...extra])

describe('postgrest-mapper generate', () => {
  it('writes the declarations, and --check tells fresh from stale without writing', async () => {
    const p = await setup()
    const written = await generate()
    expect(written).toMatchObject({ code: 0, stderr: '', stdout: 'wrote types/supabase.d.ts\n' })
    const file = join(p.dir, 'types', 'supabase.d.ts')
    const text = readFileSync(file, 'utf8')
    expect(text).toContain('SupabaseSelects')
    expect(text).toContain('r|public|users|username')

    expect((await generate()).stdout).toBe('types/supabase.d.ts is up to date\n')
    expect(await generate('--check')).toMatchObject({
      code: 0,
      stdout: 'types/supabase.d.ts is up to date\n',
    })

    p.write('src/app.ts', APP('username, status'))
    const stale = await generate('--check')
    expect(stale.code).toBe(1)
    expect(stale.stderr).toContain('types/supabase.d.ts is out of date')
    expect(stale.stderr).toMatch(/^ {2}\d+: [-+] /m)
    expect(readFileSync(file, 'utf8')).toBe(text) // --check never writes

    expect((await generate()).code).toBe(0)
    expect(readFileSync(file, 'utf8')).toContain('r|public|users|username, status')
    expect((await generate('--check')).code).toBe(0)
  }, 120_000)

  it('--check fails when the file is missing', async () => {
    await setup()
    const result = await generate('--check')
    expect(result.code).toBe(1)
    expect(result.stderr).toContain('does not exist')
  }, 60_000)

  it('prints diagnostics as file:line:col code message and writes nothing', async () => {
    const p = await setup(
      {},
      TSCONFIG({ postgrest: '16.4', schema: { source: 'snapshot', path: 'missing.json' } })
    )
    const result = await generate()
    expect(result.code).toBe(1)
    expect(result.stderr).toMatch(/^(?:tsconfig\.json:\d+:\d+ \d{4} .+\n)+$/)
    expect(existsSync(join(p.dir, 'types', 'supabase.d.ts'))).toBe(false)
  }, 60_000)

  it('reports a tsconfig without a content mapper entry', async () => {
    await setup({}, '{ "include": ["src"] }')
    const result = await generate()
    expect(result.code).toBe(1)
    expect(result.stderr).toContain('has no contentMappers entry for .pgrst-index')
  })

  it('takes the schema from --snapshot instead of the tsconfig', async () => {
    const p = await setup(
      {},
      TSCONFIG({ postgrest: '16.4', defaultSchema: 'public', schema: { source: 'supabase-local' } })
    )
    const result = await generate('--snapshot', 'schema.snapshot.json')
    expect(result).toMatchObject({ code: 0, stderr: '' })
    expect(existsSync(join(p.dir, 'types', 'supabase.d.ts'))).toBe(true)
  }, 60_000)

  it('print writes the same text to stdout', async () => {
    const p = await setup()
    await generate()
    const printed = await run(['print', '--project', 'tsconfig.json'])
    expect(printed.code).toBe(0)
    expect(printed.stdout).toBe(readFileSync(join(p.dir, 'types', 'supabase.d.ts'), 'utf8'))
  }, 60_000)

  it('refresh clears the generator cache and regenerates', async () => {
    const p = await setup()
    await generate()
    const cache = join(p.dir, 'node_modules', '.cache', 'postgrest-mapper')
    expect(existsSync(cache)).toBe(true)
    writeFileSync(join(cache, 'marker'), 'x')
    const result = await run(['refresh', '--project', 'tsconfig.json'])
    expect(result.code).toBe(0)
    expect(result.stdout).toContain('cleared node_modules/.cache/postgrest-mapper')
    expect(existsSync(join(cache, 'marker'))).toBe(false)
    expect(existsSync(cache)).toBe(true) // regenerated
  }, 120_000)
})

describe('postgrest-mapper generate --watch', () => {
  it('regenerates after a source change and stops on abort', async () => {
    const p = await setup()
    const controller = new AbortController()
    let stdout = ''
    const done = run(
      ['generate', '--project', 'tsconfig.json', '--out', 'types/supabase.d.ts', '--watch'],
      {
        signal: controller.signal,
        debounceMs: 20,
        stdout: { write: (chunk) => (stdout += chunk) },
      }
    )
    const until = async (predicate: () => boolean): Promise<void> => {
      const deadline = Date.now() + 60_000
      while (!predicate()) {
        if (Date.now() > deadline) throw new Error(`timed out; stdout: ${stdout}`)
        await new Promise((r) => setTimeout(r, 50))
      }
    }
    const file = join(p.dir, 'types', 'supabase.d.ts')
    await until(() => stdout.includes('wrote types/supabase.d.ts'))
    expect(readFileSync(file, 'utf8')).not.toContain('r|public|users|username, status')

    p.write('src/app.ts', APP('username, status'))
    await until(() => readFileSync(file, 'utf8').includes('r|public|users|username, status'))

    controller.abort()
    expect((await done).code).toBe(0)
  }, 120_000)

  it('regenerates when an inherited include is edited in a parent tsconfig', async () => {
    const p = await setup(
      {
        'configs/base.json': '{ "include": ["../src"] }',
        'more/app.ts': APP('status'),
      },
      TSCONFIG().replace('"include": ["src"],', '"extends": "./configs/base.json",')
    )
    const controller = new AbortController()
    let stdout = ''
    const done = run(
      ['generate', '--project', 'tsconfig.json', '--out', 'types/supabase.d.ts', '--watch'],
      {
        signal: controller.signal,
        debounceMs: 20,
        stdout: { write: (chunk) => (stdout += chunk) },
      }
    )
    const file = join(p.dir, 'types', 'supabase.d.ts')
    const until = async (predicate: () => boolean): Promise<void> => {
      const deadline = Date.now() + 60_000
      while (!predicate()) {
        if (Date.now() > deadline) throw new Error(`timed out; stdout: ${stdout}`)
        await new Promise((r) => setTimeout(r, 50))
      }
    }
    await until(() => stdout.includes('wrote types/supabase.d.ts'))
    expect(readFileSync(file, 'utf8')).toContain('r|public|users|username')
    expect(readFileSync(file, 'utf8')).not.toContain('r|public|users|status')

    p.write('configs/base.json', '{ "include": ["../src", "../more"] }')
    await until(() => readFileSync(file, 'utf8').includes('r|public|users|status'))

    controller.abort()
    expect((await done).code).toBe(0)
  }, 120_000)
})

describe('postgrest-mapper init', () => {
  it('adds the file to include, keeps comments, and is idempotent', async () => {
    const p = await setup(
      {},
      '{\n  // keep me\n  "compilerOptions": {}, /* and me */\n  "include": ["lib"]\n}\n'
    )
    const first = await run(['init', '--project', 'tsconfig.json', '--out', 'types/supabase.d.ts'])
    expect(first.code).toBe(0)
    const text = readFileSync(join(p.dir, 'tsconfig.json'), 'utf8')
    // the comments survive, and the mapper entry and the index file are part of the setup now
    expect(text).toMatch(
      /^\{\n {2}\/\/ keep me\n {2}"compilerOptions": \{\}, \/\* and me \*\/\n {2}"include": \["lib", "src\/supabase\.pgrst-index", "types\/supabase\.d\.ts"\],\n {2}"contentMappers": \[/
    )
    expect(existsSync(join(p.dir, 'src', 'supabase.pgrst-index'))).toBe(true)
    const second = await run(['init', '--project', 'tsconfig.json', '--out', 'types/supabase.d.ts'])
    expect(second).toMatchObject({ code: 0, stdout: 'types/supabase.d.ts is already set up\n' })
    expect(readFileSync(join(p.dir, 'tsconfig.json'), 'utf8')).toBe(text)
  })

  it('leaves a project that already includes the file, or includes everything, alone', async () => {
    const config = `{ "include": ["src/**/*.ts"], "contentMappers": [${ENTRY}] }`
    const p = await setup({}, config)
    const result = await run([
      'init',
      '--project',
      'tsconfig.json',
      '--out',
      'src/gen/supabase.d.ts',
      '--skip-generate',
      '--skip-scripts',
    ])
    expect(result.stdout).toContain('already set up')
    expect(readFileSync(join(p.dir, 'tsconfig.json'), 'utf8')).toBe(config)
  })

  it('adds compilerOptions.types next to a deno.json', async () => {
    const p = await setup({}, `{ "include": ["src"], "contentMappers": [${ENTRY}] }`)
    p.write('deno.json', '{\n  // deno\n  "tasks": {}\n}\n')
    const args = ['init', '--project', 'tsconfig.json', '--out', 'types/supabase.d.ts']
    expect((await run(args)).code).toBe(0)
    const deno = readFileSync(join(p.dir, 'deno.json'), 'utf8')
    expect(deno).toBe(
      '{\n  // deno\n  "tasks": {},\n  "compilerOptions": { "types": ["./types/supabase.d.ts"] }\n}\n'
    )
    expect((await run(args)).stdout).toContain('already set up')
    expect(readFileSync(join(p.dir, 'deno.json'), 'utf8')).toBe(deno)
  })
})

describe('postgrest-mapper snapshot', () => {
  it('writes a snapshot of the running stack and --check tells fresh from drifted', async () => {
    const p = await setup()
    const args = (...extra: string[]) =>
      run([
        'snapshot',
        '--out',
        'out/schema.json',
        '--workdir',
        STACK_WORKDIR,
        '--supabase-command',
        'npx supabase',
        ...extra,
      ])
    expect(await args()).toMatchObject({ code: 0, stdout: 'wrote out/schema.json\n' })
    expect(await args('--check')).toMatchObject({
      code: 0,
      stdout: 'out/schema.json is up to date\n',
    })

    const file = join(p.dir, 'out', 'schema.json')
    const snapshot = JSON.parse(readFileSync(file, 'utf8'))
    snapshot.pgVersionNum = 1
    writeFileSync(file, JSON.stringify(snapshot, null, 2) + '\n')
    const drift = await args('--check')
    expect(drift.code).toBe(1)
    expect(drift.stderr).toContain('out of date')
    expect(JSON.parse(readFileSync(file, 'utf8')).pgVersionNum).toBe(1) // --check never writes
  }, 180_000)
})

describe('postgrest-mapper arguments', () => {
  it.each([
    [['generate', '--bogus']],
    [['frobnicate']],
    [['generate']],
    [[]],
    [['print', '--out', 'x']],
    [['generate', '--out', 'x', '--check', '--watch']],
    [['generate', '--out', 'x', '--schema-source', 'carrier-pigeon']],
    [['init', 'extra']],
  ])('%j is a usage error', async (args) => {
    const result = await run(args)
    expect(result.code).toBe(2)
    expect(result.stderr).toContain('Usage:')
  })

  it('prints usage for --help and the version for --version', async () => {
    expect(await run(['--help'])).toMatchObject({ code: 0, stderr: '' })
    expect((await run(['generate', '--help'])).stdout).toContain('Usage:')
    expect((await run(['--version'], { version: '1.2.3' })).stdout).toBe('1.2.3\n')
  })
})

describe('bin/postgrest-mapper.cjs', () => {
  it('runs as a child process', async () => {
    if (!existsSync(join(PACKAGE_DIR, 'dist', 'main', 'cli', 'index.js'))) {
      throw new Error('dist is missing: run `pnpm nx build postgrest-mapper` first')
    }
    const p = await setup()
    const wasm = plannerWasmPath()
    const env = { ...process.env, ...(wasm ? { POSTGREST_PLANNER_WASM: wasm } : {}) }
    const result = spawnSync(
      process.execPath,
      [BIN, 'generate', '--project', 'tsconfig.json', '--out', 'types/supabase.d.ts'],
      { cwd: p.dir, env, encoding: 'utf8', timeout: 90_000 }
    )
    const stderr = result.stderr
      .split('\n')
      .filter((l) => l && !/ExperimentalWarning|--trace-warnings/.test(l))
    expect({ status: result.status, stderr }).toEqual({ status: 0, stderr: [] })
    expect(readFileSync(join(p.dir, 'types', 'supabase.d.ts'), 'utf8')).toContain('SupabaseSelects')
    const bad = spawnSync(process.execPath, [BIN, '--nope'], { cwd: p.dir, env, encoding: 'utf8' })
    expect(bad.status).toBe(2)
    const version = spawnSync(process.execPath, [BIN, '--version'], {
      cwd: p.dir,
      env,
      encoding: 'utf8',
    })
    expect(version.stdout.trim()).toBe(
      JSON.parse(readFileSync(join(PACKAGE_DIR, 'package.json'), 'utf8')).version
    )
  }, 120_000)
})
