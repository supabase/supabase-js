import { randomUUID } from 'node:crypto'
import { join, resolve } from 'node:path'
import { REFRESH_STAMP, cacheDirectoryOf, createGenerator, refreshStampOf } from '../generate'
import { projectDirOf, readMapperConfig } from './config'
import { generateWith, writeIfChanged } from './generate'
import { resolveDeps, type GenerateResult, type OperationDeps, type ProjectInput } from './types'

export interface RefreshInput extends ProjectInput {
  /** Where to write the declarations after regenerating, absolute or relative to `cwd` */
  out?: string
}

export interface RefreshResult extends GenerateResult {
  /** Absolute path of the cache directory that was cleared; undefined when the cache is turned off */
  cleared: string | undefined
  /** Absolute path of the output, when `input.out` was given and generation succeeded */
  out?: string
  /** Whether the output was written (false: it already held the text) */
  changed?: boolean
}

/**
 * Drops what the generator remembers about the project and regenerates: the plan cache is emptied and the refresh
 * stamp gets new content, which makes every other generator of the project (a content mapper server, `watch`)
 * acquire its live schema again. With `input.out` the declarations are written there.
 */
export async function refresh(
  deps: OperationDeps,
  input: RefreshInput = {}
): Promise<RefreshResult> {
  const resolved = resolveDeps(deps)
  const config = await readMapperConfig(resolved, input)
  const cacheDirectory =
    resolved.cacheDirectory === false
      ? undefined
      : (resolved.cacheDirectory ?? cacheDirectoryOf)(projectDirOf(config))
  if (cacheDirectory !== undefined) {
    const entries = await resolved.fs.readdir(cacheDirectory).catch(() => [])
    for (const entry of entries) {
      // the stamp is rewritten, not removed: a watcher on it must see a change, not a creation
      if (entry.name !== REFRESH_STAMP) await resolved.fs.rm(join(cacheDirectory, entry.name))
    }
    await resolved.fs.mkdir(cacheDirectory)
    await resolved.fs.writeFile(refreshStampOf(cacheDirectory), `${randomUUID()}\n`)
  }
  const generator = createGenerator(resolved)
  try {
    const result = await generateWith(resolved, input, generator)
    if (input.out === undefined || !result.ok) return { ...result, cleared: cacheDirectory }
    const out = resolve(resolved.cwd, input.out)
    const changed = await writeIfChanged(resolved.fs, out, result.text)
    return { ...result, cleared: cacheDirectory, out, changed }
  } finally {
    await generator.close()
  }
}
