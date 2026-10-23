/**
 * Everything the planner and the mapper need to know about a database, and where it comes from (design v3 §4.2).
 *
 * All I/O is injected (`SchemaDeps`), so the same functions run under the CLI, the content mapper and tests.
 */

import type {
  Supplementary as PlannerSupplementaryDocument,
  SupplementaryComposite,
  SupplementaryForeignKey,
} from '@supabase/postgrest-planner'

// ---------------------------------------------------------------------------------------------------------------
// Supplementary catalog
// ---------------------------------------------------------------------------------------------------------------

/** `supplementary.format` and the snapshot's `supplementaryFormat`. */
export const SUPPLEMENTARY_FORMAT = 1

/** The planner's format-1 document (`@supabase/postgrest-planner`); `Supplementary` below adds the mapper-only keys. */
export type PlannerSupplementary = PlannerSupplementaryDocument

/** `pg_class.relkind` of the relations the catalog describes. */
export type RelationKind = 'r' | 'v' | 'm' | 'p' | 'f'

export interface SupplementaryColumn {
  name: string
  attnum: number
  /** `format_type`, schema qualified for every type outside `pg_catalog` */
  type: string
  /** `pg_attribute.attnotnull` */
  notNull: boolean
  /** `pg_attribute.atthasdef`: a DEFAULT or a generated expression (an identity column has neither: see `identity`) */
  hasDefault: boolean
  identity: 'always' | 'by default' | null
  generated: 'stored' | 'virtual' | null
}

export interface SupplementaryRelation {
  schema: string
  name: string
  kind: RelationKind
  columns: SupplementaryColumn[]
  /** `pg_get_viewdef` of a view or materialized view, with every relation schema qualified */
  viewDefinition: string | null
  /** `pg_relation_is_updatable`: which statements the relation accepts (views: automatically updatable) */
  updatable: { insert: boolean; update: boolean; delete: boolean }
}

export interface SupplementaryFunction {
  schema: string
  name: string
  argTypes: string[]
  /** `pg_proc.provolatile`: `i`, `s` or `v` */
  volatility: string
  returns: { kind: 'scalar' | 'composite'; setof: boolean; type: string }
  outColumns: { name: string; type: string }[] | null
  /** `pg_language.lanname` */
  language: string
  /** `prosrc` of a `LANGUAGE sql` function (null for other languages and for `BEGIN ATOMIC` bodies) */
  source: string | null
  /** Names of the input arguments, aligned with `argTypes` (`''` for an unnamed one); null when none is named */
  argNames: string[] | null
}

export interface SupplementaryEnum {
  schema: string
  name: string
  /** In sort order */
  labels: string[]
}

/** A CHECK constraint that mentions `jsonb_matches_schema` or `json_matches_schema`. */
export interface SupplementaryJsonSchemaCheck {
  schema: string
  table: string
  constraint: string
  /** `pg_get_constraintdef`, for example `CHECK (extensions.jsonb_matches_schema('{...}'::json, data))` */
  definition: string
  /** Constrained columns (`conkey`) in order */
  columns: string[]
  /** `convalidated`: only a validated constraint proves anything about the rows already stored */
  validated: boolean
}

/**
 * The supplementary catalog: the planner's format-1 document plus keys only the mapper reads. The planner ignores
 * unknown keys at every level, so the whole document is passed to it unchanged (`plannerSupplementary` projects
 * the planner part when a minimal document is wanted).
 *
 * Scope: `relations`, `composites`, `foreignKeys`, `functions` and `enums` cover exactly the exposed schemas
 * (`db-schemas`). `referencedRelations` adds the relations OUTSIDE them that an exposed view (transitively) selects
 * from, which is all the view tracer needs to follow a view into a private schema. A relation that only a function
 * body mentions is not tracked (Postgres records no dependency for a SQL function body), so the tracer treats it as
 * unknown and its columns as nullable. `pg_catalog`, `information_schema` and `pg_toast` are never included.
 */
export interface Supplementary {
  format: 1
  composites: SupplementaryComposite[]
  foreignKeys: SupplementaryForeignKey[]
  relations: SupplementaryRelation[]
  functions: SupplementaryFunction[]
  referencedRelations: SupplementaryRelation[]
  enums: SupplementaryEnum[]
  jsonSchemaChecks: SupplementaryJsonSchemaCheck[]
}

// ---------------------------------------------------------------------------------------------------------------
// Acquisition
// ---------------------------------------------------------------------------------------------------------------

/** What `acquireSchema` returns: everything `loadPlanner(...).load(...)` and the mapper need. */
export interface AcquiredSchema {
  /** `postgrest --dump-schema` as canonical compact JSON text (keys sorted), the planner's `schema` input */
  dump: string
  /** `postgrest --dump-config` as an object, credentials removed (see `redactConfig`), the planner's `config` input */
  config: Record<string, unknown>
  /** `server_version_num` of the database, for example `170011` */
  pgVersionNum: number
  /** PostgREST release, for example `16.4` */
  postgrestVersion: string
  /** Build commit when the binary reports one */
  postgrestCommit?: string
  supplementary: Supplementary
}

export type SchemaSource =
  | {
      source: 'supabase-local'
      /** Directory holding `supabase/config.toml` (`supabase --workdir`). Defaults to the current directory. */
      workdir?: string
      /** The CLI's `project_id`: the PostgREST container is `supabase_rest_<projectId>`. Read from `config.toml` when omitted. */
      projectId?: string
      /** The CLI invocation. Defaults to `['supabase']`. */
      supabaseCommand?: string[]
      /** Skips `supabase status -o json` and uses this database URL for the supplementary catalog. */
      dbUrl?: string
    }
  | {
      source: 'postgrest'
      /** Database URL: reached from the host for the supplementary catalog and from the container for the dumps. */
      dbUrl: string
      /** Defaults to `DEFAULT_POSTGREST_IMAGE`. */
      image?: string
      /** Config keys as `PGRST_*` environment variables, for example `{ 'db-schemas': 'public,analytics' }`. */
      config?: Record<string, string>
      /** `docker run --network`. A loopback host in `dbUrl` is rewritten to `host.docker.internal` unless this is set. */
      network?: string
    }
  | {
      source: 'snapshot'
      path: string
    }

/** The upstream release the planner is built from (`planner_info`). */
export const DEFAULT_POSTGREST_IMAGE = 'public.ecr.aws/supabase/postgrest:v16.4'

export interface ExecResult {
  stdout: string
  stderr: string
  exitCode: number
}

export interface ExecOptions {
  /** Added to the environment of the child process (credentials travel here, never in `args`). */
  env?: Record<string, string>
  cwd?: string
}

/** Runs a program to completion. Resolves for any exit code; rejects only when it cannot be started. */
export type ExecFn = (command: string, args: string[], options?: ExecOptions) => Promise<ExecResult>

/** The queries `acquireSupplementary` needs, over ONE connection (it opens a transaction). */
export interface DbClient {
  query(sql: string, params?: unknown[]): Promise<Record<string, unknown>[]>
}

export interface DbConnection extends DbClient {
  close(): Promise<void>
}

export interface SchemaFs {
  readFile(path: string): Promise<string>
  writeFile(path: string, data: string): Promise<void>
  mkdir(path: string): Promise<void>
}

export interface SchemaLogger {
  debug(message: string): void
  info(message: string): void
  warn(message: string): void
}

export interface SchemaDeps {
  /** Defaults to `nodeExec`. */
  exec?: ExecFn
  /** Opens a connection to a database URL. Defaults to `connectPg`. */
  connect?: (url: string) => Promise<DbConnection>
  /** Defaults to `node:fs/promises`. */
  fs?: SchemaFs
  /** Messages are scrubbed of credentials before they reach it. Defaults to silence. */
  logger?: SchemaLogger
}
