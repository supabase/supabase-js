import type {
  PostgrestClient,
  PostgrestClientOptions,
  PostgrestQueryBuilder,
} from '../../../src/index'
import type { Equal, Expect } from '../helpers'

// The v2 generic forms of the client compile unchanged: `<Database>`, `<Database, SchemaName>`,
// `<Database, Options>` and `<Database, Options, SchemaName>`. The options object (`PostgrestVersion`) is
// ignored; `__InternalSupabase`, which `supabase gen types typescript` emits next to the schemas, is not a schema.

type Schema = {
  Tables: {
    x: {
      Row: { id: number }
      Insert: { id?: number }
      Update: { id?: number }
      Relationships: []
    }
  }
  Views: { [_ in never]: never }
  Functions: { [_ in never]: never }
  Enums: { [_ in never]: never }
  CompositeTypes: { [_ in never]: never }
}
type Db = {
  __InternalSupabase: { PostgrestVersion: '12.2.3' }
  public: Schema
  other: Schema
}
type DbNoPublic = {
  __InternalSupabase: { PostgrestVersion: '12.2.3' }
  first: Schema
  second: Schema
}

declare const one: PostgrestClient<Db>
declare const schemaName: PostgrestClient<Db, 'other'>
declare const optionsOnly: PostgrestClient<Db, { PostgrestVersion: '12' }>
declare const optionsAndSchema: PostgrestClient<Db, { PostgrestVersion: '12' }, 'other'>
declare const emptyOptions: PostgrestClient<Db, PostgrestClientOptions>

// the schema is the plain literal in the builder's type arguments, whichever form named it
const q1 = one.from('x')
type _v2a = Expect<Equal<typeof q1, PostgrestQueryBuilder<Db, 'public', 'x'>>>
const q2 = schemaName.from('x')
type _v2b = Expect<Equal<typeof q2, PostgrestQueryBuilder<Db, 'other', 'x'>>>
const q3 = optionsOnly.from('x')
type _v2c = Expect<Equal<typeof q3, PostgrestQueryBuilder<Db, 'public', 'x'>>>
const q4 = optionsAndSchema.from('x')
type _v2d = Expect<Equal<typeof q4, PostgrestQueryBuilder<Db, 'other', 'x'>>>
const q5 = emptyOptions.from('x')
type _v2e = Expect<Equal<typeof q5, PostgrestQueryBuilder<Db, 'public', 'x'>>>

// `.schema()` switches the schema and keeps the database
const q6 = optionsOnly.schema('other').from('x')
type _v2f = Expect<Equal<typeof q6, PostgrestQueryBuilder<Db, 'other', 'x'>>>

// without a `public` schema, the options form defaults to the first schema that is not `__InternalSupabase`
declare const noPublic: PostgrestClient<DbNoPublic, { PostgrestVersion: '12' }>
const q7 = noPublic.from('x')
type _v2g = Expect<Equal<typeof q7, PostgrestQueryBuilder<DbNoPublic, 'first' | 'second', 'x'>>>

// a relation that the schema doesn't have is still an error
// @ts-expect-error Argument of type '"not_a_table"' is not assignable to parameter of type
optionsOnly.from('not_a_table')
// @ts-expect-error Argument of type '"not_a_table"' is not assignable to parameter of type
optionsAndSchema.from('not_a_table')

// `__InternalSupabase` is never a schema name, in any position
// @ts-expect-error Type '"__InternalSupabase"' does not satisfy the constraint
type BadSchema = PostgrestClient<Db, '__InternalSupabase'>
// @ts-expect-error Type '"__InternalSupabase"' does not satisfy the constraint
type BadSchemaAfterOptions = PostgrestClient<Db, { PostgrestVersion: '12' }, '__InternalSupabase'>
// @ts-expect-error Argument of type '"__InternalSupabase"' is not assignable to parameter of type
one.schema('__InternalSupabase')

// an `any` database accepts every form
declare const anyOptions: PostgrestClient<any, { PostgrestVersion: '12' }>
declare const anyOptionsAndSchema: PostgrestClient<any, { PostgrestVersion: '12' }, 'other'>
anyOptions.from('whatever')
anyOptionsAndSchema.from('whatever')
