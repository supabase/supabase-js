import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { PassThrough } from 'node:stream'
import {
  createContentMapperServer,
  createStreamLogger,
  DiagnosticCode,
  encodeFrame,
  hashOptions,
  stubGenerator,
  type ContentMapperServer,
  type ProjectGenerator,
} from '../src'
import { INITIALIZE, RpcClient, STUB_OPTIONS } from './support/rpc-client'

const silent = { debug() {}, error() {} }
const INDEX = '/p/src/supabase.pgrst-index'

interface Harness {
  client: RpcClient
  server: ContentMapperServer
  toServer: PassThrough
  fromServer: PassThrough
  errors: string[]
}

function start(generator: ProjectGenerator = stubGenerator): Harness {
  const toServer = new PassThrough()
  const fromServer = new PassThrough()
  const errors: string[] = []
  const server = createContentMapperServer({
    input: toServer,
    output: fromServer,
    logger: { debug() {}, error: (message) => errors.push(message) },
    generator,
  })
  return { client: new RpcClient(toServer, fromServer), server, toServer, fromServer, errors }
}

async function open(
  client: RpcClient,
  projectHandle = 'h1',
  options: unknown = STUB_OPTIONS,
  configFileName = '/p/tsconfig.json'
) {
  return client.request('openProject', {
    configFileName,
    projectHandle,
    options,
    compilerOptions: { strict: true },
  })
}

describe('content mapper protocol (in memory)', () => {
  it('serves initialize, openProject, transform and closeProject', async () => {
    const { client, server } = start()

    const init = await client.request('initialize', INITIALIZE)
    expect(init.result).toEqual({
      positionEncoding: 'utf-16',
      diagnosticSource: 'postgrest-mapper',
    })

    const opened = await open(client)
    expect(opened.result).toEqual({
      configIdentity: hashOptions(STUB_OPTIONS),
      watchedFiles: [],
      optionDiagnostics: [],
    })

    const transformed = await client.request('transform', {
      fileName: INDEX,
      content: '# ignored\n',
      projectHandle: 'h1',
    })
    expect(transformed.result.extension).toBe('.ts')
    expect(transformed.result.mappings).toEqual([])
    expect(transformed.result.diagnostics).toEqual([])
    expect(transformed.result.text).toContain("'r|public|stub|*'")
    expect(transformed.result.text).toContain('postgrest: "14.4"')

    // TypeScript re-transforms the same file after an edit: same module again
    const again = await client.request('transform', {
      fileName: INDEX,
      content: '# edited\n',
      projectHandle: 'h1',
    })
    expect(again.result.text).toBe(transformed.result.text)

    expect((await client.request('closeProject', { projectHandle: 'h1' })).result).toBeNull()
    const afterClose = await client.request('transform', {
      fileName: INDEX,
      content: '',
      projectHandle: 'h1',
    })
    expect(afterClose.error?.code).toBe(-32602)

    server.close()
    await server.closed
  })

  it('hands the generator the validated options and passes its result through', async () => {
    const calls: unknown[] = []
    const generator: ProjectGenerator = async (params) => {
      calls.push(params)
      return {
        identity: 'identity-1',
        watchedFiles: ['/p/supabase/schema.json'],
        text: 'export {}\n// generated\n',
        diagnostics: [{ messageText: 'scan failed', start: 0, length: 1, code: 77 }],
        optionDiagnostics: [{ path: ['schema', 'path'], messageText: 'file not found', code: 78 }],
      }
    }
    const { client } = start(generator)
    await client.request('initialize', INITIALIZE)
    const options = { postgrest: '14.4', schema: { source: 'snapshot', path: './schema.json' } }
    const opened = await open(client, 'h1', options)
    expect(opened.result).toEqual({
      configIdentity: 'identity-1',
      watchedFiles: ['/p/supabase/schema.json'],
      optionDiagnostics: [{ path: ['schema', 'path'], messageText: 'file not found', code: 78 }],
    })
    expect(calls).toEqual([
      {
        configFileName: '/p/tsconfig.json',
        projectHandle: 'h1',
        options,
        compilerOptions: { strict: true },
      },
    ])
    const transformed = await client.request('transform', {
      fileName: INDEX,
      content: '',
      projectHandle: 'h1',
    })
    expect(transformed.result).toEqual({
      text: 'export {}\n// generated\n',
      extension: '.ts',
      mappings: [],
      diagnostics: [{ messageText: 'scan failed', start: 0, length: 1, code: 77 }],
    })
  })

  it('keeps projects apart, and the generator owns what outlives closeProject', async () => {
    const schemaLoads = new Map<string, number>() // the generator's own cache, keyed by tsconfig
    const generator: ProjectGenerator = async ({ configFileName, projectHandle }) => {
      schemaLoads.set(configFileName, (schemaLoads.get(configFileName) ?? 0) + 1)
      return {
        identity: projectHandle,
        watchedFiles: [],
        text: `// ${projectHandle} in ${configFileName}\n`,
        diagnostics: [],
        optionDiagnostics: [],
      }
    }
    const { client } = start(generator)
    await client.request('initialize', INITIALIZE)
    await open(client, 'a', STUB_OPTIONS, '/a/tsconfig.json')
    await open(client, 'b', STUB_OPTIONS, '/b/tsconfig.json')
    const text = async (h: string, fileName: string) =>
      (await client.request('transform', { fileName, content: '', projectHandle: h })).result?.text
    expect(await text('b', '/b/x.pgrst-index')).toBe('// b in /b/tsconfig.json\n')
    expect(await text('a', '/a/x.pgrst-index')).toBe('// a in /a/tsconfig.json\n')

    await client.request('closeProject', { projectHandle: 'a' })
    expect(await text('b', '/b/x.pgrst-index')).toBe('// b in /b/tsconfig.json\n')
    // a watched-file change: close then open again; the server keeps nothing of the old project
    await open(client, 'a2', STUB_OPTIONS, '/a/tsconfig.json')
    expect(await text('a2', '/a/x.pgrst-index')).toBe('// a2 in /a/tsconfig.json\n')
    expect(schemaLoads.get('/a/tsconfig.json')).toBe(2)
  })

  it('reports invalid options without calling the generator', async () => {
    const generator = jest.fn(stubGenerator)
    const { client } = start(generator)
    await client.request('initialize', INITIALIZE)
    const bad = {
      postgrest: 'latest',
      extra: true,
      schema: { source: 'snapshot' },
      scan: ['src/**/*.ts', 3],
      unplanned: 'maybe',
    }
    const opened = await open(client, 'h1', bad)
    const byPath = Object.fromEntries(
      opened.result.optionDiagnostics.map((d: any) => [d.path.join('.'), d.code])
    )
    expect(byPath).toEqual({
      postgrest: DiagnosticCode.InvalidOption,
      extra: DiagnosticCode.UnknownOption,
      'schema.path': DiagnosticCode.MissingOption,
      'scan.1': DiagnosticCode.InvalidOption,
      unplanned: DiagnosticCode.InvalidOption,
    })
    expect(opened.result.configIdentity).toBe(hashOptions(bad))
    expect(generator).not.toHaveBeenCalled()

    // an options-less entry and a non-object are reported on the object itself or per missing key
    const missing = await client.request('openProject', {
      configFileName: '/p/tsconfig.json',
      projectHandle: 'h2',
      compilerOptions: {},
    })
    expect(missing.result.optionDiagnostics.map((d: any) => d.path)).toEqual([
      ['postgrest'],
      ['schema'],
    ])

    // the project still transforms, to an empty module
    const transformed = await client.request('transform', {
      fileName: INDEX,
      content: '',
      projectHandle: 'h1',
    })
    expect(transformed.result.text).toBe('export {}\n')
  })

  it('gives a second index file in a project a diagnostic and an empty module', async () => {
    const { client } = start()
    await client.request('initialize', INITIALIZE)
    await open(client)
    const first = await client.request('transform', {
      fileName: '/p/src/a.pgrst-index',
      content: '# a',
      projectHandle: 'h1',
    })
    expect(first.result.text).toContain('SupabaseSelects')
    const second = await client.request('transform', {
      fileName: '/p/src/b.pgrst-index',
      content: '# b second\nline 2',
      projectHandle: 'h1',
    })
    expect(second.result.text).toBe('export {}\n')
    expect(second.result.diagnostics).toEqual([
      {
        messageText: expect.stringContaining('/p/src/a.pgrst-index'),
        start: 0,
        length: '# b second'.length,
        code: DiagnosticCode.DuplicateIndexFile,
      },
    ])
  })

  describe('bad requests never stop the server', () => {
    it('answers with errors and keeps serving', async () => {
      const { client, errors } = start()
      const notInitialized = await open(client)
      expect(notInitialized.error?.code).toBe(-32002)

      await client.request('initialize', INITIALIZE)
      expect((await client.request('nope')).error?.code).toBe(-32601)
      expect(
        (await client.request('initialize', { positionEncodings: ['utf-32'] })).error?.code
      ).toBe(-32602)
      expect((await client.request('openProject', 'not an object')).error?.code).toBe(-32602)
      expect((await client.request('openProject', { projectHandle: 3 })).error?.code).toBe(-32602)
      expect(
        (await client.request('transform', { fileName: INDEX, projectHandle: 'x' })).error?.code
      ).toBe(-32602)
      expect((await client.request('closeProject', {})).error?.code).toBe(-32602)

      const notJson = await client.raw(
        Buffer.concat([Buffer.from('Content-Length: 5\r\n\r\n'), Buffer.from('{oops')]),
        null
      )
      expect(notJson.error?.code).toBe(-32700)
      const notRequest = await client.raw(encodeFrame({ jsonrpc: '2.0', id: 'x', foo: 1 }), 'x')
      expect(notRequest.error?.code).toBe(-32600)
      const batch = await client.raw(
        encodeFrame([{ jsonrpc: '2.0', id: 1, method: 'shutdown' }]),
        null
      )
      expect(batch.error?.code).toBe(-32600)

      // a header block without Content-Length is skipped; the next frame is served
      const afterJunk = await client.raw(
        Buffer.concat([
          Buffer.from('X-Junk: 1\r\n\r\n'),
          encodeFrame({ jsonrpc: '2.0', id: 'ok', method: 'shutdown' }),
        ]),
        'ok'
      )
      expect(afterJunk.result).toBeNull()
      expect(errors.some((e) => e.includes('Content-Length'))).toBe(true)

      expect((await open(client)).result.configIdentity).toBe(hashOptions(STUB_OPTIONS))
    })

    it('turns a throwing generator into an error response', async () => {
      let fail = true
      const generator: ProjectGenerator = async (params) => {
        if (fail) throw new Error('schema unreachable')
        return stubGenerator(params)
      }
      const { client, errors } = start(generator)
      await client.request('initialize', INITIALIZE)
      const failed = await open(client)
      expect(failed.error).toEqual({
        code: -32603,
        message: 'generator failed: schema unreachable',
      })
      expect(errors).toEqual([expect.stringContaining('generator failed')])
      const transformed = await client.request('transform', {
        fileName: INDEX,
        content: '',
        projectHandle: 'h1',
      })
      expect(transformed.error?.code).toBe(-32602)
      fail = false
      expect((await open(client)).result.configIdentity).toBe(hashOptions(STUB_OPTIONS))
    })
  })

  it('reassembles frames split at arbitrary bytes and counts length in bytes', async () => {
    const { client, toServer } = start()
    const write = toServer.write.bind(toServer)
    const bytes = Buffer.concat([
      encodeFrame({ jsonrpc: '2.0', id: 'a', method: 'initialize', params: INITIALIZE }),
      encodeFrame({
        jsonrpc: '2.0',
        id: 'b',
        method: 'openProject',
        params: {
          configFileName: '/p/tsconfig.json',
          projectHandle: 'h',
          options: { ...STUB_OPTIONS, defaultSchema: 'café_日本' },
          compilerOptions: {},
        },
      }),
    ])
    const replies = client.raw(Buffer.alloc(0), 'b')
    for (let i = 0; i < bytes.length; i += 7) write(bytes.subarray(i, i + 7))
    expect((await replies).result.configIdentity).toHaveLength(64)
  })

  it('stops on exit, and on end of input after answering what is in flight', async () => {
    const slow: ProjectGenerator = async (params) => {
      await new Promise((resolve) => setTimeout(resolve, 20))
      return stubGenerator(params)
    }
    const a = start(slow)
    await a.client.request('initialize', INITIALIZE)
    const reply = open(a.client)
    a.toServer.end()
    expect((await reply).result.configIdentity).toBe(hashOptions(STUB_OPTIONS))
    await a.server.closed

    const b = start()
    expect((await b.client.request('shutdown')).result).toBeNull()
    b.client.notify('exit')
    await b.server.closed
  })

  it('logs only when TS_CONTENT_MAPPER_DEBUG is set', () => {
    const lines: string[] = []
    const stream = { write: (chunk: string) => lines.push(chunk) }
    createStreamLogger(stream, {}).debug('quiet')
    createStreamLogger(stream, {}).error('boom')
    expect(lines).toEqual(['[postgrest-mapper] error boom\n'])
    createStreamLogger(stream, { TS_CONTENT_MAPPER_DEBUG: '1' }).debug('loud')
    expect(lines[1]).toBe('[postgrest-mapper] debug loud\n')
  })
})

const BIN = join(__dirname, '..', 'bin', 'content-mapper.cjs')

describe('content mapper executable', () => {
  let child: ChildProcessWithoutNullStreams | undefined
  afterEach(() => child?.kill())

  function spawnBin(env: Record<string, string> = {}) {
    if (!existsSync(join(__dirname, '..', 'dist', 'main', 'content-mapper', 'index.js'))) {
      throw new Error('dist is missing: run `pnpm nx build postgrest-mapper` first')
    }
    child = spawn(process.execPath, [BIN], { env: { ...process.env, ...env } })
    let stderr = ''
    child.stderr.on('data', (chunk) => (stderr += chunk))
    const exited = new Promise<number | null>((resolve) => child!.on('exit', resolve))
    return { client: new RpcClient(child.stdin, child.stdout), exited, stderr: () => stderr }
  }

  it('speaks the protocol over real stdio and exits when asked', async () => {
    const { client, exited, stderr } = spawnBin()
    expect((await client.request('initialize', INITIALIZE)).result.positionEncoding).toBe('utf-16')
    expect((await open(client)).result.configIdentity).toBe(hashOptions(STUB_OPTIONS))
    const transformed = await client.request('transform', {
      fileName: INDEX,
      content: '',
      projectHandle: 'h1',
    })
    expect(transformed.result.text).toContain("'r|public|stub|*'")
    expect((await client.request('nope')).error?.code).toBe(-32601)
    expect((await client.request('closeProject', { projectHandle: 'h1' })).result).toBeNull()
    client.notify('exit')
    expect(await exited).toBe(0)
    expect(stderr()).toBe('')
  })

  it('exits when TypeScript closes the pipe, and logs the traffic in debug mode', async () => {
    const { client, exited, stderr } = spawnBin({ TS_CONTENT_MAPPER_DEBUG: '1' })
    await client.request('initialize', INITIALIZE)
    child!.stdin.end()
    expect(await exited).toBe(0)
    expect(stderr()).toContain('debug <- ')
    expect(stderr()).toContain('debug -> ')
  })
})
