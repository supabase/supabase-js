#!/usr/bin/env node

/**
 * Generate the TypeScript declarations that type the postgrest-js tests.
 *
 *   node scripts/generate-postgrest-types.js           snapshot the test stack, then generate
 *   node scripts/generate-postgrest-types.js --check   verify both committed files, write nothing
 *
 * The schema is acquired from the postgrest-js test stack (Supabase CLI, workdir
 * packages/core/postgrest-js/test) with `postgrest-mapper snapshot`, and the declarations are
 * generated from that snapshot with `postgrest-mapper generate`, so `generate` needs no database.
 * A stack that is already running is used as is and left running; one that is not running is
 * started for the run and stopped afterwards.
 */

const { spawnSync } = require('child_process')
const path = require('path')

const ROOT = path.join(__dirname, '..')
const POSTGREST_DIR = path.join(ROOT, 'packages/core/postgrest-js')
const TEST_DIR = path.join(POSTGREST_DIR, 'test')
const TSCONFIG = path.join(POSTGREST_DIR, 'tsconfig.test.json')
const SNAPSHOT_FILE = path.join(TEST_DIR, 'postgrest-schema.json')
const OUTPUT_FILE = path.join(TEST_DIR, 'postgrest.generated.d.ts')
const MAPPER_BIN = path.join(ROOT, 'packages/tooling/postgrest-mapper/bin/postgrest-mapper.cjs')

const check = process.argv.includes('--check')

// The first line of the mapper's messages that mean "the committed file is stale", as opposed to
// "the generation itself failed".
const DRIFT = /is out of date|does not exist|differs from the canonical form/

function run(command, args, options = {}) {
  return spawnSync(command, args, { cwd: ROOT, encoding: 'utf8', ...options })
}

function supabase(args, options = {}) {
  // An absolute workdir: `pnpm exec` does not rewrite the cwd to the nearest package.json directory.
  return run('pnpm', ['exec', 'supabase', '--workdir', TEST_DIR, ...args], options)
}

function mapper(args) {
  const result = run(process.execPath, [MAPPER_BIN, ...args])
  process.stdout.write(result.stdout ?? '')
  process.stderr.write(
    (result.stderr ?? '').replace(/^\(node:\d+\) ExperimentalWarning.*\n\(Use .*\n/gm, '')
  )
  return result
}

function fail(message) {
  console.error(`\n❌ ${message}\n`)
  process.exit(1)
}

function main() {
  console.log(
    check
      ? '🔍 Checking postgrest-js test declarations...\n'
      : '🔄 Generating postgrest-js test declarations...\n'
  )

  const build = run('pnpm', ['exec', 'nx', 'build', 'postgrest-mapper'], {
    stdio: 'inherit',
    encoding: undefined,
  })
  if (build.status !== 0)
    fail('Building @supabase/postgrest-mapper failed. This is NOT a drift failure.')

  const wasRunning = supabase(['status'], { stdio: 'ignore', encoding: undefined }).status === 0
  if (!wasRunning) {
    console.log('📦 Starting Supabase...')
    const start = supabase(['start'], { stdio: 'inherit', encoding: undefined })
    if (start.status !== 0) fail('Starting the test stack failed. This is NOT a drift failure.')
  }

  let failure
  let drift = false
  try {
    const workdir = ['--workdir', TEST_DIR, '--supabase-command', 'pnpm exec supabase']
    if (check) {
      const snapshot = mapper(['snapshot', '--out', SNAPSHOT_FILE, '--check', ...workdir])
      if (snapshot.status !== 0) {
        failure = 'the schema snapshot'
        drift = DRIFT.test(snapshot.stderr ?? '')
      } else {
        const generated = mapper([
          'generate',
          '--project',
          TSCONFIG,
          '--out',
          OUTPUT_FILE,
          '--check',
        ])
        if (generated.status !== 0) {
          failure = 'the generated declarations'
          drift = DRIFT.test(generated.stderr ?? '')
        }
      }
    } else {
      const snapshot = mapper(['snapshot', '--out', SNAPSHOT_FILE, ...workdir])
      if (snapshot.status !== 0) failure = 'the schema snapshot'
      else {
        const generated = mapper(['generate', '--project', TSCONFIG, '--out', OUTPUT_FILE])
        if (generated.status !== 0) failure = 'the generated declarations'
      }
    }
  } finally {
    if (!wasRunning) {
      console.log('🧹 Cleaning up Supabase...')
      supabase(['stop', '--no-backup'], { stdio: 'ignore', encoding: undefined })
    }
  }

  if (failure && check && drift) {
    fail(
      `Postgrest generated types are out of sync (${failure}).\n   Run: pnpm codegen:postgrest\n   Then commit the changes.`
    )
  }
  if (failure) {
    fail(
      `Generating ${failure} itself failed — see the error above. This is NOT a drift failure; re-running codegen will not help.`
    )
  }

  console.log(
    check ? '\n✅ Postgrest generated types are in sync!' : '\n✅ Type generation complete!'
  )
  if (!check) {
    console.log(`   Snapshot: ${SNAPSHOT_FILE}`)
    console.log(`   Output:   ${OUTPUT_FILE}`)
  }
}

main()
