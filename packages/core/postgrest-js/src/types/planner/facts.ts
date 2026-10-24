import type { Bag } from './distribute'
import type { BState, Dynamic, IsDynamic, OperandEntry, Unplanned } from './lookup'

// ---------------------------------------------------------------- §6.3 facts
// F is an intersection of { cols?, embeds?, wide? }
export type Join<T extends readonly string[]> = T extends readonly [
  infer H extends string,
  ...infer R extends string[],
]
  ? R extends []
    ? H
    : `${H}.${Join<R>}`
  : never

export type EmbedPathOf<B extends BState, C extends string> =
  OperandEntry<B, C> extends infer En
    ? En extends { embed: infer P extends readonly string[] }
      ? Join<P>
      : never
    : never

// the path without its last segment: the embed a nested embed lives in (`never` at the root)
export type Init<T extends readonly string[]> = T extends readonly [
  ...infer H extends string[],
  string,
]
  ? Join<H>
  : never

// An embed filter (`.not('channels.channel_details', 'is', null)`) names the tested embed itself as the entry's
// `embed`. Its predicate runs inside the embed it is written under, so that enclosing embed is the one a failing
// row takes down with it.
export type EnclosingOf<B extends BState, C extends string> =
  OperandEntry<B, C> extends infer En
    ? En extends { embed: infer P extends readonly string[] }
      ? [Join<P>] extends [C]
        ? Init<P>
        : never
      : never
    : never

// facts on reads (GET / HEAD) and rpc (the filters constrain the returned rows); mutation filters constrain the old row
export type Gate<B extends BState, X> = B['k'] extends 'w' ? {} : X

// enum / boolean-like: a finite set of literals (text, numbers, json are not narrowed)
export type IsFinite<T> = T extends string
  ? string extends T
    ? false
    : true
  : T extends number
    ? number extends T
      ? false
      : true
    : T extends boolean
      ? true
      : false
export type Narrowable<T> =
  false extends IsFinite<NonNullable<T>> ? false : [NonNullable<T>] extends [never] ? false : true

export type ColFact<B extends BState, C extends string, T> = C extends keyof B['row']
  ? { cols: { [P in C]: T } }
  : {}
export type EqFact<B extends BState, C extends string, V> = C extends keyof B['row']
  ? Narrowable<B['row'][C]> extends true
    ? { cols: { [P in C]: V } }
    : {}
  : {}

// widening from embedded operands, or from a column the planner can't place (dynamic, no operand entry, or a dynamic
// select that leaves the row unknown: a later known select keeps the fact, so the filter can't be dropped as plain)
export type OpFacts<B extends BState, C extends string> =
  true extends IsDynamic<C>
    ? { wide: true }
    : C extends keyof B['row']
      ? {}
      : true extends IsDynamic<B['q']>
        ? { wide: true }
        : Unplanned extends OperandEntry<B, C>
          ? { wide: true }
          : Dynamic extends OperandEntry<B, C>
            ? { wide: true }
            : {
                embeds: { [P in EmbedPathOf<B, C> | EnclosingOf<B, C>]: { widen: true } }
              }

type UnionToIntersection<U> = (U extends unknown ? (x: U) => void : never) extends (
  x: infer I
) => void
  ? I
  : never
// the facts of filters on several columns at once (`match`)
export type MultiOpFacts<B extends BState, K extends string> = [K] extends [never]
  ? {}
  : UnionToIntersection<K extends unknown ? OpFacts<B, K> : never>

export type NotNullFact<B extends BState, C extends string> =
  true extends IsDynamic<C>
    ? {}
    : C extends keyof B['row']
      ? { cols: { [P in C]: {} } }
      : { embeds: { [P in EmbedPathOf<B, C> & C]: { nn: true } } }

// the tables an option may name, over every member of the bag: `never` when none ever has one (or only `undefined`),
// like the runtime's truthiness check. A member without it still contributes the others' tables.
export type RefTables<O> =
  Bag<O, 'referencedTable'> extends infer M
    ? M extends { referencedTable: infer T }
      ? Exclude<T, undefined> extends infer S extends string
        ? S
        : never
      : never
    : never
// the option may name an embed: its column belongs to that embed, not to the root
export type HasRef<O> = [RefTables<O>] extends [never] ? false : true

// a literal widens that embed, a non-literal one (or a possibly-present one) can be any: widen them all
export type RefFacts<O> =
  RefTables<O> extends infer T extends string
    ? [T] extends [never]
      ? {}
      : string extends T
        ? { wide: true }
        : { embeds: { [P in T]: { widen: true } } }
    : {}

export type Cols<F> = F extends { cols: infer C } ? C : {}
export type EmbedFactsOf<F, K> = F extends { embeds: infer Em }
  ? K extends keyof Em
    ? Em[K]
    : {}
  : {}

// Facts land on an embed's `outputs`: the result paths its join nullability reaches (the embed's own key, or the
// flattened fields of a spread). `OutMap` inverts them (output path -> embed key) from pre-split metadata, so a
// result path is looked up, never parsed. A spread's output differs from its embed key.
export type Outs<I> = I extends { outputs: infer O extends readonly (readonly string[])[] }
  ? Join<O[number]>
  : never
export type OutMap<E> = { [K in keyof E & string as Outs<E[K]>]: K }

// nn on an ordinary embed: the embed value is non-null. On a spread it only cancels the widening: the planned
// field type stays, because a spread field can be null on its own.
export type EmbedFact<V, Info, Em, F, Spread> = Em extends { nn: true }
  ? Spread extends true
    ? V
    : NonNullable<V>
  : (Em extends { widen: true } ? true : F extends { wide: true } ? true : false) extends true
    ? Info extends { join: 'left'; cardinality: 'one' }
      ? V | null
      : V
    : V

// Root-level fields go through `sources` (column facts) or `outputs` (embed facts). Embedded rows are
// walked only when some embed fact exists; their fields are keyed by the mapper's pre-joined result path
// (`messages.channels`), so applying a fact is a lookup, not a parse. Embedded columns aren't narrowed.
export type NeedsWalk<F> = F extends { embeds: unknown }
  ? true
  : F extends { wide: true }
    ? true
    : false

export type EmbedField<V, E, OM, F, Path, W> = W extends true
  ? Path extends keyof OM
    ? OM[Path] extends infer EK
      ? EmbedFact<
          Walk<V, E, OM, F, Path & string>,
          EK extends keyof E ? E[EK] : never,
          EmbedFactsOf<F, EK>,
          F,
          Path extends EK ? false : true
        >
      : V
    : V
  : V

export type Walk<V, E, OM, F, P extends string> = V extends readonly (infer U)[]
  ? Walk<U, E, OM, F, P>[]
  : V extends object
    ? { [K in keyof V]: EmbedField<V[K], E, OM, F, `${P}.${K & string}`, true> }
    : V

export type FieldFact<V, K, S, E, OM, F, W> = K extends keyof S
  ? S[K] extends keyof Cols<F>
    ? V & Cols<F>[S[K]]
    : V
  : EmbedField<V, E, OM, F, K, W>

// A `widen` fact is recorded on the embed path a filter names. The embed that actually turns null is the nearest
// left-joined to-one at or above it: the walk goes up through `!inner` joins (removing an inner-joined row removes its
// parent) and stops at a to-many (which loses elements, not its parent) or at the root.
export type Land<E, P> = P extends keyof E
  ? E[P] extends { cardinality: 'many' }
    ? never
    : E[P] extends { join: 'inner'; path: infer Pa extends readonly string[] }
      ? Land<E, Init<Pa>>
      : P
  : never

type KeysWith<Em, T> = { [K in keyof Em]: Em[K] extends T ? K : never }[keyof Em]

// the facts as the response applies them: `widen` on the embeds the walk lands on, `nn` where it was recorded
export type ResolveFacts<E, F> = F extends { embeds: infer Em }
  ? (F extends { cols: infer C } ? { cols: C } : {}) &
      (F extends { wide: true } ? { wide: true } : {}) & {
        embeds: { [K in Land<E, KeysWith<Em, { widen: true }>>]: { widen: true } } & {
          [K in KeysWith<Em, { nn: true }>]: { nn: true }
        }
      }
  : F

export type ApplyFacts<D, F> = D extends { row: infer R; sources: infer S; embeds: infer E }
  ? keyof F extends never
    ? R
    : R extends object
      ? ResolveFacts<E, F> extends infer Fx
        ? { [K in keyof R]: FieldFact<R[K], K, S, E, OutMap<E>, Fx, NeedsWalk<Fx>> }
        : never
      : R
  : never
