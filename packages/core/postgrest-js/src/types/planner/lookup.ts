import type { Strict, UnplannedOperandMessage, UnplannedSelectMessage } from './globals'

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
export type Unplanned = { unplanned: true }
// an rpc whose key set can't be enumerated: nothing to look up, rows unknown
export type Dynamic = { dynamic: true }

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
  ? Resolve<B, Stored<Key<B, Q>>>
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
export type DescOf<En> = En extends { error: string }
  ? never
  : En extends Unplanned
    ? Desc<Record<string, unknown>>
    : En extends { row: infer R }
      ? Desc<R, En extends { sources: infer S } ? S : {}, En extends { embeds: infer E } ? E : {}>
      : never

// a bare `*`: provenance is synthesised, identity sources over the relation's FactColumns (the columns whose
// returned value is the stored value) and no embeds. Per member of a relation union, so each keeps its own columns.
export type StarOf<Rel> = Rel extends { Row: infer R }
  ? Desc<R, Rel extends { FactColumns: infer F extends string } ? { [K in keyof R & F]: K } : {}>
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
export type RpcDesc<En, Star extends boolean = false> = En extends { error: string }
  ? never
  : En extends Unplanned
    ? Desc<unknown, {}, {}, 'one'> // the call form is unknown: so is the data
    : En extends Dynamic
      ? Desc<unknown>
      : En extends { row: infer R }
        ? Desc<R, CallSources<En, Star>, En extends { embeds: infer E } ? E : {}, CallBase<En>>
        : never

export type Descs<B extends BState, Q extends string> =
  true extends IsDynamic<Q>
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
  true extends IsDynamic<B['q']>
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

// ---------------------------------------------------------------- builder state of the entry points
export type Q0 = '*'
export type RB<S extends string, R extends string, Rel, Q extends string> = BS<
  'r',
  S,
  R,
  RowOf<Rel>,
  StarOf<Rel>,
  Q,
  never
>
export type WB<S extends string, R extends string, Rel> = BS<
  'w',
  S,
  R,
  RowOf<Rel>,
  StarOf<Rel>,
  Q0,
  never
>
