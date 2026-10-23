import {
  Accumulator,
  FileScanner,
  compareLocations,
  operandRequestKey,
  selectRequestKey,
} from './scanner'
import type { ScanOptions, ScanResult, SourceFile, SourceLocation } from './types'

export type {
  FallbackPair,
  FileScan,
  FunctionTarget,
  OperandRequest,
  PlanTarget,
  RelationTarget,
  RpcMethod,
  ScanOptions,
  ScanResult,
  SchemaScope,
  SelectRequest,
  SourceFile,
  SourceLocation,
  UnresolvedUse,
} from './types'
export {
  COLUMN_METHODS,
  FALLBACK_PAIR_LIMIT,
  MATCH_METHODS,
  MAX_RESOLVED_VALUES,
  MUTATION_METHODS,
  REFERENCED_TABLE_METHODS,
} from './methods'
export { operandKey, requestKeys, selectKey } from './keys'
export { jsonSchemaToTs } from './jsonschema'
export type { JsonSchemaToTsOptions } from './jsonschema'
export {
  createContentMapperServer,
  createStreamLogger,
  DEBUG_ENV,
  DIAGNOSTIC_SOURCE,
  DiagnosticCode,
  encodeFrame,
  FrameReader,
  hashOptions,
  stubGenerator,
  validateOptions,
} from './content-mapper'
export type {
  CompilerOptions,
  ContentMapperLogger,
  ContentMapperServer,
  ContentMapperServerOptions,
  GenerateProjectParams,
  GenerateProjectResult,
  InitializeParams,
  InitializeResult,
  MapperDiagnostic,
  OpenProjectParams,
  OpenProjectResult,
  OptionDiagnostic,
  OptionsValidation,
  PositionEncoding,
  PostgrestMapperOptions,
  ProjectGenerator,
  SchemaSourceOptions,
  TransformParams,
  TransformResult,
} from './content-mapper'
export { createTracer } from './tracer'
export type {
  CatalogColumn,
  CatalogRelation,
  ColumnSource,
  TraceCatalog,
  TraceInput,
  TraceResult,
  TracedColumn,
  Tracer,
  TracerOptions,
} from './tracer'

function byKey<T>(items: Iterable<T>, key: (item: T) => string): T[] {
  return [...items].sort((a, b) => {
    const ka = key(a)
    const kb = key(b)
    return ka < kb ? -1 : ka > kb ? 1 : 0
  })
}

function finish(acc: Accumulator): ScanResult {
  const sortLocations = <T extends { locations: SourceLocation[] }>(items: T[]): T[] => {
    for (const item of items) item.locations.sort(compareLocations)
    return items
  }
  return {
    selects: sortLocations(byKey(acc.selects.values(), selectRequestKey)),
    operands: sortLocations(byKey(acc.operands.values(), operandRequestKey)),
    fallbacks: sortLocations(
      byKey(acc.fallbacks.values(), (f) => JSON.stringify([f.select, f.target, f.schemas]))
    ),
    unresolved: [...acc.unresolved.values()].sort(
      (a, b) => compareLocations(a.location, b.location) || (a.what < b.what ? -1 : 1)
    ),
    files: [...acc.files].sort((a, b) => (a.fileName < b.fileName ? -1 : 1)),
  }
}

function scanInto(acc: Accumulator, file: SourceFile, options: ScanOptions): void {
  new FileScanner(acc, file.fileName, file.sourceText, options).scan(file.sourceText)
}

/** Scans one file. Syntax only: nothing is read from disk and nothing is type-checked. */
export function scanSource(
  fileName: string,
  sourceText: string,
  options: ScanOptions = {}
): ScanResult {
  const acc = new Accumulator()
  scanInto(acc, { fileName, sourceText }, options)
  return finish(acc)
}

/**
 * Scans several files into one deduplicated result. The result is independent of the order of `files`; a request
 * found in several files lists every location.
 */
export function scanFiles(files: Iterable<SourceFile>, options: ScanOptions = {}): ScanResult {
  const acc = new Accumulator()
  for (const file of files) scanInto(acc, file, options)
  return finish(acc)
}

export {
  DEFAULT_POSTGREST_IMAGE,
  MAX_DIFFERENCES,
  SNAPSHOT_FORMAT,
  SUPPLEMENTARY_FORMAT,
  SUPPLEMENTARY_SQL,
  SchemaAcquisitionError,
  acquireSchema,
  acquireSupplementary,
  buildFunctionTraceInputs,
  buildJsonSchemaInput,
  buildTraceCatalog,
  checkSnapshot,
  configEnvName,
  connectPg,
  containerDbUrl,
  createScrubber,
  exposedSchemas,
  nodeExec,
  parseConfigDump,
  parseSnapshot,
  parseVersion,
  plannerSupplementary,
  querySupplementary,
  readPgVersionNum,
  readSnapshot,
  redactConfig,
  schemaFromSnapshot,
  serializeSnapshot,
  snapshotFromSchema,
  withReadOnlyTransaction,
  writeSnapshot,
} from './schema'
export type {
  AcquiredSchema,
  BuildJsonSchemaOptions,
  BuildTraceCatalogOptions,
  DbClient,
  DbConnection,
  ExecFn,
  ExecOptions,
  ExecResult,
  IgnoredJsonSchemaCheck,
  JsonSchemaColumn,
  JsonSchemaInput,
  PlannerSupplementary,
  RelationKind,
  SchemaDeps,
  SchemaErrorCode,
  SchemaFs,
  SchemaLogger,
  SchemaSource,
  Snapshot,
  SnapshotCheck,
  SnapshotDifference,
  Supplementary,
  SupplementaryColumn,
  SupplementaryEnum,
  SupplementaryFunction,
  SupplementaryJsonSchemaCheck,
  SupplementaryRelation,
  WriteSnapshotResult,
} from './schema'
