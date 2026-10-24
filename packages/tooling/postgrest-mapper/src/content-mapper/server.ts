import { encodeFrame, FrameReader } from './framing'
import type { GenerateProjectResult, ProjectGenerator } from './generator'
import type { ContentMapperLogger } from './logger'
import { DiagnosticCode, validateOptions } from './options'
import type {
  CloseProjectParams,
  InitializeParams,
  InitializeResult,
  MapperDiagnostic,
  OpenProjectParams,
  OpenProjectResult,
  PositionEncoding,
  TransformParams,
  TransformResult,
} from './protocol'
import { hashOptions } from './hash'

export interface ContentMapperServerOptions {
  /** Frames from TypeScript (the process's stdin). */
  input: NodeJS.ReadableStream
  /** Frames to TypeScript (the process's stdout). Nothing else may write to it. */
  output: NodeJS.WritableStream
  logger: ContentMapperLogger
  generator: ProjectGenerator
}

export interface ContentMapperServer {
  /** Settles once input ended, `exit` arrived or `close()` was called, and the requests in flight are answered. */
  readonly closed: Promise<void>
  close(): void
}

/** Shown in diagnostics as the source; must not be `ts`, `tsc`, `typescript` or a file extension. */
export const DIAGNOSTIC_SOURCE = 'postgrest-mapper'

const ErrorCode = {
  ParseError: -32700,
  InvalidRequest: -32600,
  MethodNotFound: -32601,
  InvalidParams: -32602,
  InternalError: -32603,
  ServerNotInitialized: -32002,
} as const

class RpcError extends Error {
  constructor(
    readonly code: number,
    message: string
  ) {
    super(message)
  }
}

interface ProjectState {
  text: string
  diagnostics: readonly MapperDiagnostic[]
  /** The first file TypeScript transformed for this project. A second one is a duplicate. */
  indexFileName?: string
}

const EMPTY_MODULE = 'export {}\n'

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

function params<T>(
  value: unknown,
  check: (record: Record<string, unknown>) => string | undefined
): T {
  if (!isRecord(value)) throw new RpcError(ErrorCode.InvalidParams, 'params must be an object')
  const problem = check(value)
  if (problem) throw new RpcError(ErrorCode.InvalidParams, problem)
  return value as unknown as T
}

function firstLineLength(content: string, encoding: PositionEncoding): number {
  const line = content.split(/\r\n|\r|\n/, 1)[0] ?? ''
  return encoding === 'utf-8' ? Buffer.byteLength(line, 'utf8') : line.length
}

/**
 * A TypeScript content mapper over JSON-RPC with `Content-Length` framing. It owns the protocol and the
 * per-project state; the generator owns everything else.
 */
export function createContentMapperServer(
  options: ContentMapperServerOptions
): ContentMapperServer {
  const { input, output, logger, generator } = options
  const projects = new Map<string, ProjectState>()
  const inFlight = new Set<Promise<void>>()
  let encoding: PositionEncoding | undefined
  let stopped = false // no more input is read
  let finished = false // no more output is written
  let resolveStopped!: () => void
  const stoppedSignal = new Promise<void>((resolve) => (resolveStopped = resolve))

  const send = (message: unknown) => {
    if (finished) return
    const frame = encodeFrame(message)
    logger.debug(`-> ${frame.subarray(frame.indexOf('\r\n\r\n') + 4).toString('utf8')}`)
    output.write(frame)
  }
  const respond = (id: unknown, result: unknown) => send({ jsonrpc: '2.0', id, result })
  const fail = (id: unknown, code: number, message: string) =>
    send({ jsonrpc: '2.0', id, error: { code, message } })

  const stop = () => {
    if (stopped) return
    resolveStopped()
    stopped = true
    input.removeListener('data', onData)
    input.removeListener('end', stop)
    input.removeListener('close', stop)
    ;(input as { destroy?: () => void }).destroy?.()
  }

  const initialize = (raw: unknown): InitializeResult => {
    const p = params<InitializeParams>(raw, (r) =>
      Array.isArray(r.positionEncodings) ? undefined : 'positionEncodings must be an array'
    )
    const chosen = (['utf-16', 'utf-8'] as const).find((e) => p.positionEncodings.includes(e))
    if (!chosen) {
      throw new RpcError(ErrorCode.InvalidParams, 'no supported position encoding (utf-16, utf-8)')
    }
    encoding = chosen
    return { positionEncoding: chosen, diagnosticSource: DIAGNOSTIC_SOURCE }
  }

  const openProject = async (raw: unknown): Promise<OpenProjectResult> => {
    const p = params<OpenProjectParams>(raw, (r) =>
      typeof r.projectHandle !== 'string' || r.projectHandle === ''
        ? 'projectHandle must be a non-empty string'
        : typeof r.configFileName !== 'string'
          ? 'configFileName must be a string'
          : r.options !== undefined && r.options !== null && !isRecord(r.options)
            ? 'options must be an object'
            : r.compilerOptions !== undefined && !isRecord(r.compilerOptions)
              ? 'compilerOptions must be an object'
              : undefined
    )
    // A reopened handle starts from scratch, whatever happens below.
    projects.delete(p.projectHandle)
    const rawOptions = p.options ?? {}
    const validation = validateOptions(rawOptions)
    if (!validation.ok) {
      generator.closeProject?.(p.projectHandle)
      projects.set(p.projectHandle, { text: EMPTY_MODULE, diagnostics: [] })
      return {
        configIdentity: hashOptions(rawOptions),
        watchedFiles: [],
        optionDiagnostics: validation.diagnostics,
      }
    }
    let generated: GenerateProjectResult
    try {
      generated = await generator({
        configFileName: p.configFileName,
        projectHandle: p.projectHandle,
        options: validation.options,
        compilerOptions: p.compilerOptions ?? {},
      })
    } catch (error) {
      logger.error(`generator failed for ${p.configFileName || '(no config file)'}`, error)
      // it may have taken the live-schema hold before failing, and no project is left to close it
      generator.closeProject?.(p.projectHandle)
      throw new RpcError(
        ErrorCode.InternalError,
        `generator failed: ${error instanceof Error ? error.message : String(error)}`
      )
    }
    projects.set(p.projectHandle, { text: generated.text, diagnostics: generated.diagnostics })
    return {
      configIdentity: generated.identity,
      watchedFiles: [...generated.watchedFiles],
      optionDiagnostics: [...generated.optionDiagnostics],
    }
  }

  const transform = (raw: unknown): TransformResult => {
    const p = params<TransformParams>(raw, (r) =>
      typeof r.projectHandle !== 'string'
        ? 'projectHandle must be a string'
        : typeof r.fileName !== 'string'
          ? 'fileName must be a string'
          : typeof r.content !== 'string'
            ? 'content must be a string'
            : undefined
    )
    const project = projects.get(p.projectHandle)
    if (!project) {
      throw new RpcError(ErrorCode.InvalidParams, `unknown projectHandle '${p.projectHandle}'`)
    }
    project.indexFileName ??= p.fileName
    if (project.indexFileName !== p.fileName) {
      return {
        text: EMPTY_MODULE,
        extension: '.ts',
        mappings: [],
        diagnostics: [
          {
            messageText: `Only one index file is allowed per project; '${project.indexFileName}' is already the index file.`,
            start: 0,
            length: firstLineLength(p.content, encoding ?? 'utf-16'),
            code: DiagnosticCode.DuplicateIndexFile,
          },
        ],
      }
    }
    return {
      text: project.text,
      extension: '.ts',
      mappings: [],
      diagnostics: [...project.diagnostics],
    }
  }

  const closeProject = (raw: unknown): null => {
    const p = params<CloseProjectParams>(raw, (r) =>
      typeof r.projectHandle !== 'string' ? 'projectHandle must be a string' : undefined
    )
    projects.delete(p.projectHandle)
    generator.closeProject?.(p.projectHandle)
    return null
  }

  const requireInitialized = () => {
    if (!encoding)
      throw new RpcError(ErrorCode.ServerNotInitialized, 'initialize has not been called')
  }

  const dispatch = async (method: string, raw: unknown): Promise<unknown> => {
    switch (method) {
      case 'initialize':
        return initialize(raw)
      case 'openProject':
        requireInitialized()
        return openProject(raw)
      case 'transform':
        requireInitialized()
        return transform(raw)
      case 'closeProject':
        return closeProject(raw)
      case 'shutdown':
        return null
      case 'exit':
        stop()
        return undefined
      default:
        throw new RpcError(ErrorCode.MethodNotFound, `method not found: ${method}`)
    }
  }

  const handle = async (body: string): Promise<void> => {
    logger.debug(`<- ${body}`)
    let message: unknown
    try {
      message = JSON.parse(body)
    } catch {
      return fail(null, ErrorCode.ParseError, 'invalid JSON')
    }
    if (!isRecord(message) || typeof message.method !== 'string') {
      // A response to a request we never sent is ignored; anything else is not a request.
      if (isRecord(message) && ('result' in message || 'error' in message)) return
      return fail(
        isRecord(message) && 'id' in message ? message.id : null,
        ErrorCode.InvalidRequest,
        'not a JSON-RPC request'
      )
    }
    const isRequest = 'id' in message
    try {
      const result = await dispatch(message.method, message.params)
      if (isRequest) respond(message.id, result === undefined ? null : result)
    } catch (error) {
      if (error instanceof RpcError) {
        if (isRequest) fail(message.id, error.code, error.message)
        else logger.error(`notification '${message.method}' failed: ${error.message}`)
        return
      }
      logger.error(`unexpected failure in '${message.method}'`, error)
      if (isRequest) fail(message.id, ErrorCode.InternalError, 'internal error')
    }
  }

  const reader = new FrameReader(
    (body) => {
      if (stopped) return
      const task = handle(body).catch((error) => logger.error('failed to answer a request', error))
      inFlight.add(task)
      void task.finally(() => inFlight.delete(task))
    },
    (reason) => logger.error(reason)
  )
  const onData = (chunk: Buffer | string) => {
    if (!stopped) reader.push(chunk)
  }

  input.on('data', onData)
  input.on('end', stop)
  input.on('close', stop)
  input.on('error', (error) => {
    logger.error('input failed', error)
    stop()
  })
  output.on('error', (error) => logger.error('output failed', error))

  const closed = stoppedSignal.then(async () => {
    await Promise.allSettled([...inFlight])
    finished = true
    for (const handle of projects.keys()) generator.closeProject?.(handle)
    projects.clear()
  })
  return { closed, close: stop }
}
