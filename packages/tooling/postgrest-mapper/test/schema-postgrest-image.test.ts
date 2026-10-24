import { resolve } from 'node:path'
import {
  acquireSchema,
  buildJsonSchemaInput,
  buildTraceCatalog,
  connectPg,
  createTracer,
  jsonSchemaToTs,
  nodeExec,
  type AcquiredSchema,
  type DbConnection,
} from '../src'

/**
 * The `postgrest` source (pinned image, `docker run`) against a scratch database created on the shared
 * postgrest-js test server (`supabase_db_test`) and dropped afterwards, so the shared `postgres` database is never
 * written. The scratch database has what the shared one lacks: pg_jsonschema CHECK constraints, identity and
 * generated columns, and a view over a table outside the exposed schemas.
 */
const WORKDIR = resolve(__dirname, '../../../core/postgrest-js/test')
const SCRATCH = `mapper_schema_it_${process.pid}_${Date.now()}`

const DDL = [
  'create schema extensions',
  'create extension pg_jsonschema with schema extensions',
  'create schema private',
  'create table private.base (id int primary key, payload jsonb not null, note text)',
  "create type public.mood as enum ('sad', 'ok', 'happy')",
  `create table public.docs (
     id int generated always as identity primary key,
     data jsonb,
     loose json not null,
     strict jsonb,
     mood public.mood not null default 'ok',
     twice int generated always as (id * 2) stored,
     note text not null)`,
  `alter table public.docs add constraint docs_data_shape check (data is null or extensions.jsonb_matches_schema(
     '{"type":"object","properties":{"a":{"type":"string"}},"required":["a"]}', data))`,
  `alter table public.docs add constraint docs_data_more check (extensions.jsonb_matches_schema(
     '{"type":"object","properties":{"b":{"type":"number"}}}', data))`,
  `alter table public.docs add constraint docs_both check (
     extensions.jsonb_matches_schema('{"type":"object"}', data) and extensions.json_matches_schema('{"type":"array"}', loose))`,
  `alter table public.docs add constraint docs_loose check (extensions.json_matches_schema(
     '{"type":"array","items":{"type":"integer"}}', loose))`,
  `alter table public.docs add constraint docs_strict_nv check (extensions.jsonb_matches_schema(
     '{"type":"string"}', strict)) not valid`,
  'alter table public.docs add constraint docs_dynamic check (extensions.jsonb_matches_schema(note::json, data))',
  'create table public.docs_parent (id int primary key, data jsonb)',
  `alter table public.docs_parent add constraint docs_parent_own_rows_only check (extensions.jsonb_matches_schema(
     '{"type":"string"}', data)) no inherit`,
  'create table public.docs_child () inherits (public.docs_parent)',
  'create view public.docs_view as select id, note, data from public.docs',
  'create view public.private_view as select id, payload, note from private.base',
  'create function public.doc_note(d public.docs) returns text language sql stable as $$ select d.note $$',
]

describe('schema acquisition from a pinned PostgREST image', () => {
  let admin: DbConnection
  let url: string
  let schema: AcquiredSchema

  beforeAll(async () => {
    const status = await nodeExec('npx', ['supabase', 'status', '-o', 'json', '--workdir', WORKDIR])
    const adminUrl: string = JSON.parse(status.stdout.slice(status.stdout.indexOf('{'))).DB_URL
    admin = await connectPg(adminUrl)
    await admin.query(`create database ${SCRATCH}`)
    const scratch = new URL(adminUrl)
    scratch.pathname = `/${SCRATCH}`
    url = scratch.toString()
    const db = await connectPg(url)
    try {
      for (const statement of DDL) await db.query(statement)
    } finally {
      await db.close()
    }
    schema = await acquireSchema({
      source: 'postgrest',
      dbUrl: url,
      config: { 'db-schemas': 'public' },
    })
  }, 180_000)

  afterAll(async () => {
    if (!admin) return
    await admin.query(`drop database if exists ${SCRATCH} with (force)`)
    await admin.close()
  })

  test('dump, config and version come from the image', () => {
    expect(schema.postgrestVersion).toBe('16.4')
    expect(schema.config['db-schemas']).toBe('public')
    expect(schema.config).not.toHaveProperty('db-uri')
    expect(JSON.parse(schema.dump).dbTables.length).toBeGreaterThan(0)
    expect(schema.pgVersionNum).toBeGreaterThanOrEqual(150000)
  })

  test('columns: identity, generated, NOT NULL, defaults, enums, updatable views', () => {
    const { relations, enums } = schema.supplementary
    const docs = relations.find((r) => r.name === 'docs')!
    const col = (name: string) => docs.columns.find((c) => c.name === name)!
    expect(col('id')).toMatchObject({ identity: 'always', notNull: true, hasDefault: false })
    expect(col('twice')).toMatchObject({ generated: 'stored', identity: null })
    expect(col('mood')).toMatchObject({ type: 'public.mood', notNull: true, hasDefault: true })
    expect(col('data')).toMatchObject({ type: 'jsonb', notNull: false, hasDefault: false })
    expect(enums).toEqual([{ schema: 'public', name: 'mood', labels: ['sad', 'ok', 'happy'] }])
    expect(relations.find((r) => r.name === 'docs_view')).toMatchObject({
      kind: 'v',
      updatable: { insert: true, update: true, delete: true },
    })
  })

  test('relations outside the exposed schemas that exposed views select from are included', async () => {
    const { relations, referencedRelations } = schema.supplementary
    expect(relations.map((r) => r.schema)).toEqual(Array(relations.length).fill('public'))
    expect(referencedRelations.map((r) => `${r.schema}.${r.name}`)).toEqual(['private.base'])
    expect(referencedRelations[0].columns.find((c) => c.name === 'payload')?.notNull).toBe(true)

    const catalog = buildTraceCatalog(schema.supplementary)
    const view = catalog.relations.find((r) => r.name === 'private_view')!
    const tracer = await createTracer({ pgVersion: 17 })
    const traced = await tracer.trace({
      sql: view.definition!,
      columns: view.columns.map((c) => c.name),
      catalog,
    })
    expect(traced.error).toBeUndefined()
    // payload is NOT NULL in private.base, which only the referenced relation knows
    expect(traced.columns.map((c) => c.nullable)).toEqual([false, false, true])
  })

  test('JSON Schema CHECK constraints become the JSON Schema input; the rest is ignored with a reason', async () => {
    const input = await buildJsonSchemaInput(schema.supplementary)
    const byColumn = Object.fromEntries(input.columns.map((c) => [c.column, c]))
    expect(Object.keys(byColumn).sort()).toEqual(['data', 'loose'])
    expect(byColumn.data.columnType).toBe('jsonb')
    expect(byColumn.data.constraints).toEqual(['docs_both', 'docs_data_more', 'docs_data_shape'])
    expect((byColumn.data.jsonSchema as { allOf: unknown[] }).allOf).toHaveLength(3)
    expect(byColumn.loose.columnType).toBe('json')
    expect(byColumn.loose.constraints).toEqual(['docs_both', 'docs_loose'])
    expect((byColumn.loose.jsonSchema as { allOf: unknown[] }).allOf).toHaveLength(2)
    expect(jsonSchemaToTs(byColumn.data.jsonSchema)).toContain('a: string')

    expect(input.ignored.map((i) => [i.constraint, i.reason])).toEqual([
      ['docs_dynamic', expect.stringMatching(/not a plain conjunction.*not a constant/)],
      ['docs_strict_nv', expect.stringMatching(/NOT VALID/)],
      ['docs_parent_own_rows_only', expect.stringMatching(/NO INHERIT/)],
    ])
  })
})
