import { resolve } from 'node:path'
import { acquireSchema, nodeExec, type AcquiredSchema, type ExecFn } from '../../src'

/** The Supabase CLI project of the postgrest-js test stack (`nx test:infra postgrest-js`) */
export const STACK_WORKDIR = resolve(__dirname, '../../../../core/postgrest-js/test')

/** The database URL of the running stack, resolved on every call: nothing is cached across suites */
export async function stackDbUrl(): Promise<string> {
  const status = await nodeExec('npx', [
    'supabase',
    'status',
    '-o',
    'json',
    '--workdir',
    STACK_WORKDIR,
  ])
  return JSON.parse(status.stdout.slice(status.stdout.indexOf('{'))).DB_URL
}

/** The real `supabase`/`docker` of the stack: a temp project only carries the project id, its CLI project is the shared one */
export const stackExec: ExecFn = (command, args, options) =>
  command === 'supabase'
    ? nodeExec(
        'npx',
        ['supabase', ...args.map((a, i) => (args[i - 1] === '--workdir' ? STACK_WORKDIR : a))],
        options
      )
    : nodeExec(command, args, options)

/** Reads the running stack (nothing is written to it): the same acquisition `supabase-local` users get. */
export function acquireFromStack(): Promise<AcquiredSchema> {
  return acquireSchema({
    source: 'supabase-local',
    workdir: STACK_WORKDIR,
    supabaseCommand: ['npx', 'supabase'],
  })
}

/**
 * The pinned planner build the tests run against (set by whoever runs them, because the planner package rebuilds its
 * wasm). Test setup only: production code takes the `wasmPath` option.
 */
export function plannerWasmPath(): string | undefined {
  return process.env['POSTGREST_PLANNER_WASM'] || undefined
}
