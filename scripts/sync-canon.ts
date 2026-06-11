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

interface AreaConfig {
  area: string
  pkg: string
  title: string
  description: string
  groups: { id: string; title: string }[]
  matchers: ClassMatcher[]
  // Map enclosing class → group id. Falls back to byMethodPrefix below.
  classToGroup: Record<string, string>
  byMethodPrefix?: { match: (snake: string) => boolean; group: string }[]
}

const AREAS: AreaConfig[] = [
  {
    area: 'auth',
    pkg: 'auth-js',
    title: 'Authentication',
    description:
      'User sign-in flows, session management, MFA, passkeys, identity linking, and admin operations.',
    groups: [
      { id: 'sign-in', title: 'Sign-in / Sign-up' },
      { id: 'passkey', title: 'Passkeys' },
      { id: 'session', title: 'Session & User' },
      { id: 'identities', title: 'Identity Linking' },
      { id: 'mfa', title: 'Multi-Factor Authentication' },
      { id: 'mfa-webauthn', title: 'WebAuthn MFA' },
      { id: 'oauth-server', title: 'OAuth Server' },
      { id: 'admin', title: 'Admin API' },
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
    classToGroup: {
      GoTrueAdminApi: 'admin',
      GoTrueAdminMFAApi: 'admin',
      GoTrueAdminOAuthApi: 'admin',
      GoTrueAdminPasskeyApi: 'admin',
      GoTrueAdminCustomProvidersApi: 'admin',
      GoTrueMFAApi: 'mfa',
      AuthOAuthServerApi: 'oauth-server',
      WebAuthnApi: 'mfa-webauthn',
    },
    // GoTrueClient is the catch-all — split by snake-stem prefix.
    byMethodPrefix: [
      { match: (s) => s.endsWith('_passkey') || s === 'register_passkey', group: 'passkey' },
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
      {
        match: () => true,
        group: 'session',
      },
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
      { id: 'filter', title: 'Filter' },
      { id: 'modifier', title: 'Modifier' },
    ],
    matchers: [
      'PostgrestClient',
      'PostgrestQueryBuilder',
      'PostgrestFilterBuilder',
      'PostgrestTransformBuilder',
    ],
    classToGroup: {
      PostgrestClient: 'query',
      PostgrestQueryBuilder: 'mutate', // select sits here too — overridden below
      PostgrestFilterBuilder: 'filter',
      PostgrestTransformBuilder: 'modifier',
    },
    byMethodPrefix: [
      { match: (s) => s === 'select', group: 'query' },
      { match: () => false, group: 'query' }, // unused, classToGroup wins
    ],
  },
  {
    area: 'storage',
    pkg: 'storage-js',
    title: 'Storage',
    description: 'Object storage — upload, download, list, and manage files in buckets.',
    groups: [
      { id: 'files', title: 'Files' },
      { id: 'buckets', title: 'Buckets' },
      { id: 'vectors', title: 'Vectors' },
    ],
    matchers: [
      'StorageClient',
      'StorageVectorsClient',
      'VectorBucketScope',
      'VectorIndexScope',
      /StorageFileApi\.ts$/,
      /StorageBucketApi\.ts$/,
    ],
    classToGroup: {
      StorageClient: 'buckets',
      StorageVectorsClient: 'vectors',
      VectorBucketScope: 'vectors',
      VectorIndexScope: 'vectors',
    },
    byMethodPrefix: [
      // Default for the StorageFileApi default-exported class (unnamed in typedoc).
      { match: () => true, group: 'files' },
    ],
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
    ],
    matchers: ['RealtimeClient', 'RealtimeChannel'],
    classToGroup: {
      RealtimeClient: 'client',
      RealtimeChannel: 'channel',
    },
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

const DENYLIST = new Set<string>([
  'then',
  'catch',
  'finally',
  'toJSON',
  'dispose',
  'log',
  'isThrowOnErrorEnabled',
])

const REPO_ROOT = path.resolve(__dirname, '..')

// Default canon location: a sibling checkout of github.com/supabase/sdk.
// Override with --canon-path or SUPABASE_SDK_CAPABILITIES_PATH.
const DEFAULT_CANON_PATH = path.resolve(REPO_ROOT, '..', 'sdk', 'capabilities')

// ─── spec.json walking ────────────────────────────────────────────────────────

interface SpecNode {
  name?: string
  kind?: number
  children?: SpecNode[]
  sources?: { fileName?: string }[]
  signatures?: { comment?: { summary?: { kind: string; text: string }[] } }[]
}

interface MethodMeta {
  name: string // camelCase, the typedoc-reported method name
  className: string // enclosing class — used to derive group
  description: string // first paragraph of JSDoc summary, or a generated fallback
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

function extractDescription(node: SpecNode): string {
  const summary = node.signatures?.[0]?.comment?.summary
  if (!summary || summary.length === 0) return ''
  const text = summary
    .filter((p) => p.kind === 'text')
    .map((p) => p.text)
    .join('')
    .trim()
  // First paragraph only.
  return text
    .split(/\n\s*\n/)[0]
    .replace(/\s+/g, ' ')
    .trim()
}

function collectMethods(spec: SpecNode, ms: ClassMatcher[]): Map<string, MethodMeta> {
  // Method name → meta. Duplicate method names (e.g., signOut on GoTrueClient and
  // GoTrueAdminApi) collapse — the first encountered wins. Bootstrap order: top
  // of spec.json down, which puts the primary client class first for each area.
  const found = new Map<string, MethodMeta>()

  function visit(node: SpecNode, enclosingClass: string | null): void {
    if (!node || typeof node !== 'object') return
    const isClass = node.kind === 128 || node.kind === 256
    const nextClass = isClass && classMatches(node, ms) ? classDisplayName(node) : enclosingClass
    if (
      nextClass &&
      node.kind === 2048 &&
      typeof node.name === 'string' &&
      !DENYLIST.has(node.name)
    ) {
      if (!found.has(node.name)) {
        found.set(node.name, {
          name: node.name,
          className: nextClass,
          description: extractDescription(node),
        })
      }
    }
    if (Array.isArray(node.children)) {
      for (const c of node.children) visit(c, nextClass)
    }
  }

  visit(spec, null)
  return found
}

// ─── name / id transforms ─────────────────────────────────────────────────────

function camelToSnake(name: string): string {
  return name
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

function resolveGroup(meta: MethodMeta, snakeStem: string, area: AreaConfig): string | undefined {
  const cls = area.classToGroup[meta.className]
  if (cls) {
    // Check method-prefix override (e.g., database.select belongs in 'query', not 'mutate').
    if (area.byMethodPrefix) {
      for (const rule of area.byMethodPrefix) {
        if (rule.match(snakeStem)) return rule.group
      }
    }
    return cls
  }
  if (area.byMethodPrefix) {
    for (const rule of area.byMethodPrefix) {
      if (rule.match(snakeStem)) return rule.group
    }
  }
  return area.groups[0]?.id
}

interface FeatureEntry {
  id: string
  name: string
  description: string
  group?: string
}

function buildFeatures(spec: SpecNode, area: AreaConfig): FeatureEntry[] {
  const methods = collectMethods(spec, area.matchers)
  const entries: FeatureEntry[] = []
  for (const meta of methods.values()) {
    const stem = camelToSnake(meta.name)
    entries.push({
      id: `${area.area}.${stem}`,
      name: snakeToTitle(stem),
      description: meta.description || `${snakeToTitle(stem)} (no description in source).`,
      group: resolveGroup(meta, stem, area),
    })
  }
  entries.sort((a, b) => a.id.localeCompare(b.id))
  return entries
}

// ─── yaml emit / parse ────────────────────────────────────────────────────────

function quoteScalar(s: string): string {
  // Always double-quote for safety; descriptions can contain colons, dashes, etc.
  return '"' + s.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"'
}

function emitFeatureBlock(f: FeatureEntry): string {
  const lines = [
    `  - id: ${f.id}`,
    `    name: ${quoteScalar(f.name)}`,
    `    description: ${quoteScalar(f.description)}`,
  ]
  if (f.group) lines.push(`    group: ${f.group}`)
  return lines.join('\n')
}

function emitFullFile(area: AreaConfig, features: FeatureEntry[]): string {
  const lines: string[] = [
    '# yaml-language-server: $schema=../schema/capability-matrix.schema.json',
    `area: ${area.area}`,
    `title: ${quoteScalar(area.title)}`,
    `description: ${quoteScalar(area.description)}`,
    'groups:',
  ]
  for (const g of area.groups) {
    lines.push(`  - id: ${g.id}`, `    title: ${quoteScalar(g.title)}`)
  }
  lines.push('features:')
  for (const f of features) lines.push(emitFeatureBlock(f))
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

  for (const area of AREAS) {
    const spec = readSpec(area.pkg)
    const features = buildFeatures(spec, area)
    const file = path.join(args.canonPath, `${area.area}.yaml`)

    if (args.bootstrap) {
      const content = emitFullFile(area, features)
      console.log(`[bootstrap] ${file}: ${features.length} features`)
      if (!args.dryRun) fs.writeFileSync(file, content)
    } else {
      const existing = readExistingIds(file)
      const news = features.filter((f) => !existing.has(f.id))
      const orphans = [...existing].filter(
        (id) => !features.some((f) => f.id === id) && id.startsWith(area.area + '.')
      )
      if (news.length === 0) {
        console.log(
          `[sync] ${file}: nothing to add (${features.length} matching, ${orphans.length} orphan${orphans.length === 1 ? '' : 's'} in canon)`
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
  }

  if (args.dryRun) console.log('\n(dry run — no files written)')
}

main()
