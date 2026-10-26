import * as path from 'path'
import ts from 'typescript'

// A package that returns a builder from an exported function ships it through declaration emit. This emits
// `test/types/emit/return-builders.ts` in memory, then type-checks a consumer that reads the emitted declarations next
// to the package entry. No database stack is needed: nothing here runs a request.
const root = path.resolve(__dirname, '..')
const fixture = path.join(root, 'test', 'types', 'emit', 'return-builders.ts')
const generated = path.join(root, 'test', 'postgrest.generated.d.ts')
// the emitted file keeps its relative imports, so the consumer's copy sits at the same depth
const emittedDir = path.join(root, 'test', 'types', '__emitted__')
const emittedFile = path.join(emittedDir, 'return-builders.d.ts')
const consumerFile = path.join(emittedDir, 'consumer.ts')

const consumer = `
import { PostgrestClient } from '../../../src/index'
import { readBuilder, writeBuilder, reselectBuilder, rpcBuilder } from './return-builders'

type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false
type Expect<T extends true> = T
type Data<F extends () => PromiseLike<{ data: unknown }>> = NonNullable<Awaited<ReturnType<F>>['data']>
type Status = 'ONLINE' | 'OFFLINE' | null

export type Read = Expect<Equal<Data<typeof readBuilder>, { username: string; status: Status }[]>>
export type Write = Expect<Equal<Data<typeof writeBuilder>, { username: string }[]>>
export type Reselected = Expect<Equal<Data<typeof reselectBuilder>, { status: Status }[]>>
export type Rpc = Expect<Equal<Data<typeof rpcBuilder>, { username: string; status: Status }[]>>

// the check above is live
// @ts-expect-error Type 'false' does not satisfy the constraint 'true'
export type Wrong = Expect<Equal<Data<typeof readBuilder>, { username: string }[]>>

// the emitted builders are the builders the package entry returns
declare const postgrest: PostgrestClient
const read = postgrest.from('users').select('username, status')
const write = postgrest.from('users').insert({ username: 'x' }).select('username')
const reselect = postgrest.from('users').select('username').select('status')
const rpc = postgrest.rpc('get_username_and_status', { name_param: 'supabot' }).select('username, status')
export const toEmitted = [
  read satisfies ReturnType<typeof readBuilder>,
  write satisfies ReturnType<typeof writeBuilder>,
  reselect satisfies ReturnType<typeof reselectBuilder>,
  rpc satisfies ReturnType<typeof rpcBuilder>,
]
declare const emitted: [
  ReturnType<typeof readBuilder>,
  ReturnType<typeof writeBuilder>,
  ReturnType<typeof reselectBuilder>,
  ReturnType<typeof rpcBuilder>,
]
export const fromEmitted = [
  emitted[0] satisfies typeof read,
  emitted[1] satisfies typeof write,
  emitted[2] satisfies typeof reselect,
  emitted[3] satisfies typeof rpc,
]
// one builder is not another
// @ts-expect-error Type 'PostgrestFilterBuilder<RB<
export const mixed: ReturnType<typeof readBuilder> = emitted[2]
`

function options(): ts.CompilerOptions {
  const config = ts.getParsedCommandLineOfConfigFile(
    path.join(root, 'tsconfig.test.json'),
    { noEmit: true },
    { ...ts.sys, onUnRecoverableConfigFileDiagnostic: () => undefined }
  )!
  return {
    ...config.options,
    noEmit: false,
    declaration: true,
    emitDeclarationOnly: true,
    // the in-memory files are not part of a composite project's file list
    composite: false,
    declarationMap: false,
    sourceMap: false,
    outDir: undefined,
    rootDir: root,
    // errors inside the emitted declarations count
    skipLibCheck: false,
  }
}

function messages(diagnostics: readonly ts.Diagnostic[]): string[] {
  return diagnostics.map((d) => ts.flattenDiagnosticMessageText(d.messageText, '\n'))
}

// emits the fixture's declarations, returned as written
function emitFixture(): { text: string; diagnostics: string[] } {
  const compilerOptions = options()
  const host = ts.createCompilerHost(compilerOptions)
  let text = ''
  host.writeFile = (file, content) => {
    if (file.endsWith('return-builders.d.ts')) text = content
  }
  const program = ts.createProgram([fixture, generated], compilerOptions, host)
  const source = program.getSourceFile(fixture)!
  const result = program.emit(source, undefined, undefined, true)
  return {
    text,
    diagnostics: messages([
      ...ts.getPreEmitDiagnostics(program, source),
      ...program.getDeclarationDiagnostics(source),
      ...result.diagnostics,
    ]),
  }
}

// type-checks the consumer over the emitted declarations, both held in memory
function checkConsumer(emitted: string): string[] {
  const compilerOptions = options()
  const files = new Map([
    [emittedFile, emitted],
    [consumerFile, consumer],
  ])
  const host = ts.createCompilerHost(compilerOptions)
  const readFile = host.readFile.bind(host)
  const fileExists = host.fileExists.bind(host)
  const getSourceFile = host.getSourceFile.bind(host)
  const directoryExists = host.directoryExists!.bind(host)
  host.directoryExists = (d) => d === emittedDir || directoryExists(d)
  host.fileExists = (f) => files.has(f) || fileExists(f)
  host.readFile = (f) => files.get(f) ?? readFile(f)
  host.getSourceFile = (f, lang, ...rest) =>
    files.has(f) ? ts.createSourceFile(f, files.get(f)!, lang) : getSourceFile(f, lang, ...rest)
  const program = ts.createProgram([consumerFile, emittedFile, generated], compilerOptions, host)
  return messages(
    [consumerFile, emittedFile].flatMap((f) =>
      ts.getPreEmitDiagnostics(program, program.getSourceFile(f))
    )
  )
}

describe('builders returned from exported functions survive declaration emit', () => {
  const emitted = emitFixture()
  // the printer breaks type arguments over lines
  const flat = emitted.text.replace(/\s+/g, ' ')

  test('the fixture emits without diagnostics', () => {
    expect(emitted.diagnostics).toEqual([])
    expect(emitted.text).not.toBe('')
  })

  test('the emitted declarations name the compact builders', () => {
    const lookup = 'import("../../../src/types/planner/lookup")'
    const rpc = 'import("../../../src/types/planner/rpc")'
    // a read builder
    expect(flat).toContain(`${lookup}.RB<SupabaseDatabase, "public", "users", "username, status">`)
    // a write builder, reselected
    expect(flat).toContain(
      `${lookup}.Reselect<${lookup}.WB<SupabaseDatabase, "public", "users">, "username">`
    )
    // a read builder, reselected
    expect(flat).toContain(
      `${lookup}.Reselect<${lookup}.RB<SupabaseDatabase, "public", "users", "username">, "status">`
    )
    // an rpc builder, reselected; the call's arguments are part of the type
    expect(flat).toContain(
      `${lookup}.Reselect<${rpc}.RpcB<SupabaseDatabase, "public", "get_username_and_status", { readonly name_param: "supabot"; }, {}>, "username, status">`
    )
  })

  test('the emitted declarations carry no relation dump or generator alias', () => {
    expect(flat).not.toMatch(/SupabaseColumnType|PgrstObject|PgrstJson|Row: \{|Relationships:/)
  })

  test('a consumer of the emitted declarations type-checks, with the data it expects', () => {
    expect(checkConsumer(emitted.text)).toEqual([])
  })
})
