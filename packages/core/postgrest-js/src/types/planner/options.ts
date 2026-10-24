import type { Bag } from './distribute'
import type { BState, MS, MState } from './lookup'

// ---------------------------------------------------------------- options
export type SelectOptions = { head?: boolean; count?: 'exact' | 'planned' | 'estimated' }
export type RpcOptions = {
  get?: boolean
  head?: boolean
  count?: 'exact' | 'planned' | 'estimated'
}
export type RefOpts = {
  referencedTable?: string
  /** @deprecated Use `referencedTable` instead */
  foreignTable?: string
}

// what `head` asks of a read: HEAD, GET, or either when the value doesn't say (a weak-type `O extends { head?: false }`
// check would reject `{ count: 'exact' }`, which has no `head` at all). Every one takes one member's value.
type ReadOne<H> = [H] extends [true]
  ? 'HEAD'
  : [H] extends [false | undefined]
    ? 'GET'
    : 'GET' | 'HEAD'
export type ReadMethod<O> =
  Bag<O, 'head'> extends infer M ? (M extends { head: infer H } ? ReadOne<H> : never) : never
// a re-select adds to the request, it never takes anything back: the runtime only switches a GET to HEAD
// (`head` is ignored on a mutation, and on an rpc that doesn't send GET) and `Prefer` keeps the counts it has
export type SelOp<B extends BState, M extends MState, O> = M['op'] extends infer Op extends
  MState['op']
  ? Op extends 'GET'
    ? ReadMethod<O>
    : Op extends 'RPC'
      ? RpcSelOp<B['km'][1], O>
      : Op
  : never
// per possible rpc method: only GET becomes a HEAD
type RpcSelOp<Mth, O> = Mth extends 'GET' ? RpcOp<O> : 'RPC'
// the count state is a boolean: `true` the response definitely carries a count, `false` it doesn't, `boolean` it
// depends (a `count` option that is optional or may be `undefined`). `count` is sent when it is truthy, so a value
// type that includes `undefined` may or may not ask for it
type CountOne<C> = [C] extends [undefined]
  ? false
  : [undefined] extends [C]
    ? boolean
    : [C] extends [string]
      ? true
      : boolean
export type SelCount<O> =
  Bag<O, 'count'> extends infer M ? (M extends { count: infer C } ? CountOne<C> : never) : never
// the count preference of an earlier call stays in the request
export type OrCount<A extends boolean, B extends boolean> = [A] extends [true]
  ? true
  : [B] extends [true]
    ? true
    : [A | B] extends [false]
      ? false
      : boolean
// explain() and geojson() give a body to whatever method would have one: HEAD stays HEAD
export type KeepHead<Op> = Op extends 'HEAD' ? 'HEAD' : 'GET'

// rpc: the runtime sends exactly the method the options ask for: POST by default, GET with `get: true`, HEAD with
// `head: true` (head wins), and never switches on its own. Value types don't change it; the argument check refuses
// what GET and HEAD can't carry (`ReadRefusal` below). `head` and `get` together decide it, so the method is worked
// out for each member of the bag on its own and the members' methods are unioned.
type NoHeadOne<G> = [G] extends [true]
  ? 'GET'
  : [G] extends [false | undefined]
    ? 'POST'
    : 'GET' | 'POST'
type RequestedOne<H, G> = [H] extends [true]
  ? 'HEAD'
  : [H] extends [false | undefined]
    ? NoHeadOne<G>
    : 'HEAD' | NoHeadOne<G>
export type RequestedOf<O> =
  Bag<O, 'head' | 'get'> extends infer M
    ? M extends { head: infer H; get: infer G }
      ? RequestedOne<H, G>
      : never
    : never
// HEAD returns no body
type RpcOpOne<H> = [H] extends [true]
  ? 'HEAD'
  : [H] extends [false | undefined]
    ? 'RPC'
    : 'RPC' | 'HEAD'
export type RpcOp<O> =
  Bag<O, 'head'> extends infer M ? (M extends { head: infer H } ? RpcOpOne<H> : never) : never

// options of the mutation methods: a `count` asks for the Content-Range count
export type MutOptions = { count?: 'exact' | 'planned' | 'estimated' }
export type MutM<O, Ma extends boolean> = MS<
  'MUT',
  false,
  'many',
  'default',
  'json',
  false,
  SelCount<O>,
  false,
  Ma
>
