import { withReadOnlyTransaction } from './db'
import type { DbClient } from './types'

/**
 * One hash over the identity of every catalog row PostgREST's schema cache is built from. Each catalog row is
 * reduced to its identity plus `xmin`, the transaction that last rewrote it: DDL rewrites the rows it touches (or
 * deletes them, which drops them from the hash), while routine maintenance leaves them alone. `ANALYZE` and
 * `VACUUM` only write statistics tables or update `pg_class` in place, which keeps `xmin`.
 *
 * `pg_class` is the exception: `TRUNCATE`, `VACUUM FULL` and `REFRESH MATERIALIZED VIEW` assign a new
 * `relfilenode` with an ordinary update, so its `xmin` moves on routine maintenance. Its row is hashed by the
 * columns DDL changes instead, leaving out `relfilenode`, `relpages`, `reltuples`, `relallvisible`,
 * `relallfrozen`, `relfrozenxid`, `relminmxid` and `relhasindex` (an index is a `pg_class` row of its own).
 *
 * Rows are hashed one by one and folded with `bit_xor`, so the result does not depend on scan order and needs no
 * sort. Temporary and TOAST namespaces are left out, since other sessions create and drop objects there freely.
 */
const FINGERPRINT_SQL = `
WITH ns AS (
  SELECT oid FROM pg_catalog.pg_namespace
  WHERE nspname NOT LIKE 'pg\\_temp\\_%' AND nspname NOT LIKE 'pg\\_toast\\_temp\\_%' AND nspname <> 'pg_toast'
), cls AS (
  SELECT c.* FROM pg_catalog.pg_class c WHERE c.relnamespace IN (SELECT oid FROM ns)
)
SELECT to_hex(bit_xor(pg_catalog.hashtextextended(s, 0))) AS fingerprint FROM (
  SELECT 'n:' || oid || ':' || xmin::text AS s FROM pg_catalog.pg_namespace WHERE oid IN (SELECT oid FROM ns)
  UNION ALL
  SELECT 'c:' || concat_ws(':', oid, relname, relnamespace, reltype, reloftype, relowner, relam, reltablespace,
    relpersistence, relkind, relnatts, relchecks, relhasrules, relhastriggers, relrowsecurity,
    relforcerowsecurity, relreplident, relispartition, relacl, reloptions, relpartbound) FROM cls
  UNION ALL
  SELECT 'a:' || a.attrelid || ':' || a.attnum || ':' || a.xmin::text
  FROM pg_catalog.pg_attribute a WHERE a.attrelid IN (SELECT oid FROM cls)
  UNION ALL
  SELECT 'p:' || oid || ':' || xmin::text FROM pg_catalog.pg_proc WHERE pronamespace IN (SELECT oid FROM ns)
  UNION ALL
  SELECT 't:' || oid || ':' || xmin::text FROM pg_catalog.pg_type WHERE typnamespace IN (SELECT oid FROM ns)
  UNION ALL
  SELECT 'e:' || e.oid || ':' || e.xmin::text
  FROM pg_catalog.pg_enum e JOIN pg_catalog.pg_type t ON t.oid = e.enumtypid WHERE t.typnamespace IN (SELECT oid FROM ns)
  UNION ALL
  SELECT 'k:' || oid || ':' || xmin::text FROM pg_catalog.pg_constraint WHERE connamespace IN (SELECT oid FROM ns)
  UNION ALL
  SELECT 'r:' || oid || ':' || xmin::text FROM pg_catalog.pg_rewrite WHERE ev_class IN (SELECT oid FROM cls)
  UNION ALL
  SELECT 'i:' || inhrelid || ':' || inhparent || ':' || xmin::text
  FROM pg_catalog.pg_inherits WHERE inhrelid IN (SELECT oid FROM cls)
  UNION ALL
  SELECT 'd:' || d.classoid || ':' || d.objoid || ':' || d.objsubid || ':' || d.xmin::text
  FROM pg_catalog.pg_description d
  WHERE d.classoid <> 'pg_catalog.pg_class'::pg_catalog.regclass OR d.objoid IN (SELECT oid FROM cls)
  UNION ALL
  SELECT 'x:' || oid || ':' || xmin::text FROM pg_catalog.pg_cast
  UNION ALL
  SELECT 's:' || setdatabase || ':' || setrole || ':' || xmin::text FROM pg_catalog.pg_db_role_setting
) rows
`

/**
 * A cheap read-only hash of everything in the database catalogs that PostgREST's schema cache depends on:
 * namespaces, relations, columns, functions, types, enum labels, constraints, view rules, inheritance, casts, comments
 * and per-role/database settings. It changes whenever DDL changes any of them (including a `GRANT`, which
 * rewrites the ACL of the object) and stays the same under routine maintenance (`ANALYZE`,
 * `VACUUM`, `TRUNCATE`, `REFRESH MATERIALIZED VIEW`). One query in a read-only transaction.
 *
 * The hash covers the whole database, not one schema, so DDL in a schema PostgREST does not expose also changes
 * it. Treat a change as "reload the schema", never as "this specific thing changed". Not a security boundary: a
 * 64-bit non-cryptographic hash.
 */
export async function schemaFingerprint(db: DbClient): Promise<string> {
  return withReadOnlyTransaction(db, async (tx) => {
    const rows = await tx.query(FINGERPRINT_SQL)
    return String(rows[0]?.['fingerprint'])
  })
}
