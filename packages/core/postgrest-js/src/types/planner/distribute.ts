import type { BState, Q0, Validate } from './lookup'

// What a call receives is read per possible value, never as one merged value: a union of option bags, an absent
// bag (`undefined`) and a select string that may be `undefined` are each a possible request. Whatever is worked out
// from the options is worked out for one member and then unioned: reading the keys of the union as a whole drops the
// ones a member doesn't have, and combining two options after reading each over the whole union pairs values no
// single member holds (`{ head: true; get: true } | { count: 'exact' }` has no member that sends HEAD and GET).

// a select string that may be `undefined` is `select=*` for that member
export type Selected<Q> = Q extends undefined ? Q0 : Q

// the select argument: the literal(s) checked one by one, and `undefined` stays acceptable. `Q` is inferred whole,
// `undefined` included (a plain optional parameter would drop it before inference).
export type ColumnsArg<B extends BState, Q extends string | undefined> = [Q] extends [unknown]
  ? Validate<B, Exclude<Q, undefined>> | Extract<Q, undefined>
  : never
