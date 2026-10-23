/**
 * What the `postgrest-mapper` commands do, as functions: every one takes its I/O (file system, environment, planner,
 * schema sources, watcher, clock, logger) as `OperationDeps` and returns a structured result. The command line only
 * parses arguments and presents these results.
 */
export { check, generate, summarizeDrift, write, writeIfChanged } from './generate'
export type { CheckResult, CheckStatus, WriteInput, WriteResult } from './generate'
export { init, DEFAULT_INDEX, DEFAULT_OUT, DEFAULT_SNAPSHOT, entryCovers } from './init'
export type { InitChange, InitInput, InitResult } from './init'
export { refresh } from './refresh'
export type { RefreshInput, RefreshResult } from './refresh'
export { snapshot } from './snapshot'
export type { SnapshotInput, SnapshotResult } from './snapshot'
export { nodeClock, nodeMtime, nodeWatch, watch, watchLoop } from './watch'
export type { WatchDeps, WatchEvent, WatchLoopOptions, WatchOptions } from './watch'
export { addToStringArray, parseJsonc } from './jsonc'
export { INDEX_EXTENSION, display, messageOf } from './config'
export { OperationError, nodeOperationFs, resolveDeps } from './types'
export type {
  Clock,
  GenerateResult,
  LocatedDiagnostic,
  MtimeFn,
  OperationDeps,
  OperationErrorCode,
  OperationFs,
  ProjectInput,
  ResolvedDeps,
  SchemaOverrides,
  WatchFn,
  WatchHandle,
} from './types'
