import type { Strict, UnplannedOperandMessage, UnplannedSelectMessage } from './globals'
import type { OutMap } from './facts'
import type { RelDefs, SchemaOf } from './rpc'

// ---------------------------------------------------------------- state
export type Kind = 'r' | 'w' | 'f'
// static context of a chain: kind, schema, relation (or function), the relation's Row, the descriptor `*` selects
// (the Row plus identity sources over the relation's FactColumns), current select, and for rpc the possible
// (serialized key set, method) pairs: the key set is wrapped in a tuple so a union stays a set of sets, and the
// method depends on the argument union member, so the two travel together
export type BState = {
  k: Kind
  s: string
  r: string
  row: unknown
  st: unknown
  q: string
  km: [[string], string]
}
export type BS<
  k extends Kind,
  s extends string,
  r extends string,
  row,
  st,
  q extends string,
  km extends [[string], string],
> = { k: k; s: s; r: r; row: row; st: st; q: q; km: km }

// response state
export type MState = {
  op: 'GET' | 'HEAD' | 'MUT' | 'RPC' // a union when the runtime may send either (`{ head: boolean }`)
  ret: boolean // mutation asked for a representation (.select())
  base: 'many' | 'one' // cardinality before .single(), when a descriptor doesn't carry its own
  card: 'default' | 'one' | 'maybe'
  fmt: 'json' | 'csv'
  strip: boolean
  count: boolean
  thr: boolean // .throwOnError(): the response is the success branch only
  ma: boolean // .maxAffected() applies: update, delete and rpc
}
export type MS<
  op extends MState['op'],
  ret extends boolean,
  base extends MState['base'],
  card extends MState['card'],
  fmt extends MState['fmt'],
  strip extends boolean,
  count extends boolean,
  thr extends boolean = false,
  ma extends boolean = false,
> = {
  op: op
  ret: ret
  base: base
  card: card
  fmt: fmt
  strip: strip
  count: count
  thr: thr
  ma: ma
}
export type SetM<M extends MState, P> = {
  [K in keyof MState]: K extends keyof P ? P[K] : M[K]
}

// ---------------------------------------------------------------- §4.3 lookup
export type Key<B extends BState, Q extends string> = `${B['k']}|${B['s']}|${B['r']}|${Q}`
export type OKey<B extends BState, Q extends string, C extends string> = `${Key<B, Q>}|${C}`
// the key of an `.order()` column: it starts with `order|`, a select key with its kind, so the two never meet
export type OrdKey<B extends BState, Q extends string, C extends string> = `order|${OKey<B, Q, C>}`
export type Unplanned = { unplanned: true }
// an rpc whose key set can't be enumerated: nothing to look up, rows unknown
export type Dynamic = { dynamic: true }
// the entry of every lookup on an untyped client (`PostgrestClient<any>`): nothing is planned, nothing is rejected
export type Untyped = { untyped: true }

// `0 extends 1 & T` would fold to `never` early for a `T extends string`: compare for identity with `any` instead
export type IsAny<T> =
  (<X>() => X extends T ? 1 : 2) extends <X>() => X extends any ? 1 : 2 ? true : false
// an untyped client keys its chains by the schema `any` (`SchemaOf`)
type IsUntyped<B extends BState> = IsAny<B['s']>

// true for `string` and template patterns such as `id,${string}`; false for finite literals
export type IsDynamic<Q extends string> = Q extends unknown
  ? {} extends Record<Q, 1>
    ? true
    : false
  : never

// distributive over a union of keys: a union of schemas / relations expands inside the template literal
export type Stored<T extends string> = T extends keyof SupabaseSelects
  ? SupabaseSelects[T]
  : Unplanned
export type StoredOp<T extends string> = T extends keyof SupabaseOperands
  ? SupabaseOperands[T]
  : Unplanned

// the call whose `keys` equals the key set `K` exactly (mutual extends, no sorting) and whose method is `Mth`
export type PickCall<
  Cs extends readonly unknown[],
  K extends string,
  Mth extends string,
> = Cs extends readonly [infer H, ...infer T]
  ? H extends { keys: infer HK extends string; method: infer HM }
    ? [K] extends [HK]
      ? [HK] extends [K]
        ? [HM] extends [Mth]
          ? H
          : PickCall<T, K, Mth>
        : PickCall<T, K, Mth>
      : PickCall<T, K, Mth>
    : PickCall<T, K, Mth>
  : Unplanned

// one call per possible (key set, method) pair
export type PickAll<Cs extends readonly unknown[], KM> = KM extends [
  [infer K extends string],
  infer Mth extends string,
]
  ? PickCall<Cs, K, Mth>
  : never

// an rpc entry is `{ calls }`: dispatch it on what the runtime will send
export type Resolve<B extends BState, En> = B['k'] extends 'f'
  ? [string] extends B['km'][0]
    ? Dynamic
    : En extends { calls: infer Cs extends readonly unknown[] }
      ? PickAll<Cs, B['km']>
      : En
  : En

// one entry per member of a literal union of Q (and of schema / relation / possible rpc call)
export type Entry<B extends BState, Q extends string> = Q extends unknown
  ? IsUntyped<B> extends true
    ? Untyped
    : Resolve<B, Stored<Key<B, Q>>>
  : never

// per member of Q: the message that rejects it, or never
export type Reject<B extends BState, Q extends string> = Q extends '*'
  ? never
  : Entry<B, Q> extends infer En
    ? En extends { error: infer E extends string }
      ? E
      : En extends Unplanned
        ? Strict extends true
          ? UnplannedSelectMessage
          : never
        : never
    : never

// rejects the argument when any member of a literal union fails
export type Validate<B extends BState, Q extends string> =
  true extends IsDynamic<Q> ? Q : [Reject<B, Q>] extends [never] ? Q : Reject<B, Q>

// ---------------------------------------------------------------- row descriptors
// row: the planned row; sources: result field -> source column; embeds: embed key -> {path, outputs, join, cardinality};
// base: cardinality before .single() (an rpc call carries its own, everything else inherits the response state's)
export type Desc<R, S = {}, E = {}, Bs extends 'many' | 'one' | 'inherit' = 'inherit'> = {
  row: R
  sources: S
  embeds: E
  base: Bs
}
// A planned row as the plain object: the row, and the embedded rows below it (an embed key is its own output, a
// spread's output is a field of its parent), with every property remapped (see `Plain`). The walk only enters a
// value whose path is an embed's own, so column values (a `Json`) pass through as written.
type PlainAt<V, OM, P extends string> = V extends readonly (infer U)[]
  ? PlainAt<U, OM, P>[]
  : V extends object
    ? {
        [K in keyof V as K extends string ? `${K}` : K]: K extends string
          ? (P extends '' ? K : `${P}.${K}`) extends infer Q extends string
            ? Q extends keyof OM
              ? OM[Q] extends Q
                ? PlainAt<V[K], OM, Q>
                : V[K]
              : V[K]
            : never
          : V[K]
      }
    : V
export type PlainRow<R, E> = IsAny<R> extends true ? any : PlainAt<R, OutMap<E>, ''>

export type DescOf<En> = En extends { error: string }
  ? never
  : En extends Unplanned
    ? Desc<Record<string, unknown>>
    : En extends { row: infer R }
      ? Desc<
          PlainRow<R, En extends { embeds: infer E } ? E : {}>,
          En extends { sources: infer S } ? S : {},
          En extends { embeds: infer E } ? E : {}
        >
      : never

// a bare `*`: provenance is synthesised, identity sources over the relation's FactColumns (the columns whose
// returned value is the stored value) and no embeds. Per member of a relation union, so each keeps its own columns.
export type StarOf<Rel> = Rel extends { Row: infer R }
  ? Desc<
      PlainRow<R, {}>,
      Rel extends { FactColumns: infer F extends string } ? { [K in keyof R & F]: K } : {}
    >
  : Desc<{}>

// an rpc call: the form decides cardinality; `*` carries the `source`'s sources (identity over its FactColumns)
export type CallBase<Call> = Call extends { form: 'rows' } ? 'many' : 'one'
export type CallSources<Call, Star extends boolean> = Call extends { sources: infer S }
  ? S
  : Star extends true
    ? Call extends { source: infer Src }
      ? [Src] extends [never]
        ? {}
        : Src extends { sources: infer S2 }
          ? S2
          : {}
      : {}
    : {}
// a call that reads a relation's columns returns rows of the wrapped column types; a scalar, or a function over no
// relation, returns its own types as written
type CallRowOf<Call, R> = Call extends { source: infer Src }
  ? [Src] extends [never]
    ? R
    : PlainRow<R, Call extends { embeds: infer E } ? E : {}>
  : R
export type RpcDesc<En, Star extends boolean = false> = En extends { error: string }
  ? never
  : En extends Untyped
    ? Desc<any, {}, {}, 'one'>
    : En extends Unplanned
      ? Desc<unknown, {}, {}, 'one'> // the call form is unknown: so is the data
      : En extends Dynamic
        ? Desc<unknown>
        : En extends { row: infer R }
          ? Desc<
              CallRowOf<En, R>,
              CallSources<En, Star>,
              En extends { embeds: infer E } ? E : {},
              CallBase<En>
            >
          : never

export type Descs<B extends BState, Q extends string> =
  IsUntyped<B> extends true
    ? B['k'] extends 'f'
      ? Desc<any, {}, {}, 'one'>
      : Desc<any>
    : true extends IsDynamic<Q>
      ? Desc<unknown>
      : Q extends unknown
        ? B['k'] extends 'f'
          ? RpcDesc<Entry<B, Q>, Q extends '*' ? true : false>
          : Q extends '*'
            ? B['st']
            : DescOf<Entry<B, Q>>
        : never

export type RowOf<Rel> = Rel extends { Row: infer R } ? R : {}

// ---------------------------------------------------------------- §4.3 filter operands
// on an rpc chain the operand entry is `{ calls }` too, matched by the same dispatch as the call
export type OperandEntry<B extends BState, C extends string> =
  IsUntyped<B> extends true
    ? { type: any }
    : true extends IsDynamic<B['q']>
      ? { type: unknown }
      : B['q'] extends infer Q extends string
        ? Q extends unknown
          ? Resolve<B, StoredOp<OKey<B, Q, C>>>
          : never
        : never

export type ValueOf<B extends BState, C extends string> = C extends keyof B['row']
  ? B['row'][C]
  : true extends IsDynamic<C>
    ? unknown
    : OperandEntry<B, C> extends infer En
      ? En extends { type: infer T }
        ? T
        : En extends Unplanned | Dynamic
          ? unknown
          : never
      : never

export type OperandReject<B extends BState, C extends string> =
  OperandEntry<B, C> extends infer En
    ? En extends { error: infer E extends string }
      ? E
      : En extends Unplanned
        ? Strict extends true
          ? UnplannedOperandMessage
          : never
        : never
    : never

export type ColArg<B extends BState, C extends string> =
  true extends IsDynamic<C>
    ? C
    : C extends keyof B['row']
      ? C
      : [OperandReject<B, C>] extends [never]
        ? C
        : OperandReject<B, C>

// ---------------------------------------------------------------- order columns
// an `.order()` column has the grammar of an order (`channels(id)` is a to-one embed's column, not a filter), so it is
// planned as an order and read from its own entries; an entry only says whether the planner accepts the column
export type OrderEntry<B extends BState, C extends string> =
  IsUntyped<B> extends true
    ? { ok: true }
    : true extends IsDynamic<B['q']>
      ? { ok: true }
      : B['q'] extends infer Q extends string
        ? Q extends unknown
          ? Resolve<B, StoredOp<OrdKey<B, Q, C>>>
          : never
        : never

export type OrderReject<B extends BState, C extends string> =
  OrderEntry<B, C> extends infer En
    ? En extends { error: infer E extends string }
      ? E
      : En extends Unplanned
        ? Strict extends true
          ? UnplannedOperandMessage
          : never
        : never
    : never

export type OrderArg<B extends BState, C extends string> =
  true extends IsDynamic<C>
    ? C
    : C extends keyof B['row']
      ? C
      : [OrderReject<B, C>] extends [never]
        ? C
        : OrderReject<B, C>

// `.match({ ... })`: each key is checked like the column of `.eq(key, value)`. A known key takes its value type (or
// `undefined`, which the runtime drops); one the operand lookup rejects takes the rejection message as its type, so the
// error names the key and says why. A dynamic key (`string`) takes any value.
export type MatchArg<B extends BState, Q> = {
  [K in keyof Q]: K extends string
    ? ColArg<B, K> extends infer R
      ? [R] extends [K]
        ? NonNullable<ValueOf<B, K>> | undefined
        : R
      : never
    : unknown
}

// ---------------------------------------------------------------- builder state of the entry points
export type Q0 = '*'
// the relation of a chain, derived from the client's Database so that the builder carries only names. `any` as the
// Database is an untyped client (`RelDefs`)
export type RelOf<DB, S extends string, R extends string> = RelDefs<DB, S>[R & keyof RelDefs<DB, S>]
// the chain of a select: the same relation, another select (a type of its own so the builder prints the chain it
// came from and not the expanded state)
export type Reselect<B extends BState, Q extends string> = BS<
  B['k'],
  B['s'],
  B['r'],
  B['row'],
  B['st'],
  Q,
  B['km']
>
// A hover prints a property as the annotation the generated declaration wrote (`SupabaseColumnType<…>`) whenever the
// type is that declaration's own. A remapped key is a fresh property with no declaration, so the hover prints its
// type. Keys, modifiers and value types are unchanged.
type Plain<T> =
  IsAny<T> extends true
    ? any
    : T extends readonly unknown[]
      ? T
      : T extends object
        ? { [K in keyof T as K extends string ? `${K}` : K]: T[K] }
        : T
export type InsertOf<DB, S extends string, R extends string> = Plain<
  RelOf<DB, S, R> extends infer Rel
    ? Rel extends { Insert: unknown }
      ? Rel['Insert']
      : never
    : never
>
export type UpdateOf<DB, S extends string, R extends string> = Plain<
  RelOf<DB, S, R> extends infer Rel
    ? Rel extends { Update: unknown }
      ? Rel['Update']
      : never
    : never
>
export type RB<DB, S extends string, R extends string, Q extends string> = BS<
  'r',
  SchemaOf<DB, S>,
  R,
  RowOf<RelOf<DB, S, R>>,
  StarOf<RelOf<DB, S, R>>,
  Q,
  never
>
export type WB<DB, S extends string, R extends string> = BS<
  'w',
  SchemaOf<DB, S>,
  R,
  RowOf<RelOf<DB, S, R>>,
  StarOf<RelOf<DB, S, R>>,
  Q0,
  never
>
