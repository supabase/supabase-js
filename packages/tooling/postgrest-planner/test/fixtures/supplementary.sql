-- Supplementary catalog for postgrest-planner (format 1). Run with the extra search path of the PostgREST
-- configuration (db-extra-search-path) as a psql variable, in array literal form:
--   psql -v extra_search_path='{public,extensions}' -f supplementary.sql
-- The exposed schemas below must match the db-schemas config. The catalog covers the exposed schemas and every
-- schema of the extra search path: that list is recorded as `schemas`.
-- search_path is emptied so format_type() qualifies every non-pg_catalog type, matching the schema dump.
set search_path = '';
with recursive s as (
  select '{public,personal,graphql_public}'::text[] as exposed,
         array(select distinct x from unnest('{public,personal,graphql_public}'::text[] || :'extra_search_path'::text[]) x
               where x <> 'pg_catalog' order by x) as covered
),
-- the types a function returns as a row: a composite, record, or a domain over one (transitively): PostgreSQL
-- expands such a domain like its composite (funcapi.c), so it is not a scalar whatever its own typtype says
composite_types(oid) as (
  select t.oid from pg_type t where t.typtype = 'c' or t.oid = 'pg_catalog.record'::regtype
  union
  select t.oid from pg_type t join composite_types c on t.typtype = 'd' and t.typbasetype = c.oid
)
select jsonb_pretty(jsonb_build_object(
  'format', 1,
  'schemas', to_jsonb((select covered from s)),
  'relations', coalesce((
    select jsonb_agg(jsonb_build_object(
      'schema', n.nspname, 'name', c.relname,
      'columns', (select coalesce(jsonb_agg(jsonb_build_object('name', a.attname, 'attnum', a.attnum) order by a.attnum), '[]')
                  from pg_attribute a where a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped)
    ) order by n.nspname, c.relname)
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where c.relkind in ('r', 'v', 'm', 'p', 'f')
      and n.nspname = any ((select exposed from s)::text[])
  ), '[]'),
  'composites', coalesce((
    select jsonb_agg(jsonb_build_object(
      'schema', n.nspname, 'name', c.relname,
      'attributes', (select coalesce(jsonb_agg(jsonb_build_object('name', a.attname, 'type', format_type(a.atttypid, a.atttypmod), 'attnum', a.attnum) order by a.attnum), '[]')
                     from pg_attribute a where a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped)
    ) order by n.nspname, c.relname)
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where c.relkind = 'c' and n.nspname = any ((select exposed from s)::text[])
  ), '[]'),
  'foreignKeys', coalesce((
    select jsonb_agg(jsonb_build_object(
      'schema', n.nspname, 'table', c.relname, 'constraint', k.conname, 'validated', k.convalidated
    ) order by n.nspname, c.relname, k.conname)
    from pg_constraint k
    join pg_class c on c.oid = k.conrelid
    join pg_namespace n on n.oid = c.relnamespace
    where k.contype = 'f' and n.nspname = any ((select exposed from s)::text[])
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
                    end
    ) order by n.nspname, p.proname, p.oid)
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    join pg_type rt on rt.oid = p.prorettype
    where p.prokind = 'f'
      and n.nspname = any ((select exposed from s)::text[])
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
      and n.nspname = any ((select covered from s)::text[])
      and case when exists (select 1 from pg_depend d where d.classid = 'pg_proc'::regclass and d.objid = p.oid and d.deptype = 'e')
               -- a member of an extension (postgis alone has hundreds): listed, in any covered schema, only where a
               -- lookup can reach it: the first argument of a computed field or relationship is the row type of a
               -- relation and the others, if any, have defaults, and a function with OUT columns describes the rows
               -- of an RPC
               then (p.pronargs >= 1 and p.pronargs - p.pronargdefaults <= 1 and exists (select 1 from pg_class c where c.reltype = p.proargtypes[0]))
                    or exists (select 1 from unnest(p.proargmodes) m where m in ('t', 'b', 'o'))
               else n.nspname <> all ((select exposed from s)::text[])
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
    where n.nspname = any ((select covered from s)::text[])
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
  ), '[]')
));
