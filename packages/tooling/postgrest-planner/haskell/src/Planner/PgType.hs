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
  , parseTypeName
  , typeSpelling
  , sameTypeRef
  , isBuiltinType
  , hasBuiltinArray
  , isSqlTypeAlias
  , aggregateType
  ) where

import Data.Char (isAsciiLower, isDigit, isSpace)
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

-- | Whether a type name (lower case, single spaces) is one the SQL grammar itself maps to a @pg_catalog@ type:
-- @int@, @integer@, @double precision@, @character varying@, @timestamp with time zone@, ... (@gram.y@
-- builds @SystemTypeName@ for them). Postgres never looks such a spelling up in the search path, whereas a plain
-- name like @int4@ or @text@ is an identifier and is searched like any other.
isSqlTypeAlias :: Text -> Bool
isSqlTypeAlias t = t `elem` aliases || "interval " `T.isPrefixOf` t
  where
    aliases =
      [ "int", "integer", "smallint", "bigint", "real", "float", "double precision", "decimal", "dec", "numeric"
      , "boolean", "character", "char", "character varying", "char varying", "varchar", "bit", "bit varying"
      , "time", "time with time zone", "time without time zone", "timestamp", "timestamp with time zone"
      , "timestamp without time zone", "interval"
      ]

-- | A @pg_type@-sourced name (routine return types in the schema dump): a leading underscore is an
-- array type, @pg_catalog@ is dropped, everything else is @schema.name@ spelled like @format_type@ does.
qualifiedTypeName :: QualifiedIdentifier -> Text
qualifiedTypeName (QualifiedIdentifier schema name) = case T.stripPrefix "_" name of
  Just element | not (T.null element) -> qualify element <> "[]"
  _ -> qualify name
  where
    qualify n
      | T.null schema || schema == "pg_catalog" = n
      | otherwise = typeSpelling (QualifiedIdentifier schema n)

-- | The one identity of a user type: its @(schema, name)@ as @pg_type@ and @pg_namespace@ hold them, raw. A
-- catalog entry is keyed by it directly and a @format_type@ spelling is read back into it, so @public."Amount"@
-- and the pair (@public@, @Amount@) are the same type. 'Nothing' for a spelling that is not a plain
-- @schema.name@ (a @pg_catalog@ type, which 'normalizeType' leaves unqualified, an array, anything unparsable).
parseTypeName :: Text -> Maybe QualifiedIdentifier
parseTypeName raw
  | "[]" `T.isSuffixOf` raw = Nothing
  | otherwise = case parts (T.unpack raw) of
      Just [s, n] | not (T.null s), not (T.null n) -> Just (QualifiedIdentifier s n)
      _ -> Nothing
  where
    parts :: String -> Maybe [Text]
    parts = go [] []
    -- Collects identifiers separated by dots outside quotes; inside quotes @""@ is a quote.
    go acc cur [] = Just (reverse (T.pack (reverse cur) : acc))
    go acc cur ('"' : rest) = quoted acc cur rest
    go acc cur ('.' : rest) = go (T.pack (reverse cur) : acc) [] rest
    go acc cur (c : rest) = go acc (c : cur) rest
    quoted _ _ [] = Nothing
    quoted acc cur ('"' : '"' : rest) = quoted acc ('"' : cur) rest
    quoted acc cur ('"' : rest) = go acc cur rest
    quoted acc cur (c : rest) = quoted acc (c : cur) rest

-- | A type of a schema spelled like @format_type@: each identifier is quoted when it is not a plain lower case
-- name (@public."Amount"@). Keywords, which @format_type@ quotes too, are not recognised.
typeSpelling :: QualifiedIdentifier -> Text
typeSpelling (QualifiedIdentifier s n) = quoteIdentifier s <> "." <> quoteIdentifier n

quoteIdentifier :: Text -> Text
quoteIdentifier i
  | plain = i
  | otherwise = "\"" <> T.replace "\"" "\"\"" i <> "\""
  where
    plain = case T.uncons i of
      Just (c, rest) -> (c == '_' || isAsciiLower c) && T.all (\x -> x == '_' || x == '$' || isAsciiLower x || isDigit x) rest
      Nothing -> False

-- | Whether two type spellings name the same type: the same user type however it is quoted, otherwise the same
-- 'normalizeType'd spelling.
sameTypeRef :: Text -> Text -> Bool
sameTypeRef a b = case (parseTypeName a, parseTypeName b) of
  (Just x, Just y) -> x == y
  _ -> normalizeType a == normalizeType b

-- | Result type of an aggregate over an input type (already 'normalizeType'd); 'Nothing' when Postgres has no such
-- aggregate for it (the request fails there with @42883@). @count@ is always @int8@, @sum@/@avg@ widen per the
-- Postgres catalog, @min@/@max@ follow 'minMaxType'.
aggregateType :: AggregateFunction -> Text -> Maybe Text
aggregateType fn input = case fn of
  Count -> Just "int8"
  Min -> minMaxType input
  Max -> minMaxType input
  Sum -> Just $ case input of
    "int2" -> "int8"
    "int4" -> "int8"
    "int8" -> "numeric"
    _ -> input -- float4, float8, numeric, money, interval keep their type
  Avg -> Just $ case input of
    "int2" -> "numeric"
    "int4" -> "numeric"
    "int8" -> "numeric"
    "numeric" -> "numeric"
    "float4" -> "float8"
    "float8" -> "float8"
    _ -> input -- interval

-- | @min@ and @max@ of an input type, as Postgres resolves the call. @pg_proc.dat@ has one variant per type of
-- 'minMaxKept' (plus @anyarray@ and @anyenum@: an array or an enum keeps its type), and an input without its own
-- variant is coerced to one that has: @varchar@, @name@ and @"char"@ read as @text@, @cidr@ as @inet@ and the
-- @reg*@ types as @oid@ (checked against PostgreSQL 17). A type @pg_catalog@ ships without a variant or a
-- coercion (@uuid@, @bool@, @json@, @bytea@, ranges, ...) has no @min@/@max@: 'Nothing'. A type of any other
-- schema is not known to be one of those and keeps its type (an enum is the usual one).
minMaxType :: Text -> Maybe Text
minMaxType input
  | "[]" `T.isSuffixOf` input = Just input
  | Just t <- lookup input minMaxCoerced = Just t
  | input `elem` minMaxKept = Just input
  | isBuiltinType input = Nothing
  | otherwise = Just input

minMaxKept :: [Text]
minMaxKept =
  [ "int8", "int2", "int4", "oid", "float4", "float8", "date", "time", "timetz", "money", "timestamp", "timestamptz"
  , "interval", "text", "numeric", "bpchar", "tid", "inet", "pg_lsn", "xid8", "int2vector", "oidvector"
  ]

minMaxCoerced :: [(Text, Text)]
minMaxCoerced =
  [("varchar", "text"), ("name", "text"), ("char", "text"), ("cidr", "inet")]
    <> [(t, "oid") | t <- ["regproc", "regprocedure", "regoper", "regoperator", "regclass", "regtype", "regrole", "regnamespace", "regconfig", "regdictionary", "regcollation"]]

-- | Whether a 'normalizeType'd name is a type of @pg_catalog@ (or an array of one). 'normalizeType' drops
-- @pg_catalog@ and qualifies every other type with its schema, but a client-typed cast can leave a user type
-- unqualified (@::user_status@, which the search path resolves), so the name is checked against the types
-- @pg_catalog@ ships rather than against the absence of a schema. Being builtin does not make a cast keep
-- non-NULL (@timestamptz::time@ returns NULL for infinity): that is an explicit allowlist in "Planner.ResultShape".
isBuiltinType :: Text -> Bool
isBuiltinType t = stripArrays t `elem` builtinTypes || stripArrays t `elem` arraylessBuiltinTypes
  where
    stripArrays n = maybe n stripArrays (T.stripSuffix "[]" n)

-- | Whether a type of @pg_catalog@ has an array type of its own (@_int4@ for @int4@): the @typarray@ of its
-- @pg_type@ row is set. @_void@ is no builtin type, so a name like it is looked up in the search path like any
-- user type.
hasBuiltinArray :: Text -> Bool
hasBuiltinArray t = t `elem` builtinTypes

-- | The base, range and multirange types of @pg_catalog@ that have an array type, taken from @pg_type@ of
-- PostgreSQL 17 (@typtype@ @b@, @m@ and @r@ with a @typarray@, plus @record@). The pseudo-types are left out
-- but @record@ and @void@: no value is cast to one of them.
builtinTypes :: [Text]
builtinTypes =
  [ "bool", "bytea", "char", "name", "int8", "int2", "int4", "text", "oid", "tid", "xid", "cid", "xid8"
  , "json", "xml", "jsonb", "jsonpath", "float4", "float8", "money", "macaddr", "macaddr8", "inet", "cidr"
  , "aclitem", "refcursor"
  , "bpchar", "varchar", "date", "time", "timestamp", "timestamptz", "interval", "timetz", "bit", "varbit"
  , "numeric", "uuid", "pg_lsn", "tsvector", "tsquery", "gtsvector", "txid_snapshot", "pg_snapshot"
  , "point", "lseg", "path", "box", "polygon", "line", "circle"
  , "int2vector", "oidvector", "record", "regproc", "regprocedure", "regoper", "regoperator"
  , "regclass", "regtype", "regrole", "regnamespace", "regconfig", "regdictionary", "regcollation"
  , "int4range", "numrange", "tsrange", "tstzrange", "daterange", "int8range"
  , "int4multirange", "nummultirange", "tsmultirange", "tstzmultirange", "datemultirange", "int8multirange"
  ]

-- | The types of @pg_catalog@ (@typtype@ @b@) and @void@ that have no array type: the statistics and parse-tree
-- types, and @void@.
arraylessBuiltinTypes :: [Text]
arraylessBuiltinTypes =
  [ "void", "pg_node_tree", "pg_ndistinct", "pg_dependencies", "pg_mcv_list"
  , "pg_brin_bloom_summary", "pg_brin_minmax_multi_summary"
  ]
