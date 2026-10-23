#!/bin/zsh
# Negative controls for the type tests: each mutation of the type machinery (or of a test expectation) must make
# the type check fail. A mutation that is not detected means the tests don't protect that rule.
# usage: test/types/mutate.sh   (from anywhere; uses the package's own tsc)
cd "${0:A:h}/../.." || exit 1
T=$PWD/node_modules/.bin/tsc
P=src/types/planner
mut() { # file, sed-expr, mode, label
  rm -rf .mut && mkdir -p .mut/test && cp -r src .mut/ && cp -r test/types .mut/test/
  sed -i '' "$2" ".mut/$1"
  if cmp -s "$1" ".mut/$1"; then echo "NO-OP (sed matched nothing): $4"; rc=1; return; fi
  if $T --noEmit -p ".mut/test/types/tsconfig.$3.json" >/dev/null 2>&1; then echo "NOT DETECTED: $4"; rc=1; else echo "detected:     $4"; fi
}
rc=0
mut test/types/common/4-facts.test-d.ts "s/status: 'ONLINE' }\[\]>>$/status: Status | null }[]>>/;1,12s/{ username: string; status: 'ONLINE' }/{ username: string; status: Status | null }/" loose "eq narrowing expectation flipped"
mut test/types/common/5-embeds.test-d.ts "s/_5b = Expect<Equal<Data<typeof w>, { id: number; channels: { id: number } | null }/_5b = Expect<Equal<Data<typeof w>, { id: number; channels: { id: number } }/" loose "embed widening expectation flipped"
mut test/types/common/1-union.test-d.ts "s#// @ts-expect-error#// ok#" loose "rejection no longer expected"
mut test/types/common/7-response.test-d.ts "s/{ username: string; status?: Status }\[\]/{ username: string; status: Status | null }[]/" loose "stripNulls expectation flipped"
mut test/types/strict/strict.test-d.ts "s#// @ts-expect-error#// ok#" strict "strict rejection no longer expected"
mut src/PostgrestFilterBuilder.ts "s/F \& Gate<B, OpFacts<B, C> \& EqFact<B, C, V>>, M>\$/F, M>/" loose "eq stops adding facts"
mut $P/facts.ts "s/export type Gate<B extends BState, X> = B\['k'\] extends 'w' ? {} : X/export type Gate<B extends BState, X> = X/" loose "facts applied on mutations"
mut $P/lookup.ts "s/? \[HM\] extends \[Mth\]/? [HM] extends [string]/" loose "rpc dispatch ignores the method"
mut $P/rpc.ts "s/^export type KeyMethods<A, O> = A extends unknown\$/export type KeyMethods<A, O> = [A] extends [unknown]/" loose "rpc key sets stop distributing over argument unions"
mut $P/rpc.ts "s/? \[SureKeys<A> | X\]/? [SureKeys<A>]/" loose "rpc maybe-keys dropped from the key set"
mut $P/facts.ts "s/^  ? Spread extends true\$/  ? Spread extends 0/" loose "spread .not narrows like an ordinary embed"
mut test/types/common/13-spread.test-d.ts "s/channel_key: number | null }\[\]>>/channel_key: number }[]>>/" loose "spread widening expectation flipped"
mut $P/rpc.ts "s/K extends NeverKeys<A> ? never : //g" loose "never-keys treated as maybe-keys"
mut $P/rpc.ts "s/All<IsObj<Exclude<A\[K\], undefined>>> extends true/All<IsObj<Exclude<A[K], undefined>>> extends 0/" loose "object values no longer rejected under GET and HEAD"
mut $P/rpc.ts "s/All<IsOp<Exclude<A\[K\], undefined>>> extends true/All<IsOp<Exclude<A[K], undefined>>> extends 0/" loose "operator-looking strings no longer rejected under GET and HEAD"
mut $P/rpc.ts "s/: LastSegment<K> extends/: K extends/" loose "reserved last-segment rule weakened to exact match"
mut $P/options.ts "s/    : 'HEAD' | NoHeadOne<G>/    : NoHeadOne<G>/" loose "non-literal head flag yields one method"
mut $P/options.ts "s/    : 'GET' | 'POST'\$/    : 'POST'/" loose "non-literal get flag yields one method"
mut $P/options.ts "s/    ? M extends { head: infer H; get: infer G }/    ? [M] extends [{ head: infer H; get: infer G }]/" loose "rpc method worked out over the whole option bag union"
mut $P/facts.ts "s/    ? M extends { referencedTable: infer T }/    ? [M] extends [{ referencedTable: infer T }]/" loose "referenced tables read over the whole option bag union"
mut $P/distribute.ts "s/^export type Selected<Q> = Q extends undefined ? Q0 : Q/export type Selected<Q> = Exclude<Q, undefined>/" loose "an undefined select string no longer means select=*"
mut $P/rpc.ts "s/Calls extends { method: 'HEAD' }/Calls extends { method: 'NONE' }/" loose "head rows leak into the other branch of a non-literal head flag"
mut $P/rpc.ts "s/? KeyRefusal<A, SureKeys<A> | MaybeKeys<A>>/? KeyRefusal<A, SureKeys<A>>/" loose "maybe-keys no longer checked under GET and HEAD"
mut $P/lookup.ts "s/{ \[K in keyof R \& F\]: K }/{ [K in keyof R \& string]: K }/" loose "star sources not limited to FactColumns"
mut $P/facts.ts "/string extends T\$/{n;s/{ wide: true }/{}/;}" loose "non-literal referencedTable doesn't widen"
rm -rf .mut
exit $rc
