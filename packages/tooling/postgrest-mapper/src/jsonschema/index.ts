/**
 * JSON Schema to TypeScript (design v5 §6.1).
 *
 * Pure: a parsed schema in, a TypeScript type expression out. The result is always a superset of the values the
 * schema accepts: a keyword that only narrows (`pattern`, `minimum`, `not`, ...) is ignored, a construct that
 * cannot be expressed widens to `unknown` at that position, and nothing is ever guessed narrower than the schema.
 *
 * Supported: `type` (string or array), `enum`, `const`, `properties`, `required`, `additionalProperties`,
 * `patternProperties` (widening only), `items`, `additionalItems`, `minItems` (tuples only),
 * `anyOf`, `oneOf`, `allOf`, `nullable`, `$ref` into the same document, and the boolean schemas `true` / `false`.
 * Details of every widening rule are in the README.
 */

export interface JsonSchemaToTsOptions {
  /** Name of the TypeScript type for "any JSON value". Defaults to `Json`. */
  jsonType?: string
}

/** Deepest schema nesting converted before the position widens to `unknown`. */
const MAX_DEPTH = 64

interface Ty {
  ts: string
  /** assignable to the configured JSON type (no `unknown`, no `undefined` in it) */
  json: boolean
  /** 0 atom (safe as an array element), 1 intersection, 2 union */
  prec: 0 | 1 | 2
  /** flattened members of a union or intersection */
  parts?: Ty[]
}

interface Ctx {
  root: unknown
  json: Ty
  refStack: string[]
}

const UNKNOWN: Ty = { ts: 'unknown', json: false, prec: 0 }
const NEVER: Ty = { ts: 'never', json: true, prec: 0 }
const UNDEFINED: Ty = { ts: 'undefined', json: false, prec: 0 }
const NULL: Ty = { ts: 'null', json: true, prec: 0 }

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function quote(value: string): string {
  return (
    "'" +
    value.replace(/[\\'\u0000-\u001f\u2028\u2029]/g, (ch) => {
      switch (ch) {
        case '\\':
          return '\\\\'
        case "'":
          return "\\'"
        case '\n':
          return '\\n'
        case '\r':
          return '\\r'
        case '\t':
          return '\\t'
        default:
          return '\\u' + ch.charCodeAt(0).toString(16).padStart(4, '0')
      }
    }) +
    "'"
  )
}

function propertyKey(name: string): string {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(name) ? name : quote(name)
}

function wrap(ty: Ty, maxPrec: 0 | 1): string {
  return ty.prec > maxPrec ? `(${ty.ts})` : ty.ts
}

function union(tys: Ty[]): Ty {
  const flat: Ty[] = []
  const seen = new Set<string>()
  for (const ty of tys.flatMap((t) => (t.prec === 2 && t.parts ? t.parts : [t]))) {
    if (ty.ts === 'never' || seen.has(ty.ts)) continue
    seen.add(ty.ts)
    flat.push(ty)
  }
  if (flat.some((t) => t.ts === 'unknown')) return UNKNOWN
  if (flat.length === 0) return NEVER
  if (flat.length === 1) return flat[0]
  return {
    ts: flat.map((t) => wrap(t, 1)).join(' | '),
    json: flat.every((t) => t.json),
    prec: 2,
    parts: flat,
  }
}

function intersect(tys: Ty[], json: Ty): Ty {
  const flat: Ty[] = []
  const seen = new Set<string>()
  let sawJson = false
  for (const ty of tys.flatMap((t) => (t.prec === 1 && t.parts ? t.parts : [t]))) {
    if (ty.ts === 'never') return NEVER
    // `unknown` and the JSON type are identities here: they only widen what the other members already say
    if (ty.ts === 'unknown') continue
    if (ty.ts === json.ts) {
      sawJson = true
      continue
    }
    if (seen.has(ty.ts)) continue
    seen.add(ty.ts)
    flat.push(ty)
  }
  if (flat.length === 0) return sawJson ? json : UNKNOWN
  if (flat.length === 1) return flat[0]
  return {
    ts: flat.map((t) => wrap(t, 0)).join(' & '),
    json: flat.some((t) => t.json),
    prec: 1,
    parts: flat,
  }
}

function literal(value: unknown): Ty {
  if (value === null) return NULL
  switch (typeof value) {
    case 'string':
      return { ts: quote(value), json: true, prec: 0 }
    case 'number':
    case 'boolean':
      return { ts: String(value), json: true, prec: 0 }
  }
  if (Array.isArray(value)) {
    return { ts: `[${value.map((v) => literal(v).ts).join(', ')}]`, json: true, prec: 0 }
  }
  if (isObject(value)) {
    const members = Object.entries(value).map(([k, v]) => `${propertyKey(k)}: ${literal(v).ts}`)
    return { ts: members.length ? `{ ${members.join('; ')} }` : '{}', json: true, prec: 0 }
  }
  return UNKNOWN
}

function declaredTypes(schema: Record<string, unknown>): string[] | undefined {
  const { type } = schema
  if (typeof type === 'string') return [type]
  if (Array.isArray(type) && type.every((t) => typeof t === 'string')) return type as string[]
  return undefined
}

function matchesType(value: unknown, types: string[]): boolean {
  return types.some((type) => {
    switch (type) {
      case 'string':
        return typeof value === 'string'
      case 'number':
        return typeof value === 'number'
      case 'integer':
        return typeof value === 'number' && Number.isInteger(value)
      case 'boolean':
        return typeof value === 'boolean'
      case 'null':
        return value === null
      case 'array':
        return Array.isArray(value)
      case 'object':
        return isObject(value)
      default:
        return true
    }
  })
}

function resolvePointer(ref: string, root: unknown): unknown {
  if (ref === '#') return root
  if (!ref.startsWith('#/')) return undefined
  let current: unknown = root
  for (const raw of ref.slice(2).split('/')) {
    let segment: string
    try {
      segment = decodeURIComponent(raw)
    } catch {
      return undefined
    }
    segment = segment.replace(/~1/g, '/').replace(/~0/g, '~')
    if (Array.isArray(current)) {
      if (!/^(0|[1-9][0-9]*)$/.test(segment)) return undefined
      current = current[Number(segment)]
    } else if (isObject(current) && Object.prototype.hasOwnProperty.call(current, segment)) {
      current = current[segment]
    } else {
      return undefined
    }
  }
  return current
}

function reference(ref: unknown, ctx: Ctx, depth: number): Ty {
  if (typeof ref !== 'string' || ctx.refStack.includes(ref)) return UNKNOWN
  const target = resolvePointer(ref, ctx.root)
  if (target === undefined) return UNKNOWN
  ctx.refStack.push(ref)
  try {
    return convert(target, ctx, depth + 1)
  } finally {
    ctx.refStack.pop()
  }
}

// pg_jsonschema ignores `prefixItems` under every dialect (checked against 0.3.3), so it never
// constrains an element; only the array form of `items` (with `additionalItems`) makes a tuple.
function arrayType(schema: Record<string, unknown>, ctx: Ctx, depth: number): Ty {
  const prefix = Array.isArray(schema.items) ? schema.items : undefined
  const rest = prefix ? schema.additionalItems : schema.items
  const restType = rest === undefined || rest === true ? ctx.json : convert(rest, ctx, depth + 1)

  if (!prefix) {
    if (restType.ts === 'never') return { ts: '[]', json: true, prec: 0 }
    return { ts: `${wrap(restType, 0)}[]`, json: restType.json, prec: 0 }
  }

  const required = Math.min(
    typeof schema.minItems === 'number' ? schema.minItems : 0,
    prefix.length
  )
  const elements = prefix.map((item, index) => {
    const ty = convert(item, ctx, depth + 1)
    return { ty, text: index < required ? ty.ts : `${wrap(ty, 0)}?` }
  })
  const members = elements.map((e) => e.text)
  if (restType.ts !== 'never') members.push(`...${wrap(restType, 0)}[]`)
  return {
    ts: `[${members.join(', ')}]`,
    json: elements.every((e) => e.ty.json) && restType.json,
    prec: 0,
  }
}

function objectType(schema: Record<string, unknown>, ctx: Ctx, depth: number): Ty {
  const properties = isObject(schema.properties) ? schema.properties : {}
  const requiredNames = new Set(
    Array.isArray(schema.required)
      ? schema.required.filter((n): n is string => typeof n === 'string')
      : []
  )
  const hasPatterns = isObject(schema.patternProperties)

  // Values of names that the schema leaves open (`null`: closed object).
  const additional = schema.additionalProperties
  let open: Ty | null
  if (hasPatterns) open = UNKNOWN
  else if (additional === false) open = null
  else if (additional === undefined || additional === true) open = ctx.json
  else open = convert(additional, ctx, depth + 1)

  const named: Array<{ name: string; ty: Ty; optional: boolean }> = []
  for (const [name, sub] of Object.entries(properties)) {
    named.push({ name, ty: convert(sub, ctx, depth + 1), optional: !requiredNames.has(name) })
  }
  // A required name without a `properties` entry: its value is whatever the open positions allow.
  for (const name of requiredNames) {
    if (!Object.prototype.hasOwnProperty.call(properties, name)) {
      named.push({ name, ty: open ?? ctx.json, optional: false })
    }
  }

  const members = named.map((p) => `${propertyKey(p.name)}${p.optional ? '?' : ''}: ${p.ty.ts}`)
  const anyOptional = named.some((p) => p.optional)
  let json = !anyOptional && named.every((p) => p.ty.json)

  if (open) {
    // TypeScript requires every named property to fit the index signature, so the signature is the union of the
    // open type, each named type (already covered when the open type is the JSON type and the name is JSON), and
    // `undefined` for an optional name.
    const covering = open.ts === ctx.json.ts
    const value = union([
      open,
      ...named.filter((p) => !(covering && p.ty.json)).map((p) => p.ty),
      ...(anyOptional ? [UNDEFINED] : []),
    ])
    members.push(`[k: string]: ${value.ts}`)
    json = json && open.json
  } else if (members.length === 0) {
    members.push('[k: string]: never')
  }
  return { ts: members.length ? `{ ${members.join('; ')} }` : '{}', json, prec: 0 }
}

function typeArm(type: string, schema: Record<string, unknown>, ctx: Ctx, depth: number): Ty {
  switch (type) {
    case 'string':
      return { ts: 'string', json: true, prec: 0 }
    case 'number':
    case 'integer':
      return { ts: 'number', json: true, prec: 0 }
    case 'boolean':
      return { ts: 'boolean', json: true, prec: 0 }
    case 'null':
      return NULL
    case 'array':
      return arrayType(schema, ctx, depth)
    case 'object':
      return objectType(schema, ctx, depth)
    default:
      return UNKNOWN
  }
}

function baseType(schema: Record<string, unknown>, ctx: Ctx, depth: number): Ty | undefined {
  const types = declaredTypes(schema)
  if ('const' in schema) return literal(schema.const)
  if (Array.isArray(schema.enum)) {
    const values = types ? schema.enum.filter((v) => matchesType(v, types)) : schema.enum
    return union(values.map(literal))
  }
  // Without `type`, the type-specific keywords (`properties`, `items`, ...) do not constrain non-objects or
  // non-arrays, so the schema says nothing the converter can use.
  if (!types) return undefined
  return union(types.map((t) => typeArm(t, schema, ctx, depth)))
}

function convert(schema: unknown, ctx: Ctx, depth: number): Ty {
  if (schema === true) return ctx.json
  if (schema === false) return NEVER
  if (!isObject(schema) || depth > MAX_DEPTH) return UNKNOWN

  // A `$ref` is the whole schema: siblings apply in draft 2019-09 and later and are ignored before it, and the
  // referenced type is a superset of both readings.
  if ('$ref' in schema) return reference(schema.$ref, ctx, depth)

  const parts: Ty[] = []
  const base = baseType(schema, ctx, depth)
  if (base) parts.push(base)
  if (Array.isArray(schema.allOf)) {
    for (const sub of schema.allOf) parts.push(convert(sub, ctx, depth + 1))
  }
  for (const key of ['anyOf', 'oneOf'] as const) {
    const branches = schema[key]
    if (Array.isArray(branches) && branches.length > 0) {
      parts.push(union(branches.map((sub) => convert(sub, ctx, depth + 1))))
    }
  }

  let result = parts.length > 0 ? intersect(parts, ctx.json) : ctx.json
  if (schema.nullable === true && result.ts !== ctx.json.ts) result = union([result, NULL])
  return result
}

/**
 * Converts a parsed JSON Schema document into a TypeScript type expression.
 *
 * The output is deterministic: members keep the schema's order, duplicates are removed, property names are
 * quoted only when they are not identifiers, and the whole type is on one line.
 */
export function jsonSchemaToTs(schema: unknown, options: JsonSchemaToTsOptions = {}): string {
  const name = options.jsonType ?? 'Json'
  const json: Ty = { ts: name, json: true, prec: 0 }
  return convert(schema, { root: schema, json, refStack: [] }, 0).ts
}
