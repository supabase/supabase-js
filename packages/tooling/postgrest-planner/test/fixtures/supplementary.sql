-- Supplementary catalog for postgrest-planner (format 1). The schema list must match the db-schemas config.
-- search_path is emptied so format_type() qualifies every non-pg_catalog type, matching the schema dump.
set search_path = '';
select jsonb_pretty(jsonb_build_object(
  'format', 1,
  'relations', coalesce((
    select jsonb_agg(jsonb_build_object(
      'schema', n.nspname, 'name', c.relname,
      'columns', (select coalesce(jsonb_agg(jsonb_build_object('name', a.attname, 'attnum', a.attnum) order by a.attnum), '[]')
                  from pg_attribute a where a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped)
    ) order by n.nspname, c.relname)
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where c.relkind in ('r', 'v', 'm', 'p', 'f')
      and n.nspname = any ('{public,personal,graphql_public}')
  ), '[]'),
  'composites', coalesce((
    select jsonb_agg(jsonb_build_object(
      'schema', n.nspname, 'name', c.relname,
      'attributes', (select coalesce(jsonb_agg(jsonb_build_object('name', a.attname, 'type', format_type(a.atttypid, a.atttypmod), 'attnum', a.attnum) order by a.attnum), '[]')
                     from pg_attribute a where a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped)
    ) order by n.nspname, c.relname)
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where c.relkind = 'c' and n.nspname = any ('{public,personal,graphql_public}')
  ), '[]'),
  'foreignKeys', coalesce((
    select jsonb_agg(jsonb_build_object(
      'schema', n.nspname, 'table', c.relname, 'constraint', k.conname, 'validated', k.convalidated
    ) order by n.nspname, c.relname, k.conname)
    from pg_constraint k
    join pg_class c on c.oid = k.conrelid
    join pg_namespace n on n.oid = c.relnamespace
    where k.contype = 'f' and n.nspname = any ('{public,personal,graphql_public}')
  ), '[]'),
  'functions', coalesce((
    select jsonb_agg(jsonb_build_object(
      'schema', n.nspname, 'name', p.proname,
      'argTypes', (select coalesce(jsonb_agg(format_type(t, null) order by o), '[]')
                   from unnest(coalesce(p.proargtypes::oid[], '{}')) with ordinality as u(t, o)),
      'volatility', p.provolatile,
      'returns', jsonb_build_object(
        'kind', case when rt.typtype = 'c' or rt.oid = 'pg_catalog.record'::regtype then 'composite' else 'scalar' end,
        'setof', p.proretset,
        'type', format_type(p.prorettype, null)),
      'outColumns', case when p.proallargtypes is not null and p.proargmodes is not null
                         and exists (select 1 from unnest(p.proargmodes) m where m in ('t', 'b', 'o')) then
                      (select jsonb_agg(jsonb_build_object('name', coalesce(p.proargnames[i], 'column' || i), 'type', format_type(p.proallargtypes[i], null)) order by i)
                       from generate_subscripts(p.proargmodes, 1) i where p.proargmodes[i] in ('t', 'b', 'o'))
                    end
    ) order by n.nspname, p.proname, p.oid)
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    join pg_type rt on rt.oid = p.prorettype
    where p.prokind = 'f'
      and n.nspname = any ('{public,personal,graphql_public}')
      and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
  ), '[]')
));
