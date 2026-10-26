import * as path from 'path'
import ts from 'typescript'

// Builds a small program over the generated test declarations and prints `data` the way an editor hover does. No
// database stack is needed: nothing here runs a request.
const root = path.resolve(__dirname, '..')
const virtualFile = path.join(root, 'test', '__result_hover_virtual__.ts')

const source = `
import { PostgrestClient } from '../src/index'
declare const postgrest: PostgrestClient

export const jsonPaths = postgrest.from('users').select('data->foo->bar, data->foo->>baz').single()
export const plainColumn = postgrest.from('users').select('data').single()
export const embed = postgrest.from('users').select('username, messages(id, message)').single()
export const aggregate = postgrest.from('users').select('username, messages(id.count())').single()
export const rpcResult = postgrest.rpc('get_status', { name_param: 'supabot' })
`

function hoverOf(name: string): { checker: ts.TypeChecker; text: string; row: ts.Type } {
  const configPath = path.join(root, 'tsconfig.test.json')
  const config = ts.getParsedCommandLineOfConfigFile(
    configPath,
    { noEmit: true },
    { ...ts.sys, onUnRecoverableConfigFileDiagnostic: () => undefined }
  )!
  const host = ts.createCompilerHost(config.options)
  const readFile = host.readFile.bind(host)
  const fileExists = host.fileExists.bind(host)
  const getSourceFile = host.getSourceFile.bind(host)
  host.fileExists = (f) => f === virtualFile || fileExists(f)
  host.readFile = (f) => (f === virtualFile ? source : readFile(f))
  host.getSourceFile = (f, lang, ...rest) =>
    f === virtualFile ? ts.createSourceFile(f, source, lang) : getSourceFile(f, lang, ...rest)
  const program = ts.createProgram(
    [virtualFile, path.join(root, 'test', 'postgrest.generated.d.ts')],
    config.options,
    host
  )
  const checker = program.getTypeChecker()
  const file = program.getSourceFile(virtualFile)!
  const decl = (function find(n: ts.Node): ts.VariableDeclaration | undefined {
    if (ts.isVariableDeclaration(n) && n.name.getText() === name) return n
    return ts.forEachChild(n, find)
  })(file)!
  const res = checker.getTypeAtLocation(decl)
  // awaited result's `data`
  const awaited = checker.getAwaitedType(res)!
  const data = checker.getNonNullableType(
    awaited.getProperty('data')!.valueDeclaration
      ? checker.getTypeOfSymbolAtLocation(awaited.getProperty('data')!, decl)
      : checker.getTypeOfSymbol(awaited.getProperty('data')!)
  )
  const flags = ts.TypeFormatFlags.NoTruncation | ts.TypeFormatFlags.InTypeAlias
  return { checker, row: data, text: checker.typeToString(data, undefined, flags) }
}

function fieldText(name: string, field: string): string {
  const { checker, row } = hoverOf(name)
  const flags = ts.TypeFormatFlags.NoTruncation | ts.TypeFormatFlags.InTypeAlias
  return checker.typeToString(checker.getTypeOfSymbol(row.getProperty(field)!), undefined, flags)
}

describe('result hovers print resolved types', () => {
  test.each(['jsonPaths', 'plainColumn', 'embed', 'aggregate', 'rpcResult'])(
    '%s has no internal alias names',
    (name) => {
      const { text } = hoverOf(name)
      expect(text).not.toMatch(/PgrstJson|PgrstJsonText|SupabaseColumnType|NonNullable/)
    }
  )

  test('-> and ->> paths read as plain types', () => {
    expect(hoverOf('jsonPaths').text).toBe(
      '{ bar: string | number | boolean | { [k: string]: Json | undefined; } | Json[] | null; baz: string | null; }'
    )
    expect(fieldText('jsonPaths', 'baz')).toBe('string | null')
  })

  test('rpc scalar result is resolved', () => {
    expect(hoverOf('rpcResult').text).toBe('"ONLINE" | "OFFLINE"')
  })

  test('plain column, embed and aggregate print resolved rows', () => {
    expect(hoverOf('plainColumn').text).toBe('{ data: Json; }')
    expect(hoverOf('embed').text).toBe(
      '{ username: string; messages: { id: number; message: string | null; }[]; }'
    )
    expect(hoverOf('aggregate').text).toBe('{ username: string; messages: { count: number; }[]; }')
  })
})
