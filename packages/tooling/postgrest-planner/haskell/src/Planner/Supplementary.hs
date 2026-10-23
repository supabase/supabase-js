{-# LANGUAGE NamedFieldPuns #-}

-- | The supplementary catalog: facts the @--dump-schema@ document does not carry.
--
-- The dump loses column order (its tables are JSON objects), foreign-key validity and the
-- OUT/@RETURNS TABLE@ columns of a function (it does carry routine volatility, which is what plans report). One JSON document (@format: 1@)
-- supplies them; see @test/fixtures/supplementary.sql@ for the generator and the README for the
-- contract. The decoder is lenient on purpose: unknown top-level keys and unknown per-item keys are
-- ignored (the mapper stores view definitions, function bodies and JSON Schema CHECKs in the same
-- document), and a missing section is an empty one.
module Planner.Supplementary
  ( Supplementary (..)
  , SuppFunction (..)
  , SuppReturn (..)
  , decodeSupplementary
  , orderColumns
  , applyColumnOrder
  , foreignKeyValidated
  , Lookup (..)
  , covers
  , findComputedField
  , findRoutine
  , findFunction
  ) where

import Control.Monad (unless)
import Data.Aeson (FromJSON (..), withObject, (.!=), (.:), (.:?))
import qualified Data.Aeson as JSON
import Data.Aeson.Types (Parser)
import qualified Data.ByteString.Lazy as LBS
import qualified Data.HashMap.Strict as HM
import qualified Data.HashMap.Strict.InsOrd as HMI
import Data.List (sortOn)
import Data.Text (Text)

import PostgREST.SchemaCache (SchemaCache (..))
import PostgREST.SchemaCache.Identifiers (QualifiedIdentifier (..))
import PostgREST.SchemaCache.Routine (Routine (..), RoutineParam (..))
import PostgREST.SchemaCache.Table (Table (..))

import Planner.PgType (normalizeType, parseTypeName, sameTypeRef)

data Supplementary = Supplementary
  { suppRelations :: HM.HashMap QualifiedIdentifier [(Text, Int)]
  -- ^ Every table, view, materialized view, partitioned and foreign table: column name and @attnum@.
  , suppComposites :: HM.HashMap QualifiedIdentifier [(Text, Text)]
  -- ^ Composite types: attribute name and @format_type@ spelling, in @attnum@ order.
  , suppForeignKeys :: HM.HashMap (QualifiedIdentifier, Text) Bool
  -- ^ (owning table, constraint name) to @convalidated@.
  , suppFunctions :: [SuppFunction]
  -- ^ The functions of the exposed schemas, then those of the other schemas of the search path.
  , suppSchemas :: [Text]
  -- ^ The schemas the catalog enumerates the functions (@functions@, @searchPathFunctions@) and the types
  -- (@types@) of: the exposed schemas and the schemas of @db-extra-search-path@ it was generated for. A
  -- schema outside this list may hold a function or a type the catalog does not mention.
  , suppTypes :: HM.HashMap QualifiedIdentifier (Maybe Text)
  -- ^ The user types of those schemas (arrays excluded) with the base type of each domain.
  , suppArrays :: HM.HashMap QualifiedIdentifier Text
  -- ^ The array types of those schemas, by their own @pg_type@ name (@_name@, or what Postgres made of it when
  -- that name was taken): the 'normalizeType'd element type. A name is never read as an array by its spelling.
  , suppCasts :: Maybe [(Text, Text, Text)]
  -- ^ Every @pg_cast@ row with a side outside @pg_catalog@: source, target (both 'normalizeType'd) and
  -- @castmethod@ (@f@ function, @i@ I/O, @b@ binary). 'Nothing' when the document has no @casts@ section: which
  -- casts exist is then unknown.
  }

data Composite = Composite QualifiedIdentifier [(Text, Text)]

data SuppFunction = SuppFunction
  { sfSchema :: Text
  , sfName :: Text
  , sfArgTypes :: [Text]
  -- ^ Input argument types as @format_type@ spells them (schema-qualified outside @pg_catalog@).
  , sfVolatility :: Text
  -- ^ @provolatile@: @i@, @s@ or @v@.
  , sfDefaults :: Int
  -- ^ @pronargdefaults@: how many of the trailing input arguments have a default, so a call may leave them out.
  , sfReturns :: SuppReturn
  , sfOutColumns :: Maybe [(Text, Text)]
  -- ^ OUT / TABLE columns (name, type), when the function has any.
  }

data SuppReturn = SuppReturn
  { srKind :: Text
  -- ^ @scalar@ or @composite@ (@record@ counts as composite).
  , srSetof :: Bool
  , srType :: Text
  }

instance FromJSON Supplementary where
  parseJSON = withObject "Supplementary" $ \o -> do
    fmt <- o .: "format" :: Parser Int
    unless (fmt == 1) $ fail ("unsupported supplementary catalog format " <> show fmt <> " (expected 1)")
    rels <- o .:? "relations" .!= []
    comps <- o .:? "composites" .!= []
    fks <- o .:? "foreignKeys" .!= []
    fns <- o .:? "functions" .!= []
    pathFns <- o .:? "searchPathFunctions" .!= []
    schemas <- o .:? "schemas" .!= []
    types <- o .:? "types" .!= []
    casts <- o .:? "casts" :: Parser (Maybe [CastItem])
    pure
      Supplementary
        { suppRelations = HM.fromList [(QualifiedIdentifier s n, sortOn snd cols) | RelItem s n cols <- rels]
        , suppComposites = HM.fromList [(qi, as) | Composite qi as <- comps]
        , suppForeignKeys = HM.fromList [((QualifiedIdentifier s t, c), v) | FkItem s t c v <- fks]
        , suppFunctions = fns <> pathFns
        , suppSchemas = schemas
        , suppTypes = HM.fromList [(QualifiedIdentifier s n, normalizeType <$> base) | TypeItem s n base Nothing <- types]
        , suppArrays = HM.fromList [(QualifiedIdentifier s n, normalizeType el) | TypeItem s n _ (Just el) <- types]
        , suppCasts = fmap (\items -> [(normalizeType src, normalizeType tgt, m) | CastItem src tgt m <- items]) casts
        }

data RelItem = RelItem Text Text [(Text, Int)]

instance FromJSON RelItem where
  parseJSON = withObject "relation" $ \o -> do
    s <- o .: "schema"
    n <- o .: "name"
    cols <- o .: "columns" >>= traverse (withObject "column" (\c -> (,) <$> c .: "name" <*> c .: "attnum"))
    pure (RelItem s n cols)

instance FromJSON Composite where
  parseJSON = withObject "composite" $ \o -> do
    s <- o .: "schema"
    n <- o .: "name"
    attrs <- o .: "attributes" >>= traverse (withObject "attribute" (\a -> (,,) <$> a .: "name" <*> a .: "type" <*> (a .: "attnum" :: Parser Int)))
    pure (Composite (QualifiedIdentifier s n) [(an, at) | (an, at, _) <- sortOn (\(_, _, i) -> i) attrs])

data TypeItem = TypeItem Text Text (Maybe Text) (Maybe Text)

instance FromJSON TypeItem where
  parseJSON = withObject "type" $ \o -> TypeItem <$> o .: "schema" <*> o .: "name" <*> o .:? "base" <*> o .:? "element"

data CastItem = CastItem Text Text Text

instance FromJSON CastItem where
  parseJSON = withObject "cast" $ \o -> CastItem <$> o .: "source" <*> o .: "target" <*> o .: "method"

data FkItem = FkItem Text Text Text Bool

instance FromJSON FkItem where
  parseJSON = withObject "foreign key" $ \o ->
    FkItem <$> o .: "schema" <*> o .: "table" <*> o .: "constraint" <*> o .: "validated"

instance FromJSON SuppFunction where
  parseJSON = withObject "function" $ \o ->
    SuppFunction
      <$> o .: "schema"
      <*> o .: "name"
      <*> o .:? "argTypes" .!= []
      <*> o .:? "volatility" .!= "v"
      <*> o .:? "defaults" .!= 0
      <*> o .: "returns"
      <*> (o .:? "outColumns" >>= traverse (traverse (withObject "out column" (\c -> (,) <$> c .: "name" <*> c .: "type"))))

instance FromJSON SuppReturn where
  parseJSON = withObject "returns" $ \o ->
    SuppReturn <$> o .: "kind" <*> o .:? "setof" .!= False <*> o .: "type"

decodeSupplementary :: LBS.ByteString -> Either String Supplementary
decodeSupplementary = JSON.eitherDecode

-- | Orders a relation's columns (given in dump order) by @attnum@. The flag is 'False' when the order is
-- a guess: no catalog, the relation is not listed, or the dump has columns the catalog does not list
-- (those are appended in dump order).
orderColumns :: Maybe Supplementary -> QualifiedIdentifier -> [Text] -> ([Text], Bool)
orderColumns Nothing _ dump = (dump, False)
orderColumns (Just supp) qi dump = case HM.lookup qi (suppRelations supp) of
  Nothing -> (dump, False)
  Just cols ->
    let known = [c | (c, _) <- cols, c `elem` dump]
        rest = [c | c <- dump, c `notElem` known]
    in  (known <> rest, null rest)

-- | Puts the columns of every table the catalog lists into @attnum@ order. The dump decoder cannot keep
-- the order of a JSON object, and upstream expands @*@ (next to aggregates) in the order of
-- 'tableColumns', so this is what makes expansion match a PostgREST loaded from the database.
applyColumnOrder :: Supplementary -> SchemaCache -> SchemaCache
applyColumnOrder supp sc = sc{dbTables = HM.mapWithKey reorder (dbTables sc)}
  where
    reorder qi table =
      let cols = tableColumns table
          (ordered, _) = orderColumns (Just supp) qi (HMI.keys cols)
      in  table{tableColumns = HMI.fromList [(n, c) | n <- ordered, Just c <- [HMI.lookup n cols]]}

-- | @convalidated@ of a foreign key; 'Nothing' when the catalog does not list the constraint.
foreignKeyValidated :: Supplementary -> QualifiedIdentifier -> Text -> Maybe Bool
foreignKeyValidated supp table constraint = HM.lookup (table, constraint) (suppForeignKeys supp)

-- | What a lookup along the search path found.
data Lookup a
  = Found a
  | Absent
  -- ^ Nothing of that name in any schema of the path, all of which the catalog covers.
  | Uncovered
  -- ^ Not found before a schema of the path the catalog does not cover: it may be there.
  | Ambiguous
  -- ^ The first schema of the path with a candidate has several: Postgres cannot choose between them.

-- | Whether the catalog enumerates the functions and types of a schema. @pg_catalog@ is always the builtins.
covers :: Supplementary -> Text -> Bool
covers supp schema = schema == "pg_catalog" || schema `elem` suppSchemas supp

-- | A computed field is a function @name(relation)@ whose first argument is the relation's row type and whose
-- other arguments, if any, all have defaults. Upstream selects it as @"schema"."relation"."name"@; Postgres reads
-- that as the call @name(relation)@ with an unqualified function name, which it looks up through the
-- @search_path@ of the request (its schema, then @db-extra-search-path@: @PreQuery.hs@), a function with
-- defaulted arguments being a candidate for a call that leaves them out (@parse_func.c@, @namespace.c@). The
-- candidates of the first schema of the path that has any decide, and a function of a schema off the path is not
-- visible at all: a lone candidate is called, several (@f(t)@ with @f(t, n int default 0)@ of one schema) are
-- ambiguous and Postgres finds no column. The path is the first argument. A schema of the path the catalog does
-- not cover, reached before any candidate, leaves the answer open ('Uncovered').
findComputedField :: Supplementary -> [Text] -> QualifiedIdentifier -> Text -> Lookup SuppFunction
findComputedField supp searchPath (QualifiedIdentifier schema rel) name = go searchPath
  where
    relationType = QualifiedIdentifier schema rel
    candidate f = case sfArgTypes f of
      a : extra -> length extra <= sfDefaults f && parseTypeName a == Just relationType
      [] -> False
    go [] = Absent
    go (s : rest) = case [f | f <- suppFunctions supp, sfSchema f == s, sfName f == name, candidate f] of
      [f] -> Found f
      _ : _ -> Ambiguous
      [] | covers supp s -> go rest
         | otherwise -> Uncovered

-- | The catalog entry of a routine of the schema cache: the overload of the same schema and name whose input
-- argument types are the routine's. A name the catalog lists once matches whatever the spelling of its types.
findRoutine :: Supplementary -> Routine -> Maybe SuppFunction
findRoutine supp Function{pdSchema, pdName, pdParams} =
  case [f | f <- named, sameTypes (sfArgTypes f) args] of
    (f : _) -> Just f
    [] -> case named of
      [f] -> Just f
      _ -> Nothing
  where
    named = [f | f <- suppFunctions supp, sfSchema f == pdSchema, sfName f == pdName]
    args = ppType <$> pdParams

-- | The catalog entry of the function of this schema and name whose input argument types are exactly these. Used
-- for what the schema cache lacks: upstream drops a function with an unnamed argument from its routines but keeps
-- it as a computed relationship.
findFunction :: Supplementary -> QualifiedIdentifier -> [Text] -> Maybe SuppFunction
findFunction supp (QualifiedIdentifier schema name) args =
  case [f | f <- suppFunctions supp, sfSchema f == schema, sfName f == name, sameTypes (sfArgTypes f) args] of
    f : _ -> Just f
    [] -> Nothing

sameTypes :: [Text] -> [Text] -> Bool
sameTypes as bs = length as == length bs && and (zipWith sameTypeRef as bs)
