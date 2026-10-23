-- | Spelling of Postgres types in the planner's JSON output.
--
-- The schema cache carries @format_type@ spellings (@integer@, @timestamp with time zone@,
-- @numeric(10,2)@), function return types carry @pg_type@ names (@pg_catalog.int4@, @public._foo@), casts
-- carry whatever the client typed (@int@, @float@, @varchar@). Everything the planner reports goes
-- through here so the printer sees one spelling: internal names (@int4@, @timestamptz@), no type
-- modifiers, @schema.name@ only outside @pg_catalog@, and @[]@ for arrays.
module Planner.PgType
  ( normalizeType
  , qualifiedTypeName
  , isBuiltinType
  , aggregateType
  ) where

import Data.Char (isSpace)
import Data.Text (Text)
import qualified Data.Text as T

import PostgREST.ApiRequest.Types (AggregateFunction (..))
import PostgREST.SchemaCache.Identifiers (QualifiedIdentifier (..))

-- | Normalises a @format_type@ spelling or a client-typed cast.
--
-- >>> normalizeType "timestamp(3) with time zone"  == "timestamptz"
-- >>> normalizeType "numeric(10,2)[]"               == "numeric[]"
-- >>> normalizeType "extensions.geometry(Point,4326)" == "extensions.geometry"
normalizeType :: Text -> Text
normalizeType raw = canonical base <> T.replicate dims "[]"
  where
    (base, dims) = splitArray (T.strip raw) (0 :: Int)

    -- Peels trailing @[]@ / @[n]@ groups (outside of quotes there is nothing else to find after them).
    splitArray s n
      | "]" `T.isSuffixOf` s
      , (before, open) <- T.breakOnEnd "[" s
      , not (T.null open) || not (T.null before)
      , not (T.null before) =
          splitArray (T.strip (T.init before)) (n + 1)
      | otherwise = (s, n)

canonical :: Text -> Text
canonical t0
  | t0 == "\"char\"" = "char"
  | T.any (== '"') t0 = t0 -- quoted identifiers keep their exact spelling
  | otherwise = builtin (T.replace "pg_catalog." "" (T.toLower (squash (stripModifiers t0))))
  where
    squash = T.unwords . T.words

-- | Drops @(...)@ type modifiers (nesting-aware) and collapses the whitespace they leave behind.
stripModifiers :: Text -> Text
stripModifiers = T.pack . go (0 :: Int) . T.unpack
  where
    go _ [] = []
    go d (c : cs)
      | c == '(' = go (d + 1) cs
      | c == ')' = go (max 0 (d - 1)) cs
      | d > 0 = go d cs
      | isSpace c = ' ' : go d cs
      | otherwise = c : go d cs

-- | SQL spellings and aliases to the internal @pg_type@ name.
builtin :: Text -> Text
builtin t = case t of
  "int" -> "int4"
  "integer" -> "int4"
  "smallint" -> "int2"
  "bigint" -> "int8"
  "real" -> "float4"
  "float" -> "float8"
  "double precision" -> "float8"
  "decimal" -> "numeric"
  "dec" -> "numeric"
  "boolean" -> "bool"
  "character varying" -> "varchar"
  "char varying" -> "varchar"
  "character" -> "bpchar"
  "char" -> "bpchar"
  "bit varying" -> "varbit"
  "timestamp with time zone" -> "timestamptz"
  "timestamp without time zone" -> "timestamp"
  "time with time zone" -> "timetz"
  "time without time zone" -> "time"
  _
    | "interval " `T.isPrefixOf` t -> "interval" -- @interval year to month@
    | otherwise -> t

-- | A @pg_type@-sourced name (routine return types in the schema dump): a leading underscore is an
-- array type, @pg_catalog@ is dropped, everything else is @schema.name@.
qualifiedTypeName :: QualifiedIdentifier -> Text
qualifiedTypeName (QualifiedIdentifier schema name) = case T.stripPrefix "_" name of
  Just element | not (T.null element) -> qualify element <> "[]"
  _ -> qualify name
  where
    qualify n
      | T.null schema || schema == "pg_catalog" = n
      | otherwise = schema <> "." <> n

-- | Result type of an aggregate over an input type (already 'normalizeType'd).
-- @count@ is always @int8@, @min@/@max@ keep the input, @sum@/@avg@ widen per the Postgres catalog.
aggregateType :: AggregateFunction -> Text -> Text
aggregateType fn input = case fn of
  Count -> "int8"
  Min -> input
  Max -> input
  Sum -> case input of
    "int2" -> "int8"
    "int4" -> "int8"
    "int8" -> "numeric"
    _ -> input -- float4, float8, numeric, money, interval keep their type
  Avg -> case input of
    "int2" -> "numeric"
    "int4" -> "numeric"
    "int8" -> "numeric"
    "numeric" -> "numeric"
    "float4" -> "float8"
    "float8" -> "float8"
    _ -> input -- interval

-- | Whether a 'normalizeType'd name is a type of @pg_catalog@ (or an array of one). 'normalizeType' drops
-- @pg_catalog@ and qualifies every other type with its schema, but a client-typed cast can leave a user type
-- unqualified (@::user_status@, which the search path resolves), so the name is checked against the types
-- @pg_catalog@ ships rather than against the absence of a schema. A cast between two such types is a builtin
-- cast, which keeps NULL as NULL and non-NULL as non-NULL; the cast function of any other type can return
-- NULL.
isBuiltinType :: Text -> Bool
isBuiltinType t = stripArrays t `elem` builtinTypes
  where
    stripArrays n = maybe n stripArrays (T.stripSuffix "[]" n)

builtinTypes :: [Text]
builtinTypes =
  [ "bool", "bytea", "char", "name", "int8", "int2", "int4", "text", "oid", "tid", "xid", "cid"
  , "json", "xml", "jsonb", "jsonpath", "float4", "float8", "money", "macaddr", "macaddr8", "inet", "cidr"
  , "bpchar", "varchar", "date", "time", "timestamp", "timestamptz", "interval", "timetz", "bit", "varbit"
  , "numeric", "uuid", "pg_lsn", "tsvector", "tsquery", "gtsvector", "txid_snapshot", "pg_snapshot"
  , "point", "lseg", "path", "box", "polygon", "line", "circle"
  , "int2vector", "oidvector", "record", "void", "regproc", "regprocedure", "regoper", "regoperator"
  , "regclass", "regtype", "regrole", "regnamespace", "regconfig", "regdictionary", "regcollation"
  , "int4range", "numrange", "tsrange", "tstzrange", "daterange", "int8range"
  , "int4multirange", "nummultirange", "tsmultirange", "tstzmultirange", "datemultirange", "int8multirange"
  ]
