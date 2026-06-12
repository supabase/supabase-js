#!/usr/bin/env node

/**
 * Generate sdk-compliance.yaml from the public API surface of each core package.
 *
 * supabase-js is the source of truth for the Supabase SDK capability matrix.
 * This script walks each package's typedoc spec.json, collects public methods
 * on the main client classes, snake_cases them, and emits one
 * `<area>.<snake_method>: implemented` entry per method.
 *
 * Run after the typedoc spec.json files are up to date (regenerate via the
 * docs target on each package).
 *
 * Usage:
 *   pnpm tsx scripts/audit-sdk-compliance.ts [--out <path>]
 *
 * Default output: sdk-compliance.draft.yaml (never overwrites sdk-compliance.yaml).
 *
 * To wire a new public class into the matrix: add its name (or a source-file
 * regex) to the AREAS list below. To suppress a method that appears in multiple
 * classes as boilerplate, add it to DENYLIST.
 */

import * as fs from 'fs'
import * as path from 'path'

type ClassMatcher = string | RegExp

// Splits an overloaded method into one feature per first-param literal value.
// See sync-canon.ts for the rationale; realtime's RealtimeChannel.on() is
// currently the only consumer.
interface SignatureSplitConfig {
  method: string
  by: 'first-param-literal'
  idStem?: (literalValue: string) => string
  filter?: (literalValue: string) => boolean
}

interface AreaConfig {
  area: string
  pkg: string
  // A class is included if its name equals a string matcher, OR if its first
  // source file path matches a regex matcher. Both forms are useful: default-
  // exported classes (e.g. StorageFileApi) lose their name in typedoc and have
  // to be matched by file path.
  matchers: ClassMatcher[]
  signatureSplit?: SignatureSplitConfig[]
}

const AREAS: AreaConfig[] = [
  {
    area: 'auth',
    pkg: 'auth-js',
    matchers: [
      'GoTrueClient',
      'GoTrueAdminApi',
      'GoTrueAdminMFAApi',
      'GoTrueAdminOAuthApi',
      'GoTrueAdminPasskeyApi',
      'GoTrueAdminCustomProvidersApi',
      'GoTrueMFAApi',
      'AuthOAuthServerApi',
      'WebAuthnApi',
    ],
  },
  {
    area: 'database',
    pkg: 'postgrest-js',
    matchers: [
      'PostgrestClient',
      'PostgrestQueryBuilder',
      'PostgrestFilterBuilder',
      'PostgrestTransformBuilder',
    ],
  },
  {
    area: 'storage',
    pkg: 'storage-js',
    matchers: [
      'StorageClient',
      'StorageVectorsClient',
      'VectorBucketScope',
      'VectorIndexScope',
      /StorageFileApi\.ts$/,
      /StorageBucketApi\.ts$/,
    ],
  },
  {
    area: 'realtime',
    pkg: 'realtime-js',
    matchers: ['RealtimeClient', 'RealtimeChannel'],
    signatureSplit: [
      {
        method: 'on',
        by: 'first-param-literal',
        // Yields realtime.broadcast / realtime.presence / realtime.postgres_changes.
        // 'system' is filtered as a non-user-facing connection-event channel.
        idStem: (v) => v,
        filter: (v) => v !== 'system',
      },
    ],
  },
  {
    area: 'functions',
    pkg: 'functions-js',
    matchers: ['FunctionsClient'],
  },
]

// Method names never collected as canonical features. Two reasons live here:
//   - boilerplate plumbing (then/catch/finally/toJSON/dispose/log/...)
//   - public-but-not-a-capability internals (copyBindings, sendHeartbeat,
//     teardown, updateJoinPayload, initialize, toBase64) — flagged by review.
//
// Inherited methods from un-matched base classes (PostgrestBuilder's setHeader
// / abortSignal / throwOnError / overrideTypes / returns / retry) are dropped
// automatically by collectMethods via the `inheritedFrom` check — no entries
// needed here.
const DENYLIST = new Set<string>([
  'then',
  'catch',
  'finally',
  'toJSON',
  'dispose',
  'log',
  'isThrowOnErrorEnabled',
  // Public-but-not-capability internals — flagged by review.
  'copyBindings',
  'sendHeartbeat',
  'teardown',
  'updateJoinPayload',
  'initialize',
  'toBase64',
  // Builder-level modifiers: JS-specific plumbing, not real capabilities.
  // (grdsdev review on supabase/sdk#18.) Re-declared on PostgrestTransform-
  // Builder with @subcategory tags, so the inheritance check above doesn't
  // catch them — explicit denylist instead.
  'abortSignal',
  'throwOnError',
  'overrideTypes',
  'returns',
  'retry',
  'setHeader',
])

const REPO_ROOT = path.resolve(__dirname, '..')

interface ParamType {
  type?: string
  value?: string | number | boolean | null
}

interface SpecSignature {
  parameters?: { type?: ParamType; name?: string }[]
}

interface SpecNode {
  name?: string
  kind?: number
  children?: SpecNode[]
  sources?: { fileName?: string }[]
  signatures?: SpecSignature[]
  inheritedFrom?: { name?: string }
}

interface CliArgs {
  out: string
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = { out: path.join(REPO_ROOT, 'sdk-compliance.draft.yaml') }
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i]
    const next = argv[i + 1]
    if (flag === '--out' && next) {
      args.out = path.resolve(next)
      i++
    } else if (flag === '-h' || flag === '--help') {
      console.log('Usage: pnpm tsx scripts/audit-sdk-compliance.ts [--out <path>]')
      process.exit(0)
    }
  }
  return args
}

function readSpec(pkg: string): SpecNode {
  const spec = path.join(REPO_ROOT, 'packages', 'core', pkg, 'docs', 'v2', 'spec.json')
  if (!fs.existsSync(spec)) {
    throw new Error(
      `Missing typedoc spec: ${spec}\n` +
        `Run the docs target for ${pkg} to regenerate spec.json before auditing.`
    )
  }
  return JSON.parse(fs.readFileSync(spec, 'utf8')) as SpecNode
}

function matches(node: SpecNode, ms: ClassMatcher[]): boolean {
  const sourceFile = node.sources?.[0]?.fileName ?? ''
  for (const m of ms) {
    if (typeof m === 'string') {
      if (node.name === m) return true
    } else if (m.test(sourceFile)) {
      return true
    }
  }
  return false
}

function classDisplayName(node: SpecNode): string {
  if (node.name && node.name !== 'default') return node.name
  const file = node.sources?.[0]?.fileName ?? ''
  return path.basename(file).replace(/\.(ts|tsx|js)$/, '') || 'default'
}

function collectMatchedClassNames(spec: SpecNode, ms: ClassMatcher[]): Set<string> {
  const names = new Set<string>()
  function visit(node: SpecNode): void {
    if (!node || typeof node !== 'object') return
    if ((node.kind === 128 || node.kind === 256) && matches(node, ms)) {
      names.add(classDisplayName(node))
    }
    if (Array.isArray(node.children)) for (const c of node.children) visit(c)
  }
  visit(spec)
  return names
}

function collectFirstParamLiterals(node: SpecNode): string[] {
  const seen = new Set<string>()
  const order: string[] = []
  for (const sig of node.signatures ?? []) {
    const t = sig.parameters?.[0]?.type
    if (t?.type === 'literal' && typeof t.value === 'string' && !seen.has(t.value)) {
      seen.add(t.value)
      order.push(t.value)
    }
  }
  return order
}

// Walk the spec and collect every method name that should become a feature id-
// stem. Two rules:
//   - skip a method when `inheritedFrom` points to a class outside the area's
//     matcher list — the boilerplate base (e.g. PostgrestBuilder) is not in
//     scope, so its methods aren't capabilities. Methods inherited *from*
//     another matched class are also skipped here; the declaring class will
//     surface them on its own visit.
//   - for methods configured via signatureSplit, emit one id-stem per unique
//     first-param literal (snake-cased downstream).
//
// Duplicate method names across multiple matched classes (e.g. `signOut` on
// both GoTrueClient and GoTrueAdminApi) collapse into a single entry — the
// Set deduplicates, and the yaml schema requires unique feature IDs anyway.
function collectMethods(
  spec: SpecNode,
  area: AreaConfig,
  seen: { duplicates: number }
): Set<string> {
  const matchedClassNames = collectMatchedClassNames(spec, area.matchers)
  const splitConfigByMethod = new Map<string, SignatureSplitConfig>()
  for (const cfg of area.signatureSplit ?? []) splitConfigByMethod.set(cfg.method, cfg)

  const found = new Set<string>()

  function visit(node: SpecNode, insideMatched: boolean): void {
    if (!node || typeof node !== 'object') return
    const isClass = node.kind === 128 || node.kind === 256
    const inside = insideMatched || (isClass && matches(node, area.matchers))
    if (inside && node.kind === 2048 && typeof node.name === 'string' && !DENYLIST.has(node.name)) {
      const inheritedFromName = node.inheritedFrom?.name?.split('.')[0]
      const isInherited = !!inheritedFromName
      // Drop both "inherited from un-matched class" (not a capability) and
      // "inherited from another matched class" (declaring class will emit it).
      if (!isInherited) {
        const split = splitConfigByMethod.get(node.name)
        if (split) {
          const literals = collectFirstParamLiterals(node)
          for (const literal of literals) {
            if (split.filter && !split.filter(literal)) continue
            const id = split.idStem ? split.idStem(literal) : literal
            if (found.has(id)) seen.duplicates++
            else found.add(id)
          }
        } else if (found.has(node.name)) {
          seen.duplicates++
        } else {
          found.add(node.name)
        }
      }
    }
    if (Array.isArray(node.children)) {
      for (const c of node.children) visit(c, inside)
    }
  }

  visit(spec, false)
  return found
}

// Known acronyms that should NOT be split mid-run by camelToSnake. Without
// this pre-pass, signInWithOAuth becomes sign_in_with_o_auth because the
// second regex splits OAuth → O_Auth. We pre-normalize OAuth → Oauth (and
// similar) so only the first regex fires, yielding sign_in_with_oauth.
// Keep in sync with sync-canon.ts.
const ACRONYMS = ['OAuth', 'URL', 'SSO', 'JWT', 'JWKS', 'API', 'PKCE', 'OIDC', 'MFA', 'AAL']

function preNormalizeAcronyms(name: string): string {
  let s = name
  for (const a of ACRONYMS) {
    s = s.replace(new RegExp(a, 'g'), a[0] + a.slice(1).toLowerCase())
  }
  return s
}

// camelCase / PascalCase → snake_case. Handles the common boundary
// (lower→upper) and acronym-followed-by-word boundary (XYa → X_Ya, e.g.
// regexIMatch → regex_i_match). Known acronyms like OAuth are pre-normalized
// to avoid being mistakenly split (signInWithOAuth → sign_in_with_oauth).
function camelToSnake(name: string): string {
  return preNormalizeAcronyms(name)
    .replace(/([a-z\d])([A-Z])/g, '$1_$2')
    .replace(/([A-Z])([A-Z][a-z])/g, '$1_$2')
    .toLowerCase()
}

function emitYaml(areaMethods: Map<string, string[]>, out: string): void {
  const lines: string[] = [
    '# Compliance with the canonical Supabase SDK capability matrix.',
    '# Spec: https://github.com/supabase/sdk',
    '#',
    '# Generated from typedoc spec.json files of each core package. supabase-js',
    '# is the source of truth for the capability matrix; canon is derived from',
    '# this file.',
    '#',
    '# Unlisted features default to not_implemented.',
    '# To regenerate, run:',
    '#   pnpm tsx scripts/audit-sdk-compliance.ts',
    '',
    'sdk: javascript',
    '',
    'features:',
  ]

  for (const { area } of AREAS) {
    const methods = areaMethods.get(area) ?? []
    if (methods.length === 0) continue
    lines.push(`  # ${area}`)
    for (const m of methods.slice().sort()) {
      lines.push(`  ${area}.${camelToSnake(m)}: implemented`)
    }
    lines.push('')
  }

  fs.writeFileSync(out, lines.join('\n').replace(/\n+$/, '\n'))
}

function main(): void {
  const args = parseArgs(process.argv.slice(2))

  const areaMethods = new Map<string, string[]>()
  let totalDuplicates = 0
  for (const area of AREAS) {
    const spec = readSpec(area.pkg)
    const seen = { duplicates: 0 }
    const methods = [...collectMethods(spec, area, seen)]
    areaMethods.set(area.area, methods)
    totalDuplicates += seen.duplicates
    const dupNote =
      seen.duplicates > 0
        ? ` (${seen.duplicates} duplicate${seen.duplicates === 1 ? '' : 's'} filtered)`
        : ''
    console.log(`${area.area} (${area.pkg}): ${methods.length} methods${dupNote}`)
  }

  emitYaml(areaMethods, args.out)
  console.log(
    `\nWrote ${args.out}${totalDuplicates > 0 ? ` (${totalDuplicates} duplicate method names filtered overall)` : ''}`
  )
}

main()
