import * as path from 'path'
import ts from 'typescript'

// Hovers the builders the way an editor does, through the language service's `getQuickInfoAtPosition`. Unlike
// `typeToString`, quick info reuses the property annotations as they are written in the generated declarations, so a
// builder that carries the relation as a type argument prints the whole `Row` with every `SupabaseColumnType<...>`.
// No database stack is needed: nothing here runs a request.
const root = path.resolve(__dirname, '..')
const virtualFile = path.join(root, 'test', '__builder_hover_virtual__.ts')

// `member` is the method whose hover is read: the last `.member(` of the expression.
const cases: { name: string; expression: string; member: string; builder: string }[] = [
  {
    name: 'from',
    expression: `postgrest.from('users')`,
    member: 'from',
    builder: 'PostgrestQueryBuilder<SupabaseDatabase, "public", "users">',
  },
  {
    name: 'select',
    expression: `postgrest.from('users').select('username, status')`,
    member: 'select',
    builder: 'PostgrestFilterBuilder<RB<SupabaseDatabase, "public", "users", "username, status">',
  },
  {
    name: 'eq',
    expression: `postgrest.from('users').select('username, status').eq('status', 'ONLINE')`,
    member: 'eq',
    builder: 'PostgrestFilterBuilder<RB<SupabaseDatabase, "public", "users", "username, status">',
  },
  {
    name: 'order',
    expression: `postgrest.from('users').select('username, status').order('username')`,
    member: 'order',
    builder:
      'PostgrestTransformBuilder<RB<SupabaseDatabase, "public", "users", "username, status">',
  },
  {
    name: 'embed',
    expression: `postgrest.from('users').select('username, messages(id, channels(slug))').eq('username', 'x')`,
    member: 'eq',
    builder:
      'PostgrestFilterBuilder<RB<SupabaseDatabase, "public", "users", "username, messages(id, channels(slug))">',
  },
  {
    name: 'insert',
    expression: `postgrest.from('users').insert({ username: 'x' })`,
    member: 'insert',
    builder: 'PostgrestQueryBuilder<SupabaseDatabase, "public", "users">.insert<',
  },
  {
    name: 'update',
    expression: `postgrest.from('users').update({ username: 'y' })`,
    member: 'update',
    builder: 'PostgrestQueryBuilder<SupabaseDatabase, "public", "users">.update<',
  },
  {
    name: 'upsert',
    expression: `postgrest.from('users').upsert({ username: 'x' })`,
    member: 'upsert',
    builder: 'PostgrestQueryBuilder<SupabaseDatabase, "public", "users">.upsert<',
  },
  {
    name: 'reselect',
    expression: `postgrest.from('users').insert({ username: 'x' }).select('username')`,
    member: 'select',
    builder: 'Reselect<WB<SupabaseDatabase, "public", "users">, "username">',
  },
  {
    name: 'rpc',
    expression: `postgrest.rpc('function_returning_set_of_rows')`,
    member: 'rpc',
    builder: 'PostgrestFilterBuilder<RpcB<"public", "function_returning_set_of_rows", {}, {}>',
  },
  {
    name: 'rpcSelect',
    expression: `postgrest.rpc('function_returning_set_of_rows').select('username')`,
    member: 'select',
    builder: 'RpcB<"public", "function_returning_set_of_rows", {}, {}>',
  },
  {
    name: 'rpcEq',
    expression: `postgrest.rpc('function_returning_set_of_rows').eq('username', 'x')`,
    member: 'eq',
    builder: 'PostgrestFilterBuilder<RpcB<"public", "function_returning_set_of_rows", {}, {}>',
  },
]

// `const { data } = await <expression>`, hovered at `data`. `text` is the exact plain type the editor prints.
const dataCases: { name: string; expression: string; text: string }[] = [
  {
    name: 'scalarRpc',
    expression: `postgrest.rpc('get_status', { name_param: 'supabot' })`,
    text: 'const data: "ONLINE" | "OFFLINE" | null',
  },
  {
    name: 'insertBare',
    expression: `postgrest.from('users').insert({ username: 'x' })`,
    text: 'const data: null',
  },
  {
    name: 'insertSelect',
    expression: `postgrest.from('users').insert({ username: 'x' }).select('username')`,
    text: 'const data: { username: string; }[] | null',
  },
  {
    name: 'updateSelect',
    expression: `postgrest.from('users').update({ username: 'y' }).eq('username', 'x').select('username')`,
    text: 'const data: { username: string; }[] | null',
  },
  {
    name: 'deleteSelect',
    expression: `postgrest.from('users').delete().eq('username', 'x').select('username')`,
    text: 'const data: { username: string; }[] | null',
  },
  {
    name: 'single',
    expression: `postgrest.from('users').select('username, status').single()`,
    text: 'const data: { username: string; status: "ONLINE" | "OFFLINE" | null; } | null',
  },
  {
    name: 'maybeSingle',
    expression: `postgrest.from('users').select('username, status').maybeSingle()`,
    text: 'const data: { username: string; status: "ONLINE" | "OFFLINE" | null; } | null',
  },
  {
    name: 'count',
    expression: `postgrest.from('users').select('username', { count: 'exact' })`,
    text: 'const data: { username: string; }[] | null',
  },
  {
    name: 'head',
    expression: `postgrest.from('users').select('username', { count: 'exact', head: true })`,
    text: 'const data: null',
  },
  {
    name: 'csv',
    expression: `postgrest.from('users').select('username, status').csv()`,
    text: 'const data: string | null',
  },
]

const source = `
import { PostgrestClient } from '../src/index'
declare const postgrest: PostgrestClient

${cases.map((c) => `export const ${c.name}Q = ${c.expression}`).join('\n')}
${dataCases.map((c) => `export async function ${c.name}D() { const { data } = await ${c.expression}; return data }`).join('\n')}
`

function languageService(): ts.LanguageService {
  const config = ts.getParsedCommandLineOfConfigFile(
    path.join(root, 'tsconfig.test.json'),
    { noEmit: true },
    { ...ts.sys, onUnRecoverableConfigFileDiagnostic: () => undefined }
  )!
  const files = [virtualFile, path.join(root, 'test', 'postgrest.generated.d.ts')]
  return ts.createLanguageService({
    getScriptFileNames: () => files,
    getScriptVersion: () => '1',
    getScriptSnapshot: (f) =>
      f === virtualFile
        ? ts.ScriptSnapshot.fromString(source)
        : ts.sys.fileExists(f)
          ? ts.ScriptSnapshot.fromString(ts.sys.readFile(f)!)
          : undefined,
    getCurrentDirectory: () => root,
    getCompilationSettings: () => config.options,
    getDefaultLibFileName: (o) => ts.getDefaultLibFilePath(o),
    fileExists: (f) => f === virtualFile || ts.sys.fileExists(f),
    readFile: (f) => (f === virtualFile ? source : ts.sys.readFile(f)),
    readDirectory: ts.sys.readDirectory,
    directoryExists: ts.sys.directoryExists,
    getDirectories: ts.sys.getDirectories,
  })
}

const ls = languageService()

function hoverOf(c: (typeof cases)[number]): string {
  const start = source.indexOf(`export const ${c.name}Q = `)
  const at = source.indexOf(c.expression, start)
  const dot = at + c.expression.lastIndexOf(`.${c.member}(`) + 1
  // `postgrest.from(` is read at `from`, which is the first member
  const info = ls.getQuickInfoAtPosition(
    virtualFile,
    c.member === 'from' ? at + 'postgrest.'.length : dot
  )
  expect(info).toBeDefined()
  return ts.displayPartsToString(info!.displayParts)
}

// the hover of the declared name reads the whole chain's result
function variableHoverOf(c: (typeof cases)[number]): string {
  const info = ls.getQuickInfoAtPosition(
    virtualFile,
    source.indexOf(`export const ${c.name}Q = `) + 'export const '.length
  )
  expect(info).toBeDefined()
  return ts.displayPartsToString(info!.displayParts)
}

// the hover of `data` in `const { data } = await <expression>`
function dataHoverOf(c: (typeof dataCases)[number]): string {
  const start = source.indexOf(`export async function ${c.name}D()`)
  const info = ls.getQuickInfoAtPosition(virtualFile, source.indexOf('{ data }', start) + 2)
  expect(info).toBeDefined()
  // quick info breaks object types over lines
  return ts.displayPartsToString(info!.displayParts).replace(/\s+/g, ' ')
}

describe('builder hovers are compact', () => {
  test('the virtual file type-checks', () => {
    const diagnostics = ls
      .getSemanticDiagnostics(virtualFile)
      // the virtual file is not listed in tsconfig.test.json's file list
      .filter((d) => d.code !== 6307)
    expect(diagnostics.map((d) => ts.flattenDiagnosticMessageText(d.messageText, '\n'))).toEqual([])
  })

  test.each(cases)('$name has no relation dump or internal alias names', (c) => {
    const text = hoverOf(c)
    expect(text).not.toMatch(/SupabaseColumnType|PgrstJson|PgrstJsonText|Row: \{/)
    expect(text).not.toMatch(/Insert: \{|Update: \{|Relationships:/)
  })

  test.each(cases)('$name prints the compact builder', (c) => {
    expect(hoverOf(c)).toContain(c.builder)
  })

  test.each(cases)('$name result has no relation dump or internal alias names', (c) => {
    const text = variableHoverOf(c)
    expect(text).not.toMatch(/SupabaseColumnType|PgrstJson|PgrstJsonText|Row: \{/)
    expect(text).not.toMatch(/Insert: \{|Update: \{|Relationships:/)
  })

  test.each(['insert', 'update', 'upsert'])('%s result is the compact write builder', (name) => {
    expect(variableHoverOf(cases.find((x) => x.name === name)!)).toContain(
      `const ${name}Q: PostgrestFilterBuilder<WB<SupabaseDatabase, "public", "users">`
    )
  })

  test('insert, update and upsert values read as plain types', () => {
    for (const name of ['insert', 'update', 'upsert']) {
      const c = cases.find((x) => x.name === name)!
      const text = hoverOf(c)
      expect(text).toContain('username: string')
      expect(text).toContain('status?: "ONLINE" | "OFFLINE" | null | undefined')
    }
  })

  test('filter operands read as plain types', () => {
    const text = hoverOf(cases.find((x) => x.name === 'eq')!)
    expect(text).toContain('eq<"status", "ONLINE">(column: "status", value: "ONLINE")')
  })

  test.each(dataCases)('$name data has no internal alias names', (c) => {
    const text = dataHoverOf(c)
    expect(text).not.toMatch(/\b(Out|Desc|RB|WB|RpcB)</)
    expect(text).not.toMatch(/SupabaseColumnType|PgrstJson|PgrstJsonText/)
  })

  test.each(dataCases)('$name data prints the plain type', (c) => {
    expect(dataHoverOf(c)).toBe(c.text)
  })
})
