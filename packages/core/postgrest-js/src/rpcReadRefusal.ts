import PostgrestError from './PostgrestError'

/**
 * Stable `code` of the client-side error returned when `rpc()` refuses a `GET` or `HEAD` request. PostgREST error
 * codes all start with `PGRST` followed by digits, so this one can't collide with an upstream code.
 */
export const RPC_READ_REFUSAL_CODE = 'PGRSTJS01'

/**
 * A string argument starting with an operator expression. On `GET` and `HEAD` PostgREST reads arguments from the
 * query string and turns such a value into a filter on the result (or a parse error), so it can't be sent as an
 * argument. Upstream's grammar is `pOpExpr` in `QueryParams.hs`. The regex errs only towards refusing.
 *
 * The type-level twin is `OpName` in `src/types/planner/rpc.ts`; keep the two in sync.
 */
export const RPC_READ_OPERATOR_PATTERN =
  /^(not\.|in\.|is\.|isdistinct\.|(fts|plfts|phfts|wfts)(\([^)]*\))?\.|(neq|cs|cd|ov|sl|sr|nxr|nxl|adj)\.|(eq|gte|gt|lte|lt|like|ilike|match|imatch)(\((any|all)\))?\.)/

const RESERVED_KEYS = ['select', 'columns', 'on_conflict']
const RESERVED_LAST_SEGMENTS = ['order', 'limit', 'offset', 'and', 'or']

const isReservedKey = (key: string): boolean =>
  RESERVED_KEYS.includes(key) || RESERVED_LAST_SEGMENTS.includes(key.split('.').pop()!)

const isObjectValue = (value: unknown): boolean =>
  value !== null &&
  typeof value === 'object' &&
  (!Array.isArray(value) || value.some(isObjectValue))

/**
 * The reasons a `GET` or `HEAD` rpc can't carry `args` in its query string, one per offending argument. Arguments
 * whose value is `undefined` aren't sent, so they are not checked.
 */
export function rpcReadRefusals(args: object): string[] {
  const refusals: string[] = []
  for (const [key, value] of Object.entries(args)) {
    if (value === undefined) continue
    if (isReservedKey(key)) refusals.push(`GET and HEAD refuse the reserved key '${key}'`)
    if (isObjectValue(value)) refusals.push(`GET and HEAD refuse an object value for '${key}'`)
    else if (typeof value === 'string' && RPC_READ_OPERATOR_PATTERN.test(value))
      refusals.push(`GET and HEAD refuse a value read as a filter for '${key}'`)
  }
  return refusals
}

/** The client-side error for a refused `GET` or `HEAD` rpc, or `null` when `args` can be sent. */
export function rpcReadRefusal(args: object): PostgrestError | null {
  const refusals = rpcReadRefusals(args)
  if (refusals.length === 0) return null
  return new PostgrestError({
    message: refusals.join('; '),
    details: '',
    hint: 'Call the function with POST (omit `get` and `head`) to send the arguments in the request body.',
    code: RPC_READ_REFUSAL_CODE,
  })
}
