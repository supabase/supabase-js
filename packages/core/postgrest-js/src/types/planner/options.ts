import type { BState, MS, MState } from './lookup'

// ---------------------------------------------------------------- options
export type SelectOptions = { head?: boolean; count?: 'exact' | 'planned' | 'estimated' }
export type RpcOptions = {
  get?: boolean
  head?: boolean
  count?: 'exact' | 'planned' | 'estimated'
}
export type RefOpts = { referencedTable?: string }

// the option's value: a literal, `undefined` when absent, `boolean` when the type doesn't say (a weak-type
// `O extends { head?: false }` check would reject `{ count: 'exact' }`, which has no `head` at all)
export type HeadOf<O> = 'head' extends keyof O ? O['head'] : undefined
export type GetOf<O> = 'get' extends keyof O ? O['get'] : undefined
// `{ head: boolean }` may send either
export type ReadMethod<O> = [HeadOf<O>] extends [true]
  ? 'HEAD'
  : [HeadOf<O>] extends [false | undefined]
    ? 'GET'
    : 'GET' | 'HEAD'
// a re-select keeps a mutation's / rpc's method
export type SelOp<B extends BState, M extends MState, O> = B['k'] extends 'r'
  ? ReadMethod<O>
  : M['op']
export type SelCount<O> = O extends { count: string } ? true : false

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
