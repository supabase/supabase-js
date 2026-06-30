-- Fixture for the int8/bigint precision e2e (test/bigint.test.ts). It demonstrates how PostgREST
-- handles values above Number.MAX_SAFE_INTEGER (2^53 - 1) on read (with and without a ::text cast)
-- and on write. This is the runtime behavior the postgres-meta `bigint_as` typegen option describes
-- (supabase/postgres-meta#1078).
create table public.bigint_precision (
  id int primary key,
  big_value int8 not null
);

insert into public.bigint_precision (id, big_value) values
  (1, 9223372036854775807), -- 2^63 - 1; read fixture, not mutated by the tests
  (2, 0),                   -- string-write target
  (3, 0);                   -- number-write (anti-pattern) target
