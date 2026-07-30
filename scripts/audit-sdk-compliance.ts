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
 *
 * Capabilities with no method to derive from — behaviours configured through a
 * constructor or call option, and capabilities we have not implemented — are
 * declared by hand in MANUAL_ENTRIES and merged into the output. Without that
 * table a regenerate would silently drop them.
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
  // Optional group id assigned to every feature this split emits.
  group?: string
}

interface GroupConfig {
  id: string
  // Segment used in feature ids (`<area>.<namespace>.<method>`). Defaults to
  // id.replace(/-/g, '_'). Override when the slug carries an area prefix or
  // filler ("auth-mfa" → "mfa", "using-filters" → "filters").
  namespace?: string
}

interface AreaConfig {
  area: string
  pkg: string
  // A class is included if its name equals a string matcher, OR if its first
  // source file path matches a regex matcher. Both forms are useful: default-
  // exported classes (e.g. StorageFileApi) lose their name in typedoc and have
  // to be matched by file path.
  matchers: ClassMatcher[]
  // Group definitions — supplies namespace overrides used by feature-id
  // construction. Must mirror sync-canon.ts so the two scripts produce the
  // same IDs.
  groups: GroupConfig[]
  classToGroup: Record<string, string>
  byMethodPrefix?: { match: (snake: string) => boolean; group: string }[]
  signatureSplit?: SignatureSplitConfig[]
}

function defaultNamespace(groupId: string): string {
  return groupId.replace(/-/g, '_')
}

// Mirrors sync-canon.ts. Keep in sync — both scripts emit the same feature
// ids, so changing one without the other breaks cross-validation.
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
    groups: [
      { id: 'sign-in', namespace: 'sign_in' },
      { id: 'passkey' },
      { id: 'session' },
      { id: 'identities' },
      { id: 'auth-admin', namespace: 'admin' },
      { id: 'auth-mfa', namespace: 'mfa' },
      { id: 'oauth-admin' },
      { id: 'oauth-server' },
      { id: 'passkey-admin' },
    ],
    classToGroup: {
      GoTrueAdminApi: 'auth-admin',
      GoTrueAdminMFAApi: 'auth-admin',
      GoTrueAdminOAuthApi: 'oauth-admin',
      GoTrueAdminPasskeyApi: 'passkey-admin',
      GoTrueAdminCustomProvidersApi: 'auth-admin',
      GoTrueMFAApi: 'auth-mfa',
      AuthOAuthServerApi: 'oauth-server',
      WebAuthnApi: 'passkey',
    },
    byMethodPrefix: [
      { match: (s) => /_passkeys?$/.test(s) || s === 'register_passkey', group: 'passkey' },
      {
        match: (s) =>
          /^(sign_up|sign_in|verify_otp|exchange_code|resend|reauthenticate|reset_password)/.test(
            s
          ),
        group: 'sign-in',
      },
      { match: (s) => /(_identity|_identities)$/.test(s), group: 'identities' },
      { match: () => true, group: 'session' },
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
    groups: [
      { id: 'query' },
      { id: 'mutate' },
      { id: 'using-filters', namespace: 'filters' },
      { id: 'using-modifiers', namespace: 'modifiers' },
    ],
    classToGroup: {
      PostgrestClient: 'query',
      PostgrestQueryBuilder: 'mutate',
      PostgrestFilterBuilder: 'using-filters',
      PostgrestTransformBuilder: 'using-modifiers',
    },
    byMethodPrefix: [{ match: (s) => s === 'select', group: 'query' }],
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
    groups: [{ id: 'file-buckets' }, { id: 'vector-buckets' }],
    classToGroup: {
      StorageClient: 'file-buckets',
      StorageVectorsClient: 'vector-buckets',
      VectorBucketScope: 'vector-buckets',
      VectorIndexScope: 'vector-buckets',
    },
  },
  {
    area: 'realtime',
    pkg: 'realtime-js',
    matchers: ['RealtimeClient', 'RealtimeChannel'],
    groups: [{ id: 'client' }, { id: 'channel' }, { id: 'subscriptions' }],
    classToGroup: {
      RealtimeClient: 'client',
      RealtimeChannel: 'channel',
    },
    signatureSplit: [
      {
        method: 'on',
        by: 'first-param-literal',
        // Yields realtime.subscriptions.broadcast / .presence / .postgres_changes.
        // 'system' is filtered as a non-user-facing connection-event channel.
        idStem: (v) => v,
        filter: (v) => v !== 'system',
        group: 'subscriptions',
      },
    ],
  },
  {
    area: 'functions',
    pkg: 'functions-js',
    matchers: ['FunctionsClient'],
    groups: [{ id: 'invocation' }],
    classToGroup: { FunctionsClient: 'invocation' },
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

// ─── canonical-mapping loader ────────────────────────────────────────────────

// Maps auto-derived feature ids to their canonical ids in supabase/sdk.
// Read from canonical-mapping.yaml. A null value means "drop this id".
// Auto-derived ids without an entry pass through unchanged.
//
// We parse the file by hand to avoid adding a yaml dependency for one read.
type CanonicalMapping = Map<string, string | null>

function loadCanonicalMapping(): CanonicalMapping {
  const file = path.join(__dirname, 'canonical-mapping.yaml')
  const map: CanonicalMapping = new Map()
  if (!fs.existsSync(file)) return map
  const text = fs.readFileSync(file, 'utf8')
  let inMappings = false
  for (const rawLine of text.split('\n')) {
    const line = rawLine.replace(/\r$/, '')
    if (/^\s*#/.test(line) || /^\s*$/.test(line)) continue
    if (/^mappings:/.test(line)) {
      inMappings = true
      continue
    }
    if (!inMappings) continue
    // entries are 2-space indented: "  <id>: <value>"
    const m = line.match(/^\s{2}([a-z][a-z0-9_]*(?:\.[a-z0-9_]+)+):\s*(\S+)/)
    if (!m) continue
    const key = m[1]
    const value = m[2] === 'null' || m[2] === '~' ? null : m[2]
    map.set(key, value)
  }
  return map
}

interface ParamType {
  type?: string
  value?: string | number | boolean | null
}

interface CommentPart {
  kind: string
  text?: string
}

interface BlockTag {
  tag: string
  content?: CommentPart[]
}

interface SpecSignature {
  parameters?: { type?: ParamType; name?: string }[]
  comment?: { blockTags?: BlockTag[] }
}

interface SpecNode {
  name?: string
  kind?: number
  children?: SpecNode[]
  sources?: { fileName?: string }[]
  signatures?: SpecSignature[]
  inheritedFrom?: { name?: string }
}

function readBlockTag(node: SpecNode, tag: string): string | undefined {
  const tags = node.signatures?.[0]?.comment?.blockTags ?? []
  for (const t of tags) {
    if (t.tag === tag) {
      const text = (t.content ?? [])
        .map((p) => p.text ?? '')
        .join('')
        .trim()
      if (text) return text
    }
  }
  return undefined
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
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

function resolveGroup(
  methodName: string,
  snakeStem: string,
  enclosingClass: string,
  subcategory: string | undefined,
  splitGroup: string | undefined,
  area: AreaConfig
): string | undefined {
  if (splitGroup) return splitGroup
  if (subcategory) return slugify(subcategory)
  if (area.byMethodPrefix) {
    for (const rule of area.byMethodPrefix) if (rule.match(snakeStem)) return rule.group
  }
  return area.classToGroup[enclosingClass] ?? area.groups[0]?.id
}

function namespaceForGroup(groupId: string, area: AreaConfig): string {
  const g = area.groups.find((g) => g.id === groupId)
  return g?.namespace ?? defaultNamespace(groupId)
}

// Walk the spec and emit a Set of fully-namespaced feature ids of the form
// `<area>.<namespace>.<method_stem>`. Mirrors sync-canon.ts's resolution.
// The optional `mapping` argument rewrites auto-derived ids to their canonical
// equivalents (null means drop).
function collectMethods(
  spec: SpecNode,
  area: AreaConfig,
  seen: { duplicates: number; dropped: number; mapped: number },
  mapping: CanonicalMapping
): Map<string, Set<string>> {
  const splitConfigByMethod = new Map<string, SignatureSplitConfig>()
  for (const cfg of area.signatureSplit ?? []) splitConfigByMethod.set(cfg.method, cfg)

  // feature id → set of typedoc symbols that back it. The symbol string mirrors
  // supabase/sdk's normalize-typedoc (`<rawClassName>.<methodName>`), which is
  // what the drift checker resolves against. The raw class name matters:
  // storage's StorageFileApi / StorageBucketApi are default exports that typedoc
  // names `default`, so their symbols must be `default.<method>` — the prettified
  // display name would not resolve.
  const found = new Map<string, Set<string>>()

  function emit(
    stem: string,
    enclosingClass: string,
    enclosingClassRaw: string,
    methodName: string,
    sub: string | undefined,
    splitGroup: string | undefined
  ): void {
    const group = resolveGroup(methodName, stem, enclosingClass, sub, splitGroup, area)
    if (!group) return
    const namespace = namespaceForGroup(group, area)
    const autoId = `${area.area}.${namespace}.${stem}`
    const symbol = `${enclosingClassRaw}.${methodName}`

    let finalId = autoId
    if (mapping.has(autoId)) {
      const mapped = mapping.get(autoId) ?? null
      if (mapped === null) {
        seen.dropped++
        return
      }
      finalId = mapped
      if (found.has(finalId)) seen.duplicates++
      else seen.mapped++
    } else if (found.has(finalId)) {
      seen.duplicates++
    }

    let symbols = found.get(finalId)
    if (!symbols) {
      symbols = new Set<string>()
      found.set(finalId, symbols)
    }
    symbols.add(symbol)
  }

  function visit(
    node: SpecNode,
    enclosingClass: string | null,
    enclosingClassRaw: string | null
  ): void {
    if (!node || typeof node !== 'object') return
    const isClass = node.kind === 128 || node.kind === 256
    const matched = isClass && matches(node, area.matchers)
    const nextClass = matched ? classDisplayName(node) : enclosingClass
    // Raw typedoc name (may be "default" for default-exported classes) — used to
    // build the symbol, unlike nextClass which is prettified for group lookup.
    const nextClassRaw = matched ? (node.name ?? classDisplayName(node)) : enclosingClassRaw
    if (
      nextClass &&
      nextClassRaw &&
      node.kind === 2048 &&
      typeof node.name === 'string' &&
      !DENYLIST.has(node.name)
    ) {
      const inheritedFromName = node.inheritedFrom?.name?.split('.')[0]
      const isInherited = !!inheritedFromName
      if (!isInherited) {
        const split = splitConfigByMethod.get(node.name)
        const subcategory = readBlockTag(node, '@subcategory')
        if (split) {
          const literals = collectFirstParamLiterals(node)
          for (const literal of literals) {
            if (split.filter && !split.filter(literal)) continue
            const stem = split.idStem ? split.idStem(literal) : literal
            emit(stem, nextClass, nextClassRaw, node.name, subcategory, split.group)
          }
        } else {
          emit(camelToSnake(node.name), nextClass, nextClassRaw, node.name, subcategory, undefined)
        }
      }
    }
    if (Array.isArray(node.children))
      for (const c of node.children) visit(c, nextClass, nextClassRaw)
  }

  visit(spec, null, null)
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

// Manual symbol additions for capabilities that don't map 1:1 to a single
// typedoc method. Symbols here are unioned on top of the auto-derived ones in
// emitYaml. Keep this to genuine special cases only — every capability now gets
// its originating symbol automatically via collectMethods.
const SYMBOL_OVERRIDES: Record<string, string[]> = {
  'realtime.subscriptions.postgres_changes': [
    'postgresChangesFilter',
    'RealtimePostgresFilterBuilder',
    'RealtimePostgresFilterBuilder.eq',
    'RealtimePostgresFilterBuilder.neq',
    'RealtimePostgresFilterBuilder.gt',
    'RealtimePostgresFilterBuilder.gte',
    'RealtimePostgresFilterBuilder.lt',
    'RealtimePostgresFilterBuilder.lte',
    'RealtimePostgresFilterBuilder.in',
    'RealtimePostgresFilterBuilder.like',
    'RealtimePostgresFilterBuilder.ilike',
    'RealtimePostgresFilterBuilder.match',
    'RealtimePostgresFilterBuilder.imatch',
    'RealtimePostgresFilterBuilder.is',
    'RealtimePostgresFilterBuilder.isDistinct',
    'RealtimePostgresFilterBuilder.not',
    'RealtimePostgresFilterBuilder.build',
    'RealtimePostgresFilterBuilder.toString',
  ],
}

interface ManualEntry {
  status: 'implemented' | 'partially_implemented' | 'not_implemented' | 'not_applicable'
  symbols?: string[]
  // Required by the canonical validator when status is partially_implemented.
  note?: string
}

// Capabilities that cannot be derived from a typedoc method, and so have to be
// declared by hand. Two kinds end up here:
//
//   1. Behaviours configured through a constructor or call option rather than
//      their own method (`invoke` with a `region`, `copy` with a
//      `destinationBucket`). collectMethods emits one capability per method, so
//      it can never see these.
//   2. Capabilities with no implementation at all, recorded so the gap is
//      declared rather than silently defaulted.
//
// Symbols are the option's *type*, paired with the method that consumes it. The
// canonical symbol normalizer skips constructors outright, so `X.constructor`
// never resolves and would trip the drift check — type names do resolve, including
// type aliases. Verify any addition against packages/core/*/docs/v2/spec.json.
const MANUAL_ENTRIES: Record<string, ManualEntry> = {
  // client — cross-cutting SupabaseClient construction options. This whole area
  // is option-shaped, which is why there is no `client` entry in AREAS.
  'client.authentication_integration.cross_client_token_sync': {
    status: 'implemented',
    symbols: ['SupabaseClientOptions', 'RealtimeClient.setAuth', 'GoTrueClient.onAuthStateChange'],
  },
  'client.authentication_integration.oauth_flow_type': {
    status: 'implemented',
    symbols: ['AuthFlowType', 'GoTrueClientOptions'],
  },
  'client.authentication_integration.session_url_detection': {
    status: 'implemented',
    symbols: ['GoTrueClientOptions', 'GoTrueClient.exchangeCodeForSession'],
  },
  'client.authentication_integration.third_party_auth': {
    status: 'implemented',
    symbols: ['SupabaseClientOptions'],
  },
  'client.observability.trace_propagation': {
    status: 'implemented',
    symbols: ['TracePropagationOptions'],
  },
  'client.request_configuration.custom_http_client': {
    status: 'implemented',
    symbols: ['SupabaseClientOptions'],
  },
  'client.request_configuration.global_headers': {
    status: 'implemented',
    symbols: ['SupabaseClientOptions'],
  },
  'client.session_management.custom_storage': {
    status: 'implemented',
    symbols: ['GoTrueClientOptions', 'SupportedStorage'],
  },
  'client.session_management.persist_session': {
    status: 'implemented',
    symbols: ['GoTrueClientOptions'],
  },

  // auth — signOut() takes only a scope, and AuthChangeEvent has a single flat
  // SIGNED_OUT that carries no cause, so listeners cannot tell a voluntary
  // sign-out from an involuntary one.
  'auth.session.sign_out_reason': { status: 'not_implemented' },

  // database
  'database.configuration.auto_retry': {
    status: 'implemented',
    symbols: ['PostgrestBuilder.retry', 'PostgrestClientOptions'],
  },
  'database.configuration.request_timeout': {
    status: 'implemented',
    symbols: ['PostgrestClientOptions'],
  },
  'database.mutate.select_after_mutation': {
    status: 'implemented',
    symbols: ['PostgrestTransformBuilder.select'],
  },
  'database.using_modifiers.relationship_embed': {
    status: 'implemented',
    symbols: ['PostgrestQueryBuilder.select', 'PostgrestTransformBuilder.select'],
  },
  'database.using_modifiers.request_cancellation': {
    status: 'implemented',
    symbols: ['PostgrestTransformBuilder.abortSignal'],
  },
  'database.using_modifiers.strip_nulls': {
    status: 'implemented',
    symbols: ['PostgrestBuilder.stripNulls'],
  },

  // storage — StorageAnalyticsClient, StorageBucketApi and StorageFileApi are all
  // default-exported, so they collapse into one `default.*` symbol namespace and
  // `default.createBucket` cannot distinguish a file bucket from an analytics one.
  // The symbols still resolve; disambiguating them belongs in the canonical
  // normalizer, not here.
  'storage.analytics.create_analytics_bucket': {
    status: 'implemented',
    symbols: ['default.createBucket'],
  },
  'storage.analytics.delete_analytics_bucket': {
    status: 'implemented',
    symbols: ['default.deleteBucket'],
  },
  // Namespace and table CRUD comes from the iceberg-js package; storage-js supplies
  // the bucket-name validation, URL and auth wiring, and { data, error } conversion.
  'storage.analytics.iceberg_namespace': { status: 'implemented', symbols: ['default.from'] },
  'storage.analytics.iceberg_table': { status: 'implemented', symbols: ['default.from'] },
  'storage.analytics.list_analytics_buckets': {
    status: 'implemented',
    symbols: ['default.listBuckets'],
  },
  'storage.file_buckets.copy_cross_bucket': {
    status: 'implemented',
    symbols: ['default.copy', 'DestinationOptions'],
  },
  'storage.file_buckets.download_as_stream': {
    status: 'implemented',
    symbols: ['default.asStream'],
  },
  'storage.file_buckets.download_with_transform': {
    status: 'implemented',
    symbols: ['default.download', 'TransformOptions'],
  },
  'storage.file_buckets.move_cross_bucket': {
    status: 'implemented',
    symbols: ['default.move', 'DestinationOptions'],
  },
  'storage.file_buckets.upload_with_metadata': {
    status: 'implemented',
    symbols: ['default.upload', 'FileOptions.metadata'],
  },
  'storage.file_buckets.url_cache_nonce': {
    status: 'implemented',
    symbols: ['default.createSignedUrl', 'default.createSignedUrls', 'default.getPublicUrl'],
  },
  'storage.vector_buckets.create_vector_bucket': {
    status: 'implemented',
    symbols: ['StorageVectorsClient.createBucket'],
  },
  'storage.vector_buckets.delete_vector_bucket': {
    status: 'implemented',
    symbols: ['StorageVectorsClient.deleteBucket'],
  },
  'storage.vector_buckets.list_vector_buckets': {
    status: 'implemented',
    symbols: ['StorageVectorsClient.listBuckets', 'ListVectorBucketsOptions'],
  },
  // Segmented scanning is a parameter mode of listVectors, not its own method.
  'storage.vector_buckets.parallel_scan': {
    status: 'implemented',
    symbols: ['VectorIndexScope.listVectors', 'ListVectorsOptions'],
  },

  // realtime
  'realtime.configuration.access_token_callback': {
    status: 'implemented',
    symbols: ['RealtimeClientOptions', 'RealtimeClient.setAuth'],
  },
  'realtime.configuration.binary_protocol': {
    status: 'implemented',
    symbols: ['RealtimeClientOptions'],
  },
  'realtime.configuration.custom_logger': {
    status: 'implemented',
    symbols: ['RealtimeClientOptions'],
  },
  'realtime.configuration.custom_websocket_transport': {
    status: 'implemented',
    symbols: ['RealtimeClientOptions'],
  },
  'realtime.configuration.deferred_disconnect': {
    status: 'implemented',
    symbols: ['RealtimeClientOptions'],
  },
  'realtime.configuration.heartbeat_interval': {
    status: 'implemented',
    symbols: ['RealtimeClientOptions'],
  },
  'realtime.configuration.reconnect_backoff': {
    status: 'implemented',
    symbols: ['RealtimeClientOptions'],
  },
  'realtime.presence.presence_key': {
    status: 'implemented',
    symbols: ['RealtimeChannelOptions', 'RealtimeChannel.track'],
  },
  'realtime.subscriptions.broadcast_ack': {
    status: 'implemented',
    symbols: ['RealtimeChannelOptions', 'RealtimeChannel.send'],
  },
  'realtime.subscriptions.broadcast_replay': {
    status: 'implemented',
    symbols: ['RealtimeChannelOptions', 'RealtimeChannel.on'],
  },
  'realtime.subscriptions.broadcast_self': {
    status: 'implemented',
    symbols: ['RealtimeChannelOptions', 'RealtimeChannel.subscribe'],
  },
  'realtime.subscriptions.postgres_changes_filter': {
    status: 'implemented',
    symbols: ['RealtimePostgresFilterBuilder', 'RealtimeChannel.on'],
  },
  'realtime.subscriptions.private_channel': {
    status: 'implemented',
    symbols: ['RealtimeChannelOptions', 'RealtimeChannel.subscribe'],
  },

  // functions — every one of these is an option on invoke().
  'functions.invocation.method_override': {
    status: 'implemented',
    symbols: ['FunctionsClient.invoke', 'FunctionInvokeOptions'],
  },
  'functions.invocation.region_selection': {
    status: 'implemented',
    symbols: ['FunctionsClient.invoke', 'FunctionInvokeOptions', 'FunctionRegion'],
  },
  'functions.invocation.request_cancellation': {
    status: 'implemented',
    symbols: ['FunctionsClient.invoke', 'FunctionInvokeOptions'],
  },
  'functions.invocation.streaming_response': {
    status: 'implemented',
    symbols: ['FunctionsClient.invoke', 'FunctionInvokeOptions'],
  },
  'functions.invocation.timeout': {
    status: 'implemented',
    symbols: ['FunctionsClient.invoke', 'FunctionInvokeOptions'],
  },
}

// Areas whose capabilities are all manual, so they have no AREAS entry to derive
// from but still need a section in the emitted file.
const MANUAL_ONLY_AREAS = ['client']

// Section order: manual-only areas first, then every area we derive methods from.
const SECTION_ORDER = [...MANUAL_ONLY_AREAS, ...AREAS.map((a) => a.area)]

function emitYaml(areaIds: Map<string, { id: string; symbols: string[] }[]>, out: string): void {
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

  for (const area of SECTION_ORDER) {
    const auto = areaIds.get(area) ?? []
    const autoIds = new Set(auto.map((e) => e.id))
    const manual = Object.entries(MANUAL_ENTRIES).filter(([id]) => id.startsWith(`${area}.`))

    // A capability that became method-backed no longer needs its manual entry —
    // leaving both in place would emit it twice.
    for (const [id] of manual) {
      if (autoIds.has(id)) {
        throw new Error(
          `${id} is both auto-derived and listed in MANUAL_ENTRIES — drop the manual entry.`
        )
      }
    }

    const entries = [
      ...auto.map(({ id, symbols: autoSymbols }) => ({
        id,
        // Auto-derived symbols, unioned with any manual override for ids that
        // don't map 1:1 (e.g. realtime.subscriptions.postgres_changes). Set
        // iteration preserves insertion order, so overrides append after auto.
        entry: {
          status: 'implemented' as const,
          symbols: [...new Set([...autoSymbols, ...(SYMBOL_OVERRIDES[id] ?? [])])],
        } as ManualEntry,
      })),
      ...manual.map(([id, entry]) => ({ id, entry })),
    ]
    if (entries.length === 0) continue

    lines.push(`  # ${area}`)
    const sorted = entries.slice().sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    for (const { id, entry } of sorted) {
      lines.push(`  ${id}:`)
      lines.push(`    status: ${entry.status}`)
      if (entry.note) lines.push(`    note: ${JSON.stringify(entry.note)}`)
      if (entry.symbols?.length) {
        lines.push(`    symbols:`)
        for (const sym of entry.symbols) lines.push(`      - ${sym}`)
      }
    }
    lines.push('')
  }

  fs.writeFileSync(out, lines.join('\n').replace(/\n+$/, '\n'))
}

function main(): void {
  const args = parseArgs(process.argv.slice(2))

  const mapping = loadCanonicalMapping()
  console.log(`Loaded ${mapping.size} canonical mapping entr${mapping.size === 1 ? 'y' : 'ies'}.`)

  const areaMethods = new Map<string, { id: string; symbols: string[] }[]>()
  let totalDuplicates = 0
  let totalMapped = 0
  let totalDropped = 0
  for (const area of AREAS) {
    const spec = readSpec(area.pkg)
    const seen = { duplicates: 0, dropped: 0, mapped: 0 }
    const methods = [...collectMethods(spec, area, seen, mapping)].map(([id, symbols]) => ({
      id,
      symbols: [...symbols],
    }))
    areaMethods.set(area.area, methods)
    totalDuplicates += seen.duplicates
    totalMapped += seen.mapped
    totalDropped += seen.dropped
    const notes: string[] = []
    if (seen.duplicates) notes.push(`${seen.duplicates} dup${seen.duplicates === 1 ? '' : 's'}`)
    if (seen.mapped) notes.push(`${seen.mapped} mapped`)
    if (seen.dropped) notes.push(`${seen.dropped} dropped`)
    const suffix = notes.length ? ` (${notes.join(', ')})` : ''
    console.log(`${area.area} (${area.pkg}): ${methods.length} methods${suffix}`)
  }

  emitYaml(areaMethods, args.out)
  console.log(
    `\nWrote ${args.out} — total: ${totalMapped} mapped, ${totalDropped} dropped, ${totalDuplicates} duplicates filtered`
  )
}

main()
