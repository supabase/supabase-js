#!/usr/bin/env node

/**
 * Sync supabase-js's public API surface into the canonical capability matrix
 * (capabilities/<area>.yaml in the supabase/sdk repo).
 *
 * supabase-js is the source of truth: this script walks each package's typedoc
 * spec.json and writes feature entries into the canon yaml files.
 *
 * Two modes:
 *
 *   default (additive)
 *     For each ID we extract, check the matching canon yaml. If the ID is
 *     missing, append a new feature entry. Existing entries are left untouched
 *     so registry maintainers and other SDKs can edit names/descriptions/groups
 *     without us clobbering them on the next sync.
 *
 *   --bootstrap
 *     Replace each capability file wholesale from scratch. Use exactly once
 *     when seeding the registry from supabase-js. After that, default mode.
 *
 * Usage:
 *   pnpm tsx scripts/sync-canon.ts [--canon-path <path>] [--bootstrap] [--dry-run]
 *
 * Canon path resolution (first match wins):
 *   1. --canon-path <path>                    flag
 *   2. SUPABASE_SDK_CAPABILITIES_PATH         env var
 *   3. ../sdk/capabilities                    fallback (assumes supabase/sdk
 *                                             is cloned as a sibling of this
 *                                             repo)
 */

import * as fs from 'fs'
import * as path from 'path'

// ─── area config (mirrors audit-sdk-compliance.ts) ────────────────────────────

type ClassMatcher = string | RegExp

// Splits a single overloaded method into multiple feature entries based on a
// per-signature discriminator. Currently the only discriminator is the literal
// value of the first parameter's type — used to turn realtime's on() (16
// overloads keyed on 'broadcast' | 'presence' | 'postgres_changes' | 'system')
// into one feature per event type.
interface SignatureSplitConfig {
  method: string
  by: 'first-param-literal'
  // Optional id-stem override; default uses the literal value as the snake-cased id stem.
  idStem?: (literalValue: string) => string
  // Optional display-name override; default snake_to_title from the id stem.
  nameFromValue?: (literalValue: string) => string
  // Optional filter — return false to drop a literal value from the split.
  filter?: (literalValue: string) => boolean
  // Optional group id for all features produced by this split.
  group?: string
}

interface GroupConfig {
  id: string
  title: string
  // Segment used in feature ids (`<area>.<namespace>.<method>`). If omitted,
  // defaults to id.replace(/-/g, '_'). Override when the id contains an area
  // prefix or filler ("auth-mfa" → "mfa", "using-filters" → "filters").
  namespace?: string
}

interface AreaConfig {
  area: string
  pkg: string
  title: string
  description: string
  // Predefined groups with curated titles. Group ids derived from @subcategory
  // tags that aren't present here will be auto-appended with a title derived
  // from the slug.
  groups: GroupConfig[]
  matchers: ClassMatcher[]
  // Map enclosing class → group id. Used when @subcategory is absent.
  classToGroup: Record<string, string>
  // Method-name-stem heuristic. Only consulted when both @subcategory and
  // classToGroup miss.
  byMethodPrefix?: { match: (snake: string) => boolean; group: string }[]
  signatureSplit?: SignatureSplitConfig[]
}

// Default namespace for a group id when GroupConfig.namespace is unspecified.
function defaultNamespace(groupId: string): string {
  return groupId.replace(/-/g, '_')
}

const AREAS: AreaConfig[] = [
  {
    area: 'auth',
    pkg: 'auth-js',
    title: 'Authentication',
    description:
      'User sign-in flows, session management, MFA, passkeys, identity linking, and admin operations.',
    // Group titles. Slugs that come out of @subcategory tags (e.g. "Auth Admin"
    // → auth-admin) appear here with curated titles; any subcategory slug
    // encountered at runtime that isn't listed below gets auto-appended.
    groups: [
      { id: 'sign-in', title: 'Sign-in / Sign-up', namespace: 'sign_in' },
      { id: 'passkey', title: 'Passkeys' },
      { id: 'session', title: 'Session & User' },
      { id: 'identities', title: 'Identity Linking' },
      // The "auth-" prefix on these slugs is redundant once IDs are namespaced
      // (the area segment already says "auth"); strip it.
      { id: 'auth-admin', title: 'Auth Admin', namespace: 'admin' },
      { id: 'auth-mfa', title: 'Auth MFA', namespace: 'mfa' },
      { id: 'oauth-admin', title: 'OAuth Admin' },
      { id: 'oauth-server', title: 'OAuth Server' },
      { id: 'passkey-admin', title: 'Passkey Admin' },
    ],
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
    // Fallbacks for methods without @subcategory. The admin classes all carry
    // @subcategory "Auth Admin", so these never fire in practice — left here
    // so future refactors don't silently drop methods.
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
    // Consulted only when @subcategory and classToGroup both miss. GoTrueClient
    // methods have no @subcategory; this routes them by method-name shape.
    byMethodPrefix: [
      { match: (s) => /_passkeys?$/.test(s) || s === 'register_passkey', group: 'passkey' },
      {
        match: (s) =>
          /^(sign_up|sign_in|verify_otp|exchange_code|resend|reauthenticate|reset_password)/.test(
            s
          ),
        group: 'sign-in',
      },
      {
        match: (s) => /(_identity|_identities)$/.test(s),
        group: 'identities',
      },
      // Catch-all for GoTrueClient session/user methods. Safe alongside
      // classToGroup because resolveGroup checks @subcategory first.
      { match: () => true, group: 'session' },
    ],
  },
  {
    area: 'database',
    pkg: 'postgrest-js',
    title: 'Database (PostgREST)',
    description:
      'Query builder over PostgREST — select, insert, update, delete, RPC, filters, and transforms.',
    groups: [
      { id: 'query', title: 'Query' },
      { id: 'mutate', title: 'Mutate' },
      { id: 'using-filters', title: 'Filters', namespace: 'filters' },
      { id: 'using-modifiers', title: 'Modifiers', namespace: 'modifiers' },
    ],
    matchers: [
      'PostgrestClient',
      'PostgrestQueryBuilder',
      'PostgrestFilterBuilder',
      'PostgrestTransformBuilder',
    ],
    // PostgrestFilterBuilder methods that lack @subcategory ("Using filters")
    // fall through here. Same shape for TransformBuilder. select() on the
    // QueryBuilder is force-routed to 'query' via byMethodPrefix below.
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
    title: 'Storage',
    description: 'Object storage — upload, download, list, and manage files in buckets.',
    groups: [
      { id: 'file-buckets', title: 'File Buckets' },
      { id: 'vector-buckets', title: 'Vector Buckets' },
    ],
    matchers: [
      'StorageClient',
      'StorageVectorsClient',
      'VectorBucketScope',
      'VectorIndexScope',
      /StorageFileApi\.ts$/,
      /StorageBucketApi\.ts$/,
    ],
    // Most storage methods carry @subcategory ("File Buckets" / "Vector
    // Buckets"). classToGroup below is the fallback for any method that lacks
    // a @subcategory tag.
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
    title: 'Realtime',
    description:
      'Websocket client and channel subscriptions: Postgres changes, broadcast, and presence.',
    groups: [
      { id: 'client', title: 'Client' },
      { id: 'channel', title: 'Channel' },
      { id: 'subscriptions', title: 'Subscriptions' },
    ],
    matchers: ['RealtimeClient', 'RealtimeChannel'],
    classToGroup: {
      RealtimeClient: 'client',
      RealtimeChannel: 'channel',
    },
    signatureSplit: [
      {
        method: 'on',
        by: 'first-param-literal',
        // RealtimeChannel.on() has 16 overloads keyed on a literal event-type
        // string ('postgres_changes' | 'broadcast' | 'presence' | 'system').
        // Split into one feature per event type.
        idStem: (v) => v,
        nameFromValue: (v) =>
          v === 'postgres_changes' ? 'Postgres Changes' : v.charAt(0).toUpperCase() + v.slice(1),
        // Filter out 'system' — connection-state events surfaced through the
        // same on() API but not a user-facing capability.
        filter: (v) => v !== 'system',
        group: 'subscriptions',
      },
    ],
  },
  {
    area: 'functions',
    pkg: 'functions-js',
    title: 'Edge Functions',
    description: 'Invoke Supabase Edge Functions from the client.',
    groups: [{ id: 'invocation', title: 'Invocation' }],
    matchers: ['FunctionsClient'],
    classToGroup: { FunctionsClient: 'invocation' },
  },
]

// Method names never collected as canonical features. Two reasons live here:
//   - boilerplate plumbing (then/catch/finally/toJSON/dispose/log/...)
//   - public-but-not-a-capability internals (copyBindings, sendHeartbeat,
//     teardown, updateJoinPayload, initialize, toBase64) — flagged by review.
//
// Inherited methods from un-matched base classes (PostgrestBuilder's
// setHeader / abortSignal / throwOnError / overrideTypes / returns / retry)
// are dropped automatically by collectMethods via the `inheritedFrom` check,
// so they don't need entries here.
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
  // Builder with @subcategory tags, so the inheritance check doesn't catch
  // them — explicit denylist instead.
  'abortSignal',
  'throwOnError',
  'overrideTypes',
  'returns',
  'retry',
  'setHeader',
])

const REPO_ROOT = path.resolve(__dirname, '..')

// Default canon location: a sibling checkout of github.com/supabase/sdk.
// Override with --canon-path or SUPABASE_SDK_CAPABILITIES_PATH.
const DEFAULT_CANON_PATH = path.resolve(REPO_ROOT, '..', 'sdk', 'capabilities')

// ─── spec.json walking ────────────────────────────────────────────────────────

interface CommentPart {
  kind: string
  text?: string
  tag?: string
}

interface BlockTag {
  tag: string
  content?: CommentPart[]
}

interface ParamType {
  type?: string
  value?: string | number | boolean | null
  name?: string
}

interface SpecSignature {
  comment?: { summary?: CommentPart[]; blockTags?: BlockTag[] }
  parameters?: { type?: ParamType; name?: string }[]
}

interface SpecNode {
  name?: string
  kind?: number
  children?: SpecNode[]
  sources?: { fileName?: string }[]
  signatures?: SpecSignature[]
  inheritedFrom?: { name?: string; target?: number }
}

interface MethodMeta {
  // The eventual id-stem (snake_cased). For signature-split methods this is
  // the literal value (e.g. "postgres_changes"); for normal methods it's the
  // snake_cased typedoc method name.
  idStem: string
  // Display name override; if absent, derived from idStem.
  nameOverride?: string
  // The typedoc-reported method name (camelCase) — kept for fallback grouping
  // via byMethodPrefix and for warnings.
  methodName: string
  className: string
  description: string
  // Optional @subcategory from JSDoc blockTags — slugified by callers.
  subcategory?: string
  // Explicit group override (used by signature-split entries).
  group?: string
}

function readSpec(pkg: string): SpecNode {
  const spec = path.join(REPO_ROOT, 'packages', 'core', pkg, 'docs', 'v2', 'spec.json')
  if (!fs.existsSync(spec)) {
    throw new Error(
      `Missing typedoc spec: ${spec}\n` +
        `Run \`pnpm --filter @supabase/${pkg} run docs:json\` first.`
    )
  }
  return JSON.parse(fs.readFileSync(spec, 'utf8')) as SpecNode
}

function classMatches(node: SpecNode, ms: ClassMatcher[]): boolean {
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
  // For default-exported classes ("default" in typedoc), use the source filename stem.
  if (node.name && node.name !== 'default') return node.name
  const file = node.sources?.[0]?.fileName ?? ''
  const base = path.basename(file).replace(/\.(ts|tsx|js)$/, '')
  return base || 'default'
}

// Render a JSDoc comment summary back into prose. Handles three part kinds
// emitted by typedoc:
//   - text:         literal prose
//   - code:         a `backticked` chunk; keep the inner text including the
//                   backticks (they survive into yaml as plain markdown).
//   - inline-tag:   {@link Foo} / {@link #method} — render as the link target
//                   text with a leading '#' stripped.
function renderCommentParts(parts: CommentPart[] | undefined): string {
  if (!parts || parts.length === 0) return ''
  const buf: string[] = []
  for (const p of parts) {
    if (!p.text) continue
    if (p.kind === 'text') buf.push(p.text)
    else if (p.kind === 'code') buf.push(p.text)
    else if (p.kind === 'inline-tag') buf.push(p.text.replace(/^#/, ''))
    else buf.push(p.text) // unknown kind — best-effort keep the text
  }
  return buf.join('').trim()
}

function firstParagraph(text: string): string {
  return text
    .split(/\n\s*\n/)[0]
    .replace(/\s+/g, ' ')
    .trim()
}

function extractDescriptionFromSignature(sig: SpecSignature | undefined): string {
  if (!sig?.comment?.summary) return ''
  return firstParagraph(renderCommentParts(sig.comment.summary))
}

function extractDescription(node: SpecNode): string {
  return extractDescriptionFromSignature(node.signatures?.[0])
}

function extractSubcategoryFromSignature(sig: SpecSignature | undefined): string | undefined {
  const tags = sig?.comment?.blockTags ?? []
  for (const t of tags) {
    if (t.tag === '@subcategory') {
      const text = renderCommentParts(t.content).trim()
      if (text) return text
    }
  }
  return undefined
}

function extractSubcategory(node: SpecNode): string | undefined {
  return extractSubcategoryFromSignature(node.signatures?.[0])
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

// Gather every class display name in the spec that matches one of the area
// matchers — used to decide whether an inherited method should be skipped (the
// declaring class will surface it on its own) or kept (the declaring class is
// out of scope, so this is the only chance to collect it).
function collectMatchedClassNames(spec: SpecNode, ms: ClassMatcher[]): Set<string> {
  const names = new Set<string>()
  function visit(node: SpecNode): void {
    if (!node || typeof node !== 'object') return
    if ((node.kind === 128 || node.kind === 256) && classMatches(node, ms)) {
      names.add(classDisplayName(node))
    }
    if (Array.isArray(node.children)) for (const c of node.children) visit(c)
  }
  visit(spec)
  return names
}

// Walk every method overload's first parameter and dedupe literal-string values.
// Used by signature-split to enumerate event types in realtime.on().
function collectFirstParamLiterals(node: SpecNode): string[] {
  const seen = new Set<string>()
  const order: string[] = []
  for (const sig of node.signatures ?? []) {
    const p = sig.parameters?.[0]
    const t = p?.type
    if (t?.type === 'literal' && typeof t.value === 'string') {
      if (!seen.has(t.value)) {
        seen.add(t.value)
        order.push(t.value)
      }
    }
  }
  return order
}

function findSignatureForLiteral(node: SpecNode, value: string): SpecSignature | undefined {
  for (const sig of node.signatures ?? []) {
    const p = sig.parameters?.[0]
    const t = p?.type
    if (t?.type === 'literal' && t.value === value) return sig
  }
  return undefined
}

// Returns a list of MethodMetas — one per emitted feature. Signature-split
// methods produce multiple entries; normal methods produce one. Cross-class
// duplicates (e.g. signOut on GoTrueClient and GoTrueAdminApi) collapse in the
// caller's id-keyed dedupe.
function collectMethods(spec: SpecNode, area: AreaConfig): MethodMeta[] {
  const matchedClassNames = collectMatchedClassNames(spec, area.matchers)
  const splitConfigByMethod = new Map<string, SignatureSplitConfig>()
  for (const cfg of area.signatureSplit ?? []) splitConfigByMethod.set(cfg.method, cfg)

  const out: MethodMeta[] = []

  function visit(node: SpecNode, enclosingClass: string | null): void {
    if (!node || typeof node !== 'object') return
    const isClass = node.kind === 128 || node.kind === 256
    const nextClass =
      isClass && classMatches(node, area.matchers) ? classDisplayName(node) : enclosingClass

    if (
      nextClass &&
      node.kind === 2048 &&
      typeof node.name === 'string' &&
      !DENYLIST.has(node.name)
    ) {
      const inheritedFromName = node.inheritedFrom?.name?.split('.')[0]
      const isInherited = !!inheritedFromName
      // Skip inherited methods unless they're inherited from another matched
      // class — in which case the declaring class will surface them on its own.
      // Methods inherited from un-matched bases (e.g. PostgrestBuilder) get
      // dropped entirely. Methods declared directly on this class always pass.
      const skipForInheritance = isInherited && !matchedClassNames.has(inheritedFromName)
      const skipBecauseDeclaringClassWillEmit =
        isInherited && matchedClassNames.has(inheritedFromName)
      if (!skipForInheritance && !skipBecauseDeclaringClassWillEmit) {
        const split = splitConfigByMethod.get(node.name)
        if (split) {
          const literals = collectFirstParamLiterals(node)
          for (const literal of literals) {
            if (split.filter && !split.filter(literal)) continue
            const sig = findSignatureForLiteral(node, literal)
            const description = extractDescriptionFromSignature(sig) || extractDescription(node)
            const subcategory = extractSubcategoryFromSignature(sig) || extractSubcategory(node)
            out.push({
              idStem: split.idStem ? split.idStem(literal) : literal,
              nameOverride: split.nameFromValue ? split.nameFromValue(literal) : undefined,
              methodName: node.name,
              className: nextClass,
              description,
              subcategory,
              group: split.group,
            })
          }
        } else {
          out.push({
            idStem: camelToSnake(node.name),
            methodName: node.name,
            className: nextClass,
            description: extractDescription(node),
            subcategory: extractSubcategory(node),
          })
        }
      }
    }
    if (Array.isArray(node.children)) for (const c of node.children) visit(c, nextClass)
  }

  visit(spec, null)
  return out
}

// ─── name / id transforms ─────────────────────────────────────────────────────

// Known acronyms that should NOT be split mid-run by camelToSnake.
// Without this pre-pass, signInWithOAuth becomes sign_in_with_o_auth because
// the second regex splits OAuth → O_Auth. Pre-normalize OAuth → Oauth (and
// similar) so only the first regex fires, yielding sign_in_with_oauth.
const ACRONYMS = ['OAuth', 'URL', 'SSO', 'JWT', 'JWKS', 'API', 'PKCE', 'OIDC', 'MFA', 'AAL']

function preNormalizeAcronyms(name: string): string {
  let s = name
  for (const a of ACRONYMS) {
    s = s.replace(new RegExp(a, 'g'), a[0] + a.slice(1).toLowerCase())
  }
  return s
}

function camelToSnake(name: string): string {
  return preNormalizeAcronyms(name)
    .replace(/([a-z\d])([A-Z])/g, '$1_$2')
    .replace(/([A-Z])([A-Z][a-z])/g, '$1_$2')
    .toLowerCase()
}

function snakeToTitle(snake: string): string {
  return snake
    .split('_')
    .map((w) => (w.length === 0 ? '' : w[0].toUpperCase() + w.slice(1)))
    .join(' ')
}

// Precedence:
//   1. meta.group        — explicit override (set by signature-split entries)
//   2. @subcategory      — JSDoc-declared subcategory, slugified
//   3. byMethodPrefix    — method-name overrides that beat classToGroup
//                          (e.g. database.select → 'query', auth sign-in flows)
//   4. classToGroup      — enclosing-class default
//   5. byMethodPrefix    — method-name fallback when class is unmatched
//   6. area.groups[0]    — first declared group, as last-resort fallback
//
// Step 3 only fires for prefix rules that the caller marks as "overrides" via
// their match function returning true for a specific stem — generic catch-alls
// (() => true) belong in step 5 territory, but we no longer ship those: when
// classToGroup misses and no prefix rule fires, we fall to step 6 instead.
function resolveGroup(meta: MethodMeta, snakeStem: string, area: AreaConfig): string | undefined {
  if (meta.group) return meta.group
  if (meta.subcategory) return slugify(meta.subcategory)
  if (area.byMethodPrefix) {
    for (const rule of area.byMethodPrefix) {
      if (rule.match(snakeStem)) return rule.group
    }
  }
  const cls = area.classToGroup[meta.className]
  if (cls) return cls
  return area.groups[0]?.id
}

// Group id → namespace segment used in the feature id. Predefined groups
// supply explicit `namespace` overrides; everything else falls back to the
// slug with hyphens swapped for underscores.
function namespaceForGroup(groupId: string, area: AreaConfig): string {
  const g = area.groups.find((g) => g.id === groupId)
  return g?.namespace ?? defaultNamespace(groupId)
}

interface FeatureEntry {
  id: string
  name: string
  description: string
  group?: string
  // Used by emitFullFile to surface groups from @subcategory tags whose slug
  // isn't in area.groups. The string is the human-readable original (e.g.
  // "Vector Buckets"), which we use as the auto-derived title.
  groupTitleHint?: string
}

interface MissingDescription {
  id: string
  className: string
  methodName: string
}

interface BuildResult {
  features: FeatureEntry[]
  missingDescriptions: MissingDescription[]
  groupTitles: Map<string, string>
}

function buildFeatures(spec: SpecNode, area: AreaConfig): BuildResult {
  const metas = collectMethods(spec, area)
  const features: FeatureEntry[] = []
  const seenIds = new Set<string>()
  const missingDescriptions: MissingDescription[] = []
  const groupTitles = new Map<string, string>()
  for (const g of area.groups) groupTitles.set(g.id, g.title)

  for (const meta of metas) {
    const stem = meta.idStem
    const group = resolveGroup(meta, stem, area) ?? area.groups[0]?.id
    if (!group) continue // shouldn't happen — every area has at least one predefined group
    const namespace = namespaceForGroup(group, area)
    const id = `${area.area}.${namespace}.${stem}`
    if (seenIds.has(id)) continue
    seenIds.add(id)

    const name = meta.nameOverride ?? snakeToTitle(stem)
    let description = meta.description
    if (!description) {
      missingDescriptions.push({ id, className: meta.className, methodName: meta.methodName })
      // Schema requires non-empty description. Use the display name so future
      // edits replace a real string, not a placeholder warning.
      description = name
    }
    if (group && !groupTitles.has(group) && meta.subcategory) {
      groupTitles.set(group, meta.subcategory)
    }
    features.push({ id, name, description, group })
  }

  features.sort((a, b) => a.id.localeCompare(b.id))
  return { features, missingDescriptions, groupTitles }
}

// ─── yaml emit / parse ────────────────────────────────────────────────────────

// Plain (unquoted) scalar if YAML accepts it; double-quoted with escaping otherwise.
// Matches the existing canon style — no diff churn over cosmetic quoting.
//
// Quotes when:
//   - the string is empty, or has leading/trailing whitespace
//   - it would be parsed as a non-string (true/false/null/yes/no/~, numbers)
//   - it starts with a YAML indicator (- ? : , [ ] { } # & * ! | > ' " % @ `)
//   - it contains ": " or " #" (would terminate the scalar mid-string)
//   - it contains any newline or control character
function needsQuoting(s: string): boolean {
  if (s === '') return true
  if (/^\s|\s$/.test(s)) return true
  if (/^(true|false|null|yes|no|on|off|~)$/i.test(s)) return true
  if (/^-?\d+(\.\d+)?$/.test(s)) return true
  if (/^[-?:,[\]{}#&*!|>'"%@`]/.test(s)) return true
  if (/: /.test(s) || / #/.test(s)) return true
  if (/[\n\r\t\v\f\0]/.test(s)) return true
  return false
}

function formatScalar(s: string): string {
  if (!needsQuoting(s)) return s
  return '"' + s.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"'
}

function emitFeatureBlock(f: FeatureEntry): string {
  const lines = [
    `  - id: ${f.id}`,
    `    name: ${formatScalar(f.name)}`,
    `    description: ${formatScalar(f.description)}`,
  ]
  if (f.group) lines.push(`    group: ${f.group}`)
  return lines.join('\n')
}

function emitFullFile(area: AreaConfig, result: BuildResult): string {
  const lines: string[] = [
    '# yaml-language-server: $schema=../schema/capability-matrix.schema.json',
    `area: ${area.area}`,
    `title: ${formatScalar(area.title)}`,
    `description: ${formatScalar(area.description)}`,
    'groups:',
  ]

  // Ordered list: predefined first (in their declared order), then any auto-
  // discovered groups (from @subcategory tags) alphabetically.
  const predefinedIds = new Set(area.groups.map((g) => g.id))
  const usedGroupIds = new Set<string>()
  for (const f of result.features) if (f.group) usedGroupIds.add(f.group)

  for (const g of area.groups) {
    if (usedGroupIds.has(g.id)) {
      lines.push(`  - id: ${g.id}`, `    title: ${formatScalar(g.title)}`)
    }
  }
  const extras = [...usedGroupIds].filter((id) => !predefinedIds.has(id)).sort()
  for (const id of extras) {
    const title = result.groupTitles.get(id) ?? snakeToTitle(id.replace(/-/g, '_'))
    lines.push(`  - id: ${id}`, `    title: ${formatScalar(title)}`)
  }

  lines.push('features:')
  for (const f of result.features) lines.push(emitFeatureBlock(f))
  return lines.join('\n') + '\n'
}

function readExistingIds(file: string): Set<string> {
  if (!fs.existsSync(file)) return new Set()
  const text = fs.readFileSync(file, 'utf8')
  const ids = new Set<string>()
  for (const line of text.split('\n')) {
    const m = line.match(/^\s*-\s*id:\s*([\w.]+)\s*$/)
    if (m) ids.add(m[1])
  }
  return ids
}

function appendFeatures(file: string, news: FeatureEntry[]): string {
  const existing = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : ''
  const trimmed = existing.replace(/\n+$/, '')
  const blocks = news.map(emitFeatureBlock).join('\n')
  return trimmed + (trimmed.endsWith('features:') ? '\n' : '\n') + blocks + '\n'
}

// ─── cli ──────────────────────────────────────────────────────────────────────

interface CliArgs {
  canonPath: string
  bootstrap: boolean
  dryRun: boolean
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {
    canonPath: process.env.SUPABASE_SDK_CAPABILITIES_PATH
      ? path.resolve(process.env.SUPABASE_SDK_CAPABILITIES_PATH)
      : DEFAULT_CANON_PATH,
    bootstrap: false,
    dryRun: false,
  }
  for (let i = 0; i < argv.length; i++) {
    const f = argv[i]
    const n = argv[i + 1]
    if (f === '--canon-path' && n) {
      args.canonPath = path.resolve(n)
      i++
    } else if (f === '--bootstrap') args.bootstrap = true
    else if (f === '--dry-run') args.dryRun = true
    else if (f === '-h' || f === '--help') {
      console.log(
        'Usage: pnpm tsx scripts/sync-canon.ts [--canon-path <path>] [--bootstrap] [--dry-run]'
      )
      process.exit(0)
    }
  }
  return args
}

function main(): void {
  const args = parseArgs(process.argv.slice(2))
  if (!fs.existsSync(args.canonPath)) {
    throw new Error(`Canon path does not exist: ${args.canonPath}`)
  }

  const totalMissing: { area: string; entries: MissingDescription[] }[] = []

  for (const area of AREAS) {
    const spec = readSpec(area.pkg)
    const result = buildFeatures(spec, area)
    const file = path.join(args.canonPath, `${area.area}.yaml`)

    if (args.bootstrap) {
      const content = emitFullFile(area, result)
      console.log(`[bootstrap] ${file}: ${result.features.length} features`)
      if (!args.dryRun) fs.writeFileSync(file, content)
    } else {
      const existing = readExistingIds(file)
      const news = result.features.filter((f) => !existing.has(f.id))
      const orphans = [...existing].filter(
        (id) => !result.features.some((f) => f.id === id) && id.startsWith(area.area + '.')
      )
      if (news.length === 0) {
        console.log(
          `[sync] ${file}: nothing to add (${result.features.length} matching, ${orphans.length} orphan${orphans.length === 1 ? '' : 's'} in canon)`
        )
      } else {
        console.log(
          `[sync] ${file}: +${news.length} new (${orphans.length} orphan${orphans.length === 1 ? '' : 's'} left untouched)`
        )
        for (const f of news) console.log(`        + ${f.id}`)
        if (!args.dryRun) fs.writeFileSync(file, appendFeatures(file, news))
      }
      if (orphans.length > 0) {
        for (const id of orphans)
          console.log(`        ~ orphan: ${id} (in canon, not in supabase-js)`)
      }
    }

    if (result.missingDescriptions.length > 0) {
      totalMissing.push({ area: area.area, entries: result.missingDescriptions })
    }
  }

  if (totalMissing.length > 0) {
    const count = totalMissing.reduce((n, a) => n + a.entries.length, 0)
    console.log(`\n[warn] ${count} method${count === 1 ? '' : 's'} missing JSDoc summary:`)
    for (const { area, entries } of totalMissing) {
      for (const e of entries) {
        console.log(`        ${e.id.padEnd(45)} ← ${e.className}.${e.methodName}`)
      }
    }
    console.log(`        (description fell back to display name; patch source JSDoc to improve)`)
  }

  if (args.dryRun) console.log('\n(dry run — no files written)')
}

main()
