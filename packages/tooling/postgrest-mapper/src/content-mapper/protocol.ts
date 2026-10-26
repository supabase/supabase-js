/**
 * The TypeScript 7.1 content-mapper wire protocol (microsoft/typescript-go#4712): JSON-RPC 2.0 over stdio.
 * TypeScript sends every request; a mapper never sends requests or notifications.
 */

export type PositionEncoding = 'utf-8' | 'utf-16'

export interface InitializeParams {
  positionEncodings: PositionEncoding[]
  locale?: string
}

export interface InitializeResult {
  positionEncoding: PositionEncoding
  /** Shown for mapper-produced diagnostics. Must not be `ts`, `tsc`, `typescript` or a file extension. */
  diagnosticSource: string
}

/** The project's effective compiler options, as TypeScript serialises them. */
export type CompilerOptions = Record<string, unknown>

export interface OpenProjectParams {
  /** Absolute tsconfig path, or an empty string for a project without a config file. */
  configFileName: string
  /** Opaque, process-local handle assigned by TypeScript. */
  projectHandle: string
  /** The `options` object of the tsconfig `contentMappers` entry. */
  options?: Record<string, unknown>
  compilerOptions: CompilerOptions
}

export interface OptionDiagnostic {
  /** Property names and array indexes relative to the `options` object; empty for the object itself. */
  path: (string | number)[]
  messageText: string
  code: number
}

export interface OpenProjectResult {
  /** Required because the package declares `dynamicConfig: true`. */
  configIdentity: string
  /** Absolute paths, never the transformed files. */
  watchedFiles?: string[]
  optionDiagnostics?: OptionDiagnostic[]
}

export interface TransformParams {
  fileName: string
  content: string
  projectHandle: string
}

/** Positions and lengths are in the negotiated `positionEncoding`, relative to the original content. */
export interface MapperDiagnostic {
  messageText: string
  start: number
  length: number
  code: number
}

export interface TransformResult {
  text: string
  extension: '.ts'
  /** Empty: the whole virtual module is synthesized, so TypeScript reports its diagnostics at the file's top. */
  mappings: []
  diagnostics?: MapperDiagnostic[]
}

export interface CloseProjectParams {
  projectHandle: string
}
