import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { writeSnapshot, type AcquiredSchema } from '../../src'

export interface TempProject {
  dir: string
  configFileName: string
  /** Absolute path of the snapshot written for the project */
  snapshotPath: string
  /** `schema.source: 'snapshot'` options for the project */
  options: { postgrest: string; schema: { source: 'snapshot'; path: string } }
  write(name: string, text: string): void
  remove(): void
}

/**
 * A temp project with a `tsconfig.json`, the sources in `files` and `schema.snapshot.json` holding `acquired`.
 * Everything the generator reads is under `dir`, so tests never touch the repository.
 */
export async function createTempProject(
  acquired: AcquiredSchema,
  files: Record<string, string>,
  postgrest = '16.4'
): Promise<TempProject> {
  const dir = mkdtempSync(join(realpathSync(tmpdir()), 'postgrest-mapper-project-'))
  const write = (name: string, text: string): void => {
    mkdirSync(dirname(join(dir, name)), { recursive: true })
    writeFileSync(join(dir, name), text)
  }
  write(
    'tsconfig.json',
    JSON.stringify({ compilerOptions: { strict: true, noEmit: true }, include: ['src'] })
  )
  for (const [name, text] of Object.entries(files)) write(name, text)
  const snapshotPath = join(dir, 'schema.snapshot.json')
  await writeSnapshot(snapshotPath, acquired)
  return {
    dir,
    configFileName: join(dir, 'tsconfig.json'),
    snapshotPath,
    options: { postgrest, schema: { source: 'snapshot', path: 'schema.snapshot.json' } },
    write,
    remove: () => rmSync(dir, { recursive: true, force: true }),
  }
}
