import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { WASI } from 'node:wasi'

export interface PlannerInfo {
  ok: true
  abi: number
  ghc: string
  postgrest: { version: string; tag: string; commit: string }
}

/** Failure value produced by the reactor (upstream PostgREST error or ABI-level error). */
export interface PlannerError {
  ok: false
  status?: number
  error: {
    code?: string
    message?: string
    details?: unknown
    hint?: unknown
    [k: string]: unknown
  }
  [k: string]: unknown
}

export interface LoadSuccess {
  ok: true
  handle: number
  schemas: string[]
  summary: string
  ignoredConfigKeys: string[]
}

export interface LoadInput {
  /** PostgREST config as a JSON object of config keys (see `postgrest --dump-config`). */
  config: Record<string, unknown>
  /** Output of `postgrest --dump-schema`. */
  schema: string
}

export interface PlanRequest {
  method: string
  url: string
  headers?: Record<string, string>
  body?: string
}

export interface QualifiedName {
  name: string
  schema: string
}

export interface SelectItem {
  aggregate: string | null
  aggregateCast: string | null
  alias: string | null
  cast: string | null
  jsonPath: unknown
  name: string
  outputName: string
  type: string
}

export interface EmbedPlan {
  alias: string | null
  embeds: EmbedPlan[]
  hint: string | null
  joinType: string | null
  jsonMode: 'array' | 'object' | string
  name: string
  outputName: string
  relationship: unknown
  select: SelectItem[]
  spread: boolean
  target: QualifiedName
  toOne: boolean
}

export interface PlanSuccess {
  ok: true
  action: 'read' | 'insert' | 'update' | 'delete' | 'upsert' | 'rpc' | string
  media: string
  txMode: string
  explain: boolean
  target: QualifiedName
  select: SelectItem[]
  embeds: EmbedPlan[]
  warnings: unknown[]
  mutation?: unknown
  call?: unknown
  routine?: unknown
  payloadKeys?: string[]
  debug?: string
  [k: string]: unknown
}

export type LoadResult = LoadSuccess | PlannerError
export type PlanResult = PlanSuccess | PlannerError

export interface Planner {
  info(): PlannerInfo
  load(input: LoadInput): LoadResult
  plan(handle: number, request: PlanRequest): PlanResult
  freeCache(handle: number): void
}

export interface LoadPlannerOptions {
  /** Path to postgrest-planner.wasm. Defaults to the package's `dist/postgrest-planner.wasm`. */
  wasmPath?: string
}

export function defaultWasmPath(): string {
  // src/ (ts-jest) and dist/main/ (built) sit at different depths: walk up to the package root.
  let dir = __dirname
  while (!existsSync(join(dir, 'package.json'))) {
    const parent = dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  return join(dir, 'dist', 'postgrest-planner.wasm')
}

interface Exports {
  memory: WebAssembly.Memory
  hs_init(argc: number, argv: number): void
  planner_alloc(n: number): number
  planner_free(ptr: number): void
  planner_info(): number
  planner_load(cfgP: number, cfgN: number, schP: number, schN: number): number
  planner_plan(handle: number, reqP: number, reqN: number): number
  planner_free_cache(handle: number): void
}

export async function loadPlanner(options: LoadPlannerOptions = {}): Promise<Planner> {
  const wasmPath = options.wasmPath ?? defaultWasmPath()
  if (!existsSync(wasmPath)) {
    throw new Error(
      `postgrest-planner wasm not found at ${wasmPath} (run: nx build:wasm postgrest-planner)`
    )
  }
  const wasi = new WASI({ version: 'preview1', args: ['postgrest-planner'], env: {} })
  const { instance } = await WebAssembly.instantiate(readFileSync(wasmPath), {
    wasi_snapshot_preview1: wasi.wasiImport,
  })
  wasi.initialize(instance) // reactor: runs _initialize
  const x = instance.exports as unknown as Exports
  x.hs_init(0, 0)

  const enc = new TextEncoder()
  const dec = new TextDecoder()
  const mem = () => new Uint8Array(x.memory.buffer) // re-view after every call: memory may grow

  const put = (str: string): [number, number] => {
    const bytes = enc.encode(str)
    const ptr = x.planner_alloc(bytes.length)
    mem().set(bytes, ptr)
    return [ptr, bytes.length]
  }
  // Results are [u32 LE length][bytes]
  const take = (ptr: number): unknown => {
    const len = new DataView(x.memory.buffer).getUint32(ptr, true)
    const text = dec.decode(mem().subarray(ptr + 4, ptr + 4 + len))
    x.planner_free(ptr)
    return JSON.parse(text)
  }

  return {
    info: () => take(x.planner_info()) as PlannerInfo,
    load({ config, schema }) {
      const [cp, cn] = put(JSON.stringify(config))
      const [sp, sn] = put(schema)
      const res = take(x.planner_load(cp, cn, sp, sn)) as LoadResult
      x.planner_free(cp)
      x.planner_free(sp)
      return res
    },
    freeCache: (handle) => x.planner_free_cache(handle),
    plan(handle, request) {
      const [p, n] = put(JSON.stringify(request))
      const res = take(x.planner_plan(handle, p, n)) as PlanResult
      x.planner_free(p)
      return res
    },
  }
}

/** Parses `postgrest --dump-config` output (`key = <JSON value>` lines) into a config object. */
export function parseConfigDump(text: string): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const line of text.split('\n')) {
    const m = /^([a-z0-9.-]+)\s*=\s*(.*)$/.exec(line.trim())
    if (m) out[m[1]] = JSON.parse(m[2])
  }
  return out
}
