import { resolve } from 'node:path'
import { acquireSchema, type AcquiredSchema } from '../../src'

/** The Supabase CLI project of the postgrest-js test stack (`nx test:infra postgrest-js`) */
export const STACK_WORKDIR = resolve(__dirname, '../../../../core/postgrest-js/test')

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
