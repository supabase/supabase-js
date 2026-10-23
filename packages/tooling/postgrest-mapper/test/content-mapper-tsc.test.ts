import { spawnSync } from 'node:child_process'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'

const PACKAGE_DIR = join(__dirname, '..')
const TSC = join(PACKAGE_DIR, 'node_modules', 'typescript-7.1', 'bin', 'tsc')

const OPTIONS = { postgrest: '14.4', schema: { source: 'supabase-local' } }

let dir: string
afterEach(() => rmSync(dir, { recursive: true, force: true }))

interface Project {
  options?: unknown
  files: Record<string, string>
}

/** A temp project whose tsconfig lists the built mapper for `.pgrst-index`; returns tsc's verdict. */
function check({ options = OPTIONS, files }: Project) {
  if (!existsSync(join(PACKAGE_DIR, 'dist', 'main', 'content-mapper', 'index.js'))) {
    throw new Error('dist is missing: run `pnpm nx build postgrest-mapper` first')
  }
  dir = mkdtempSync(join(realpathSync(tmpdir()), 'postgrest-mapper-e2e-'))
  const link = join(dir, 'node_modules', '@supabase', 'postgrest-mapper')
  mkdirSync(dirname(link), { recursive: true })
  symlinkSync(PACKAGE_DIR, link, 'dir')
  writeFileSync(
    join(dir, 'tsconfig.json'),
    JSON.stringify({
      compilerOptions: {
        strict: true,
        noEmit: true,
        module: 'esnext',
        moduleResolution: 'bundler',
        target: 'es2022',
      },
      include: ['src'],
      contentMappers: [
        { package: '@supabase/postgrest-mapper', extensions: ['.pgrst-index'], options },
      ],
    })
  )
  for (const [name, text] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, name)), { recursive: true })
    writeFileSync(join(dir, name), text)
  }
  const run = spawnSync(
    process.execPath,
    [TSC, '--runExternalCode', '--noEmit', '--pretty', 'false', '-p', '.'],
    {
      cwd: dir,
      encoding: 'utf8',
      timeout: 60_000,
    }
  )
  return { status: run.status, output: `${run.stdout}${run.stderr}`.replaceAll(dir, '<dir>') }
}

const INDEX = {
  'src/supabase.pgrst-index': '# Types are generated here. This content is ignored.\n',
}

describe('tsc 7.1 with the content mapper', () => {
  it('types code against the global the mapper declares', () => {
    const result = check({
      files: {
        ...INDEX,
        'src/app.ts': [
          "type Stub = SupabaseSelects['r|public|stub|*']",
          'export const row: Stub["row"] = { id: 1, postgrest: "14.4" }',
          'export const id: number = row.id',
        ].join('\n'),
      },
    })
    expect(result).toEqual({ status: 0, output: '' })
  })

  it('reports a mismatch against the declared type in the user file', () => {
    const result = check({
      files: {
        ...INDEX,
        'src/app.ts': [
          "type Stub = SupabaseSelects['r|public|stub|*']",
          'declare const row: Stub["row"]',
          'export const id: string = row.id',
        ].join('\n'),
      },
    })
    expect(result.status).toBe(2)
    expect(result.output).toContain(
      "src/app.ts(3,14): error TS2322: Type 'number' is not assignable to type 'string'."
    )
  })

  it('reports invalid options at the tsconfig value', () => {
    const result = check({
      options: { ...OPTIONS, postgrest: 'latest', extra: 1 },
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

  it('flags a second index file', () => {
    const result = check({ files: { ...INDEX, 'src/other.pgrst-index': '# second\n' } })
    expect(result.status).toBe(2)
    // which of the two is "second" depends on the order TypeScript transforms them in
    expect(result.output).toMatch(
      /src\/(supabase|other)\.pgrst-index\(1,1\): error postgrest-mapper2001: Only one index file/
    )
  })
})
