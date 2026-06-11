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

interface AreaConfig {
  area: string
  pkg: string
  // A class is included if its name equals a string matcher, OR if its first
  // source file path matches a regex matcher. Both forms are useful: default-
  // exported classes (e.g. StorageFileApi) lose their name in typedoc and have
  // to be matched by file path.
  matchers: ClassMatcher[]
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
  },
  {
    area: 'functions',
    pkg: 'functions-js',
    matchers: ['FunctionsClient'],
  },
]

// Method names that show up across multiple classes as boilerplate, not real
// user-facing features. Keep this list conservative — when in doubt, leave it
// in and prune the yaml by hand.
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

interface SpecNode {
  name?: string
  kind?: number
  children?: SpecNode[]
  sources?: { fileName?: string }[]
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

// Walk every node; whenever we're inside a class/interface that matches one
// of the area's matchers, collect its methods.
//
// Duplicate method names across multiple matched classes (e.g. `signOut` on
// both GoTrueClient and GoTrueAdminApi) collapse into a single entry — the
// Set deduplicates, and the yaml schema requires unique feature IDs anyway.
// `seen` lets the caller report how many duplicates were filtered out.
function collectMethods(
  spec: SpecNode,
  ms: ClassMatcher[],
  seen: { duplicates: number }
): Set<string> {
  const found = new Set<string>()

  function visit(node: SpecNode, insideMatched: boolean): void {
    if (!node || typeof node !== 'object') return
    const isClass = node.kind === 128 || node.kind === 256
    const inside = insideMatched || (isClass && matches(node, ms))
    if (inside && node.kind === 2048 && typeof node.name === 'string') {
      if (!DENYLIST.has(node.name)) {
        if (found.has(node.name)) seen.duplicates++
        else found.add(node.name)
      }
    }
    if (Array.isArray(node.children)) {
      for (const c of node.children) visit(c, inside)
    }
  }

  visit(spec, false)
  return found
}

// camelCase / PascalCase → snake_case.
// Handles the common boundary (lower→upper) and digit boundary (alpha→digit).
// Does NOT split acronym runs (SSO, OAuth, URL): they collapse to lowercase
// as one token, which is what the canon registry wants (auth.sign_in_with_oauth,
// not auth.sign_in_with_o_auth).
function camelToSnake(name: string): string {
  return name
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
  for (const { area, pkg, matchers } of AREAS) {
    const spec = readSpec(pkg)
    const seen = { duplicates: 0 }
    const methods = [...collectMethods(spec, matchers, seen)]
    areaMethods.set(area, methods)
    totalDuplicates += seen.duplicates
    const dupNote =
      seen.duplicates > 0
        ? ` (${seen.duplicates} duplicate${seen.duplicates === 1 ? '' : 's'} filtered)`
        : ''
    console.log(`${area} (${pkg}): ${methods.length} methods${dupNote}`)
  }

  emitYaml(areaMethods, args.out)
  console.log(
    `\nWrote ${args.out}${totalDuplicates > 0 ? ` (${totalDuplicates} duplicate method names filtered overall)` : ''}`
  )
}

main()
