import type { CompilerOptions, MapperDiagnostic, OptionDiagnostic } from './protocol'
import type { PostgrestMapperOptions } from './options'

export interface GenerateProjectParams {
  /** Absolute tsconfig path, or an empty string for a project without a config file. */
  configFileName: string
  /** Opaque, process-local handle assigned by TypeScript. Several projects can be open at once. */
  projectHandle: string
  /** The validated `contentMappers[].options` object. */
  options: PostgrestMapperOptions
  compilerOptions: CompilerOptions
}

export interface GenerateProjectResult {
  /**
   * Fingerprint of everything that can change `text`. TypeScript re-transforms the index file only when it
   * changes, so it must cover the output (design v4 §5.2), not just the inputs.
   */
  identity: string
  /** Absolute paths whose change must re-run `openProject`. Never the index file itself. */
  watchedFiles: readonly string[]
  /** The virtual module (TypeScript source) that `transform` returns for the index file. */
  text: string
  /** Problems to show on the index file. Positions are relative to the index file's original content. */
  diagnostics: readonly MapperDiagnostic[]
  /** Problems with the option values the shape check cannot see (for example a missing snapshot file). */
  optionDiagnostics: readonly OptionDiagnostic[]
}

/**
 * Does all the work of `openProject`: scanning, planning, printing. The server calls it once per `openProject`
 * and only stores the result; `transform` never calls it.
 *
 * A generator is shared by every project the process serves and may be called concurrently. It owns any cache
 * that should outlive `closeProject` (a loaded schema, plan memos): the server drops its per-project state on
 * `closeProject` and never touches the generator's caches.
 */
export type ProjectGenerator = ((
  params: GenerateProjectParams
) => Promise<GenerateProjectResult>) & {
  /**
   * The server calls it when a project is closed (or reopened with options the generator is not asked about): what
   * the generator keeps running for the handle, like the watch on a live schema, stops.
   */
  closeProject?(projectHandle: string): void
}
