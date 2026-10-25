import { SchemaAcquisitionError } from './errors'
import { withReadOnlyTransaction } from './db'
import { SUPPLEMENTARY_FORMAT } from './types'
import type { DbClient, Supplementary } from './types'

/**
 * The supplementary catalog query. `$1` is the exposed schema list (`text[]`), `$2` the `db-extra-search-path` list
 * (`text[]`); `search_path` must be empty so that `format_type`, `pg_get_viewdef` and `pg_get_constraintdef` qualify
 * every non-`pg_catalog` name.
 *
 * The planner part (`schemas` ... `casts`, minus the keys marked mapper-only) is the generator of the
 * planner's `test/fixtures/supplementary.sql`; a test keeps the two equal. Every array is ordered, so the output is
 * deterministic.
 */
export const SUPPLEMENTARY_SQL = `
with recursive
exposed as (
  select oid from pg_namespace where nspname = any ($1::text[])
),
-- the schemas the planner looks a computed field or a cast type up in: exposed plus db-extra-search-path
covered as (
  select array(select distinct x from unnest($1::text[] || $2::text[]) x where x <> 'pg_catalog' order by x) as names
),
-- the types a function returns as a row: a composite, record, or a domain over one (transitively): PostgreSQL
-- expands such a domain like its composite (funcapi.c), so it is not a scalar whatever its own typtype says
composite_types(oid) as (
  select t.oid from pg_type t where t.typtype = 'c' or t.oid = 'pg_catalog.record'::regtype
  union
  select t.oid from pg_type t join composite_types c on t.typtype = 'd' and t.typbasetype = c.oid
),
-- the functions and aggregates of the covered schemas named like a builtin aggregate that a call with one argument may
-- reach: count(x) prefers one whose argument fits x to the builtin count(any)
overloads as (
  select p.oid, p.proargtypes
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where p.proname in ('count', 'sum', 'avg', 'min', 'max')
    and p.prokind in ('f', 'a')
    and p.pronargs >= 1 and p.pronargs - p.pronargdefaults <= 1
    and n.nspname = any ((select names from covered)::text[])
),
-- the types an implicit cast matters for: the first argument of those, the element type of an array (the argument
-- may be VARIADIC) and the base type of a domain (a domain is resolved as its base), transitively
overload_targets(oid) as (
  select o.proargtypes[0] from overloads o
  union
  select case when t.typtype = 'd' then t.typbasetype else t.typelem end
  from overload_targets ot
  join pg_type t on t.oid = ot.oid
  where t.typtype = 'd' or (t.typcategory = 'A' and t.typelem <> 0)
),
-- every relation an exposed view selects from, transitively, through its rewrite rule
deps(oid) as (
  select c.oid from pg_class c where c.relkind in ('v', 'm') and c.relnamespace in (select oid from exposed)
  union
  select d.refobjid
  from deps
  join pg_rewrite r on r.ev_class = deps.oid
  join pg_depend d on d.objid = r.oid and d.classid = 'pg_rewrite'::regclass
                  and d.refclassid = 'pg_class'::regclass and d.refobjid <> deps.oid
),
rel as (
  select c.oid, n.nspname, c.relname, (c.relnamespace in (select oid from exposed)) as is_exposed,
    jsonb_build_object(
      'schema', n.nspname, 'name', c.relname,
      'kind', c.relkind,
      'columns', (select coalesce(jsonb_agg(jsonb_build_object(
                    'name', a.attname, 'attnum', a.attnum,
                    'type', format_type(a.atttypid, a.atttypmod),
                    'notNull', a.attnotnull, 'hasDefault', a.atthasdef,
                    'identity', case a.attidentity when 'a' then 'always' when 'd' then 'by default' end,
                    'generated', case a.attgenerated when 's' then 'stored' when 'v' then 'virtual' end
                  ) order by a.attnum), '[]')
                  from pg_attribute a where a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped),
      'viewDefinition', case when c.relkind in ('v', 'm') then pg_get_viewdef(c.oid) end,
      'updatable', (select jsonb_build_object('insert', (u.ev & 8) <> 0, 'update', (u.ev & 4) <> 0, 'delete', (u.ev & 16) <> 0)
                    from (select pg_relation_is_updatable(c.oid, false) as ev) u)
    ) as item
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where c.relkind in ('r', 'v', 'm', 'p', 'f')
    and (c.relnamespace in (select oid from exposed)
         or (c.oid in (select oid from deps) and n.nspname not in ('pg_catalog', 'information_schema', 'pg_toast')))
)
select jsonb_build_object(
  'format', ${SUPPLEMENTARY_FORMAT},
  'schemas', to_jsonb((select names from covered)),
  'relations', coalesce((select jsonb_agg(item order by nspname, relname) from rel where is_exposed), '[]'),
  'referencedRelations', coalesce((select jsonb_agg(item order by nspname, relname) from rel where not is_exposed), '[]'),
  'composites', coalesce((
    select jsonb_agg(jsonb_build_object(
      'schema', n.nspname, 'name', c.relname,
      'attributes', (select coalesce(jsonb_agg(jsonb_build_object('name', a.attname, 'type', format_type(a.atttypid, a.atttypmod), 'attnum', a.attnum) order by a.attnum), '[]')
                     from pg_attribute a where a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped)
    ) order by n.nspname, c.relname)
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where c.relkind = 'c' and c.relnamespace in (select oid from exposed)
  ), '[]'),
  'foreignKeys', coalesce((
    select jsonb_agg(jsonb_build_object(
      'schema', n.nspname, 'table', c.relname, 'constraint', k.conname, 'validated', k.convalidated
    ) order by n.nspname, c.relname, k.conname)
    from pg_constraint k
    join pg_class c on c.oid = k.conrelid
    join pg_namespace n on n.oid = c.relnamespace
    where k.contype = 'f' and c.relnamespace in (select oid from exposed)
  ), '[]'),
  'functions', coalesce((
    select jsonb_agg(jsonb_build_object(
      'schema', n.nspname, 'name', p.proname,
      'argTypes', (select coalesce(jsonb_agg(format_type(t, null) order by o), '[]')
                   from unnest(coalesce(p.proargtypes::oid[], '{}')) with ordinality as u(t, o)),
      'volatility', p.provolatile,
      -- the trailing input arguments that have a default: a call may leave them out
      'defaults', p.pronargdefaults,
      'returns', jsonb_build_object(
        'kind', case when rt.oid in (select oid from composite_types) then 'composite' else 'scalar' end,
        'setof', p.proretset,
        'type', format_type(p.prorettype, null)),
      'outColumns', case when p.proallargtypes is not null and p.proargmodes is not null
                         and exists (select 1 from unnest(p.proargmodes) m where m in ('t', 'b', 'o')) then
                      (select jsonb_agg(jsonb_build_object('name', coalesce(nullif(p.proargnames[o.i], ''), case when o.total = 1 then 'pgrst_call' else 'column' || o.n end), 'type', format_type(p.proallargtypes[o.i], null)) order by o.i)
                       from (select i, row_number() over (order by i) as n, count(*) over () as total
                             from generate_subscripts(p.proargmodes, 1) i where p.proargmodes[i] in ('t', 'b', 'o')) o)
                    end,
      'language', l.lanname,
      'source', case when l.lanname = 'sql' and p.prosrc <> '' then p.prosrc end,
      -- the value of the function's own SET search_path as stored (mapper-only: its body runs along it)
      'searchPath', (select substr(c, length('search_path=') + 1) from unnest(p.proconfig) c where c like 'search_path=%'),
      'argNames', case when p.proargnames is null then null
                       when p.proargmodes is null then to_jsonb(p.proargnames)
                       else (select coalesce(jsonb_agg(coalesce(p.proargnames[i], '') order by i), '[]')
                             from generate_subscripts(p.proargmodes, 1) i where p.proargmodes[i] in ('i', 'b', 'v'))
                  end
    ) order by n.nspname, p.proname, p.oid)
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    join pg_type rt on rt.oid = p.prorettype
    join pg_language l on l.oid = p.prolang
    where p.prokind = 'f'
      and p.pronamespace in (select oid from exposed)
      and not exists (select 1 from pg_depend d where d.classid = 'pg_proc'::regclass and d.objid = p.oid and d.deptype = 'e')
  ), '[]'),
  'searchPathFunctions', coalesce((
    select jsonb_agg(jsonb_build_object(
      'schema', n.nspname, 'name', p.proname,
      'argTypes', (select coalesce(jsonb_agg(format_type(t, null) order by o), '[]')
                   from unnest(coalesce(p.proargtypes::oid[], '{}')) with ordinality as u(t, o)),
      'volatility', p.provolatile,
      -- the trailing input arguments that have a default: a call may leave them out
      'defaults', p.pronargdefaults,
      'returns', jsonb_build_object(
        'kind', case when rt.oid in (select oid from composite_types) then 'composite' else 'scalar' end,
        'setof', p.proretset,
        'type', format_type(p.prorettype, null)),
      'outColumns', case when p.proallargtypes is not null and p.proargmodes is not null
                         and exists (select 1 from unnest(p.proargmodes) m where m in ('t', 'b', 'o')) then
                      (select jsonb_agg(jsonb_build_object('name', coalesce(nullif(p.proargnames[o.i], ''), case when o.total = 1 then 'pgrst_call' else 'column' || o.n end), 'type', format_type(p.proallargtypes[o.i], null)) order by o.i)
                       from (select i, row_number() over (order by i) as n, count(*) over () as total
                             from generate_subscripts(p.proargmodes, 1) i where p.proargmodes[i] in ('t', 'b', 'o')) o)
                    end
    ) order by n.nspname, p.proname, p.oid)
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    join pg_type rt on rt.oid = p.prorettype
    where p.prokind = 'f'
      and n.nspname = any ((select names from covered)::text[])
      and case when exists (select 1 from pg_depend d where d.classid = 'pg_proc'::regclass and d.objid = p.oid and d.deptype = 'e')
               -- a member of an extension (postgis alone has hundreds): listed, in any covered schema, only where a
               -- lookup can reach it: the first argument of a computed field or relationship is the row type of a
               -- relation (or an array of one: VARIADIC) and the others, if any, have defaults, and a function with
               -- OUT columns describes the rows of an RPC
               then (p.pronargs >= 1 and p.pronargs - p.pronargdefaults <= 1
                    and (exists (select 1 from pg_class c where c.reltype = p.proargtypes[0])
                         -- or an array of one, which is a candidate when its argument is VARIADIC
                         or exists (select 1 from pg_type at join pg_class c on c.reltype = at.typelem
                                    where at.oid = p.proargtypes[0] and at.typcategory = 'A')))
                    or exists (select 1 from unnest(p.proargmodes) m where m in ('t', 'b', 'o'))
               else n.nspname <> all ($1::text[])
          end
  ), '[]'),
  'types', coalesce((
    select jsonb_agg(jsonb_build_object(
      'schema', n.nspname, 'name', t.typname, 'kind', t.typtype,
      'base', case when t.typtype = 'd' then format_type(t.typbasetype, t.typtypmod) end,
      'element', case when el.oid is not null then format_type(el.oid, null) end
    ) order by n.nspname, t.typname)
    from pg_type t join pg_namespace n on n.oid = t.typnamespace
    left join pg_type el on el.typarray = t.oid
    where n.nspname = any ((select names from covered)::text[])
      and n.nspname <> 'pg_catalog'
      and t.typtype in ('b', 'c', 'd', 'e', 'm', 'r')
  ), '[]'),
  'casts', coalesce((
    select jsonb_agg(jsonb_build_object(
      'source', format_type(c.castsource, null), 'target', format_type(c.casttarget, null), 'method', c.castmethod
    ) order by format_type(c.castsource, null), format_type(c.casttarget, null), c.oid)
    from pg_cast c
    join pg_type st on st.oid = c.castsource
    join pg_type tt on tt.oid = c.casttarget
    where st.typnamespace <> 'pg_catalog'::regnamespace or tt.typnamespace <> 'pg_catalog'::regnamespace
  ), '[]'),
  'aggregates', coalesce((
    select jsonb_agg(jsonb_build_object(
      'schema', n.nspname, 'name', p.proname,
      'argTypes', (select coalesce(jsonb_agg(format_type(t, null) order by o), '[]')
                   from unnest(coalesce(p.proargtypes::oid[], '{}')) with ordinality as u(t, o)),
      'defaults', p.pronargdefaults
    ) order by n.nspname, p.proname, p.oid)
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where p.oid in (select oid from overloads) and p.prokind = 'a'
  ), '[]'),
  'implicitCasts', coalesce((
    select jsonb_agg(jsonb_build_object(
      'source', format_type(c.castsource, null), 'target', format_type(c.casttarget, null)
    ) order by format_type(c.castsource, null), format_type(c.casttarget, null), c.oid)
    from pg_cast c
    where c.castcontext = 'i' and c.casttarget in (select oid from overload_targets)
  ), '[]'),
  'enums', coalesce((
    select jsonb_agg(jsonb_build_object(
      'schema', n.nspname, 'name', t.typname,
      'labels', (select coalesce(jsonb_agg(e.enumlabel order by e.enumsortorder), '[]') from pg_enum e where e.enumtypid = t.oid)
    ) order by n.nspname, t.typname)
    from pg_type t join pg_namespace n on n.oid = t.typnamespace
    where t.typtype = 'e' and t.typnamespace in (select oid from exposed)
  ), '[]'),
  'jsonSchemaChecks', coalesce((
    select jsonb_agg(jsonb_build_object(
      'schema', r.nspname, 'table', r.relname, 'constraint', k.conname,
      'definition', pg_get_constraintdef(k.oid),
      'columns', (select coalesce(jsonb_agg(a.attname order by u.ord), '[]')
                  from unnest(k.conkey) with ordinality as u(attnum, ord)
                  join pg_attribute a on a.attrelid = k.conrelid and a.attnum = u.attnum),
      'validated', k.convalidated
    ) order by r.nspname, r.relname, k.conname)
    from pg_constraint k
    join rel r on r.oid = k.conrelid
    where k.contype = 'c' and pg_get_constraintdef(k.oid) ~ 'json(b)?_matches_schema'
  ), '[]')
) as doc
`

/**
 * Reads the supplementary catalog of the given schemas over a single connection, inside a read-only transaction
 * that is always rolled back.
 */
export function acquireSupplementary(
  db: DbClient,
  schemas: string[],
  extraSearchPath: string[]
): Promise<Supplementary> {
  return withReadOnlyTransaction(db, (tx) => querySupplementary(tx, schemas, extraSearchPath))
}

/**
 * The query alone, for a caller that already holds a read-only transaction (`withReadOnlyTransaction`).
 * `extraSearchPath` is the `db-extra-search-path` of the config (`extraSearchPath(config)`).
 */
export async function querySupplementary(
  db: DbClient,
  schemas: string[],
  extraSearchPath: string[]
): Promise<Supplementary> {
  const rows = await db.query(SUPPLEMENTARY_SQL, [schemas, extraSearchPath])
  const doc = rows[0]?.doc
  if (typeof doc !== 'object' || doc === null) {
    throw new SchemaAcquisitionError(
      'database',
      'the supplementary catalog query returned no document'
    )
  }
  return doc as Supplementary
}

/** `server_version_num` of the connected server. */
export async function readPgVersionNum(db: DbClient): Promise<number> {
  const rows = await db.query("select current_setting('server_version_num')::int as v")
  const value = Number(rows[0]?.v)
  if (!Number.isInteger(value)) {
    throw new SchemaAcquisitionError('database', 'could not read server_version_num')
  }
  return value
}
