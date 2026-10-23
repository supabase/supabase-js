import { dirname, resolve } from 'node:path'
import { createGenerator, generateFrom, type Generator } from '../generate'
import { locateOptionDiagnostic, readMapperConfig } from './config'
import {
  resolveDeps,
  type GenerateResult,
  type LocatedDiagnostic,
  type OperationDeps,
  type OperationFs,
  type ProjectInput,
  type ResolvedDeps,
} from './types'

/** One run of the generate pipeline on a generator the caller keeps (`watch` reuses its planner and live schema). */
export async function generateWith(
  deps: ResolvedDeps,
  input: ProjectInput,
  generator: Generator
): Promise<GenerateResult> {
  const config = await readMapperConfig(deps, input)
  const output = await generateFrom(generator, {
    configFileName: config.configFileName,
    options: config.options,
  })
  const diagnostics: LocatedDiagnostic[] = [
    ...output.optionDiagnostics.map((diagnostic) => locateOptionDiagnostic(config, diagnostic)),
    ...output.diagnostics.map((diagnostic) => ({
      file: config.configFileName,
      line: 1,
      column: 1,
      code: diagnostic.code,
      message: diagnostic.messageText,
    })),
  ]
  return {
    ok: diagnostics.length === 0,
    configFileName: config.configFileName,
    text: output.text,
    diagnostics,
    warnings: output.warnings,
    watchedFiles: [...output.watchedFiles, config.configFileName],
    cache: output.cache,
    identity: output.identity,
  }
}

/**
 * Generates the declarations of the project in the tsconfig `input.project` (default `tsconfig.json`): reads its
 * `contentMappers` entry for `.pgrst-index`, runs the pipeline and returns the text with every diagnostic located.
 * Throws `OperationError` when the tsconfig cannot be read or has no entry. The planner is stopped before it returns.
 */
export async function generate(
  deps: OperationDeps,
  input: ProjectInput = {}
): Promise<GenerateResult> {
  const resolved = resolveDeps(deps)
  const generator = createGenerator(resolved)
  try {
    return await generateWith(resolved, input, generator)
  } finally {
    await generator.close()
  }
}

export interface WriteInput extends ProjectInput {
  /** The declaration file, absolute or relative to `cwd` */
  out: string
}

export interface WriteResult extends GenerateResult {
  /** Absolute path of the output */
  out: string
  /** Whether the file was written; false when it already held the text or when generation failed (nothing is written) */
  changed: boolean
}

/** Writes `text` to `path` (creating its directory) unless the file already holds it. */
export async function writeIfChanged(
  fs: Pick<OperationFs, 'readFile' | 'writeFile' | 'mkdir'>,
  path: string,
  text: string
): Promise<boolean> {
  const existing = await fs.readFile(path).catch(() => undefined)
  if (existing === text) return false
  await fs.mkdir(dirname(path))
  await fs.writeFile(path, text)
  return true
}

/** `generate`, then the declarations are written to `input.out` when the file differs. Nothing is written on diagnostics. */
export async function writeWith(
  deps: ResolvedDeps,
  input: WriteInput,
  generator: Generator
): Promise<WriteResult> {
  const out = resolve(deps.cwd, input.out)
  const result = await generateWith(deps, input, generator)
  const changed = result.ok ? await writeIfChanged(deps.fs, out, result.text) : false
  return { ...result, out, changed }
}

export async function write(deps: OperationDeps, input: WriteInput): Promise<WriteResult> {
  const resolved = resolveDeps(deps)
  const generator = createGenerator(resolved)
  try {
    return await writeWith(resolved, input, generator)
  } finally {
    await generator.close()
  }
}

export type CheckStatus = 'up-to-date' | 'missing' | 'stale' | 'failed'

export interface CheckResult extends GenerateResult {
  /** Absolute path of the output */
  out: string
  /** `failed`: generation reported diagnostics and nothing was compared */
  status: CheckStatus
  /** For `stale`: the first differing lines, `  <line>: - <current>` and `  <line>: + <generated>` */
  drift: string[]
}

const MAX_SHOWN = 5

/** A short summary of how `current` differs from `next`: the first differing lines. */
export function summarizeDrift(current: string, next: string): string[] {
  const a = current.split('\n')
  const b = next.split('\n')
  const lines: string[] = []
  let differing = 0
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if (a[i] === b[i]) continue
    differing++
    if (differing > MAX_SHOWN) continue
    if (a[i] !== undefined) lines.push(`  ${i + 1}: - ${a[i]}`)
    if (b[i] !== undefined) lines.push(`  ${i + 1}: + ${b[i]}`)
  }
  if (differing > MAX_SHOWN) lines.push(`  ... and ${differing - MAX_SHOWN} more differing line(s)`)
  return lines
}

/** `generate`, then the declarations are compared with `input.out`; nothing is ever written. */
export async function check(deps: OperationDeps, input: WriteInput): Promise<CheckResult> {
  const resolved = resolveDeps(deps)
  const out = resolve(resolved.cwd, input.out)
  const result = await generate(deps, input)
  if (!result.ok) return { ...result, out, status: 'failed', drift: [] }
  const existing = await resolved.fs.readFile(out).catch(() => undefined)
  if (existing === result.text) return { ...result, out, status: 'up-to-date', drift: [] }
  if (existing === undefined) return { ...result, out, status: 'missing', drift: [] }
  return { ...result, out, status: 'stale', drift: summarizeDrift(existing, result.text) }
}
