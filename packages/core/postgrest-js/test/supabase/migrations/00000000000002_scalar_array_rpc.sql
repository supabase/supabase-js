-- A scalar function whose type is an array: `single()` / `maybeSingle()` on it (test/scalar-array-rpc.test.ts).
CREATE OR REPLACE FUNCTION public.int_array_upto(n integer)
RETURNS integer[] LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN n < 0 THEN NULL ELSE array(SELECT generate_series(1, n)) END;
$$;
