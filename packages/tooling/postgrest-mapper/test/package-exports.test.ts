import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

const packageDir = join(__dirname, '..')

/** Runs `code` as an ES module in a fresh node process whose package is this one (so its own name resolves). */
function runModule(code: string): { status: number | null; stdout: string; stderr: string } {
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', code], {
    cwd: packageDir,
    encoding: 'utf8',
  })
  return { status: result.status, stdout: result.stdout, stderr: result.stderr }
}

describe('the package entry', () => {
  // the entry is the built output, like the bin tests: `nx build postgrest-mapper` first
  const built = existsSync(join(packageDir, 'dist', 'main', 'index.js'))
  const itBuilt = built ? it : it.skip

  itBuilt('is importable by name from native ESM', () => {
    const run = runModule(`
      import { generateDeclarations, scanSource } from '@supabase/postgrest-mapper'
      console.log(typeof generateDeclarations, typeof scanSource)
    `)
    expect(run.stderr).toBe('')
    expect(run.stdout.trim()).toBe('function function')
    expect(run.status).toBe(0)
  })

  itBuilt('is requirable by name from CommonJS', () => {
    const result = spawnSync(
      process.execPath,
      ['-e', `console.log(typeof require('@supabase/postgrest-mapper').generateDeclarations)`],
      { cwd: packageDir, encoding: 'utf8' }
    )
    expect(result.stdout.trim()).toBe('function')
  })
})
