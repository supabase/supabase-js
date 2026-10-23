import type { BState, MS, MState } from './lookup'

// ---------------------------------------------------------------- options
export type SelectOptions = { head?: boolean; count?: 'exact' | 'planned' | 'estimated' }
export type RpcOptions = {
  get?: boolean
  head?: boolean
  count?: 'exact' | 'planned' | 'estimated'
}
export type RefOpts = { referencedTable?: string }

// the option's value, read per member of a union of option bags (`keyof` of a union only holds the shared keys, and
// `undefined`, an absent bag, has none): a literal, `undefined` when absent, `boolean` when the type doesn't say (a
// weak-type `O extends { head?: false }` check would reject `{ count: 'exact' }`, which has no `head` at all)
export type HeadOf<O> = O extends unknown ? ('head' extends keyof O ? O['head'] : undefined) : never
export type GetOf<O> = O extends unknown ? ('get' extends keyof O ? O['get'] : undefined) : never
// `{ head: boolean }` may send either
export type ReadMethod<O> = [HeadOf<O>] extends [true]
  ? 'HEAD'
  : [HeadOf<O>] extends [false | undefined]
    ? 'GET'
    : 'GET' | 'HEAD'
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
type CountOne<O> = 'count' extends keyof O
  ? [O['count']] extends [undefined]
    ? false
    : [undefined] extends [O['count']]
      ? boolean
      : [O['count']] extends [string]
        ? true
        : boolean
  : false
export type SelCount<O> = O extends unknown ? CountOne<O> : never
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
// what GET and HEAD can't carry (`ReadRefusal` below)
export type NoHeadOf<O> = [GetOf<O>] extends [true]
  ? 'GET'
  : [GetOf<O>] extends [false | undefined]
    ? 'POST'
    : 'GET' | 'POST'
export type RequestedOf<O> = [HeadOf<O>] extends [true]
  ? 'HEAD'
  : [HeadOf<O>] extends [false | undefined]
    ? NoHeadOf<O>
    : 'HEAD' | NoHeadOf<O>
// HEAD returns no body
export type RpcOp<O> = [HeadOf<O>] extends [true]
  ? 'HEAD'
  : [HeadOf<O>] extends [false | undefined]
    ? 'RPC'
    : 'RPC' | 'HEAD'

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
