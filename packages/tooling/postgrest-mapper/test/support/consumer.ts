import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'

const POSTGREST_JS_SRC = resolve(__dirname, '../../../../core/postgrest-js/src/index.ts')
// the workspace TypeScript (the `typescript` catalog entry), not the 7.1 beta the content mapper tests run
const TSC = require.resolve('typescript/bin/tsc')

export interface ConsumerProject {
  /** Files by relative path: the generated declarations, `.ts` consumers */
  files: Record<string, string>
}

export interface ConsumerResult {
  /** Diagnostics by file (relative path), `TS2322: ...` per entry; files without any are absent */
  byFile: Map<string, string[]>
  /** Everything tsc printed, for failure messages */
  output: string
}

/** Test-only helpers shared by `Equal` assertions in the consumer files */
export const TYPE_HELPERS = `export type Equal<X, Y> =
  (<T>() => T extends X ? 1 : 2) extends <T>() => T extends Y ? 1 : 2 ? true : false
export type Expect<T extends true> = T
`

/**
 * Type-checks a temp project with the workspace TypeScript, strict, importing postgrest-js `src` through `paths`
 * (the declarations `import type { SupabaseColumnType } from '@supabase/postgrest-js'`). Every file is a root, so
 * the globals the declarations augment are visible to every consumer; each project is one tsc run.
 */
export function typecheckConsumer(project: ConsumerProject): ConsumerResult {
  const dir = mkdtempSync(join(realpathSync(tmpdir()), 'postgrest-mapper-consumer-'))
  try {
    writeFileSync(
      join(dir, 'tsconfig.json'),
      JSON.stringify({
        compilerOptions: {
          strict: true,
          noEmit: true,
          target: 'ES2022',
          module: 'ESNext',
          moduleResolution: 'bundler',
          lib: ['ES2022', 'DOM'],
          types: [],
          // declaration files are checked too: the emitted module has to be sound on its own
          skipLibCheck: false,
          paths: { '@supabase/postgrest-js': [POSTGREST_JS_SRC] },
        },
        files: Object.keys(project.files),
      })
    )
    for (const [name, text] of Object.entries(project.files)) {
      mkdirSync(dirname(join(dir, name)), { recursive: true })
      writeFileSync(join(dir, name), text)
    }
    const run = spawnSync(process.execPath, [TSC, '--pretty', 'false', '-p', '.'], {
      cwd: dir,
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
    })
    const output = `${run.stdout}${run.stderr}`
    const byFile = new Map<string, string[]>()
    for (const line of output.split('\n')) {
      const match = /^(.+?)\((\d+),(\d+)\): error (TS\d+): (.*)$/.exec(line)
      if (!match) continue
      const file = match[1]!
      const list = byFile.get(file) ?? []
      list.push(`${file}:${match[2]} ${match[4]}: ${match[5]}`)
      byFile.set(file, list)
    }
    if (run.status !== 0 && byFile.size === 0) {
      throw new Error(`tsc failed without diagnostics (status ${run.status}):\n${output}`)
    }
    return { byFile, output }
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}
