import {
  acquireSchema,
  checkSnapshot,
  serializeSnapshot,
  snapshotFromSchema,
  writeSnapshot,
  type AcquiredSchema,
  type SchemaFs,
} from '../src/schema'
import { canonicalJson } from '../src/schema/canonical'

/** A dump whose table has a real column named `__proto__` (JSON.parse creates it as an own property) */
const DUMP =
  '{"dbTables":[["public","t"],{"tableColumns":{"__proto__":{"colName":"__proto__"},"a":{"colName":"a"}}}]}'

function memoryFs(): SchemaFs & { files: Map<string, string> } {
  const files = new Map<string, string>()
  return {
    files,
    readFile: async (path) => {
      const text = files.get(path)
      if (text === undefined) throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' })
      return text
    },
    writeFile: async (path, data) => void files.set(path, data),
    mkdir: async () => undefined,
  }
}

const acquired = (dump: string): AcquiredSchema => ({
  dump: canonicalJson(JSON.parse(dump)),
  config: { 'db-schemas': 'public' },
  pgVersionNum: 170000,
  postgrestVersion: '16.4',
  supplementary: {
    format: 1,
    composites: [],
    foreignKeys: [],
    relations: [],
    functions: [],
    referencedRelations: [],
    enums: [],
    jsonSchemaChecks: [],
  },
})

const columnNames = (dump: string): string[] =>
  Object.keys(JSON.parse(dump).dbTables[1].tableColumns).sort()

describe('a column named __proto__ (F14)', () => {
  it('survives canonicalization', () => {
    expect(columnNames(canonicalJson(JSON.parse(DUMP)))).toEqual(['__proto__', 'a'])
    expect(canonicalJson(JSON.parse('{"b":1,"__proto__":{"x":[{"__proto__":2}]},"a":2}'))).toBe(
      '{"__proto__":{"x":[{"__proto__":2}]},"a":2,"b":1}'
    )
  })

  it('survives a snapshot round trip', async () => {
    const fs = memoryFs()
    const schema = acquired(DUMP)
    await writeSnapshot('s.json', schema, { fs })
    expect(columnNames(JSON.stringify(JSON.parse(fs.files.get('s.json')!).dump))).toEqual([
      '__proto__',
      'a',
    ])
    const restored = await acquireSchema({ source: 'snapshot', path: 's.json' }, { fs })
    expect(columnNames(restored.dump)).toEqual(['__proto__', 'a'])
    expect(await checkSnapshot('s.json', restored, { fs })).toEqual({ ok: true })
  })

  it('is reported as drift when the column disappears', async () => {
    const fs = memoryFs()
    await writeSnapshot('s.json', acquired(DUMP), { fs })
    const without = acquired('{"dbTables":[["public","t"],{"tableColumns":{"a":{"colName":"a"}}}]}')
    const check = await checkSnapshot('s.json', without, { fs })
    expect(check).toMatchObject({ ok: false, reason: 'drift' })
    expect(check.ok ? [] : check.differences).toEqual([
      { path: '/dump/dbTables/1/tableColumns/__proto__', kind: 'removed' },
    ])
    expect(serializeSnapshot(snapshotFromSchema(acquired(DUMP)))).toContain('"__proto__"')
  })
})
