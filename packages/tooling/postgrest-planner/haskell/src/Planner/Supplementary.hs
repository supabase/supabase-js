-- | The supplementary catalog: facts the @--dump-schema@ document does not carry.
--
-- The dump loses column order (its tables are JSON objects), foreign-key validity, routine
-- volatility and the OUT/@RETURNS TABLE@ columns of a function. One JSON document (@format: 1@)
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
  , findComputedField
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
import PostgREST.SchemaCache.Table (Table (..))

data Supplementary = Supplementary
  { suppRelations :: HM.HashMap QualifiedIdentifier [(Text, Int)]
  -- ^ Every table, view, materialized view, partitioned and foreign table: column name and @attnum@.
  , suppComposites :: HM.HashMap QualifiedIdentifier [(Text, Text)]
  -- ^ Composite types: attribute name and @format_type@ spelling, in @attnum@ order.
  , suppForeignKeys :: HM.HashMap (QualifiedIdentifier, Text) Bool
  -- ^ (owning table, constraint name) to @convalidated@.
  , suppFunctions :: [SuppFunction]
  }

data Composite = Composite QualifiedIdentifier [(Text, Text)]

data SuppFunction = SuppFunction
  { sfSchema :: Text
  , sfName :: Text
  , sfArgTypes :: [Text]
  -- ^ Input argument types as @format_type@ spells them (schema-qualified outside @pg_catalog@).
  , sfVolatility :: Text
  -- ^ @provolatile@: @i@, @s@ or @v@.
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
    pure
      Supplementary
        { suppRelations = HM.fromList [(QualifiedIdentifier s n, sortOn snd cols) | RelItem s n cols <- rels]
        , suppComposites = HM.fromList [(qi, as) | Composite qi as <- comps]
        , suppForeignKeys = HM.fromList [((QualifiedIdentifier s t, c), v) | FkItem s t c v <- fks]
        , suppFunctions = fns
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

-- | A computed field is a function @name(relation)@ with exactly the relation's row type as its only
-- argument. A function in the relation's own schema wins; otherwise the first match in catalog order
-- (the order Postgres would try schemas in is not modelled).
findComputedField :: Supplementary -> QualifiedIdentifier -> Text -> Maybe SuppFunction
findComputedField supp (QualifiedIdentifier schema rel) name =
  case sortOn ((/= schema) . sfSchema) [f | f <- suppFunctions supp, sfName f == name, sfArgTypes f == [relationType]] of
    (f : _) -> Just f
    [] -> Nothing
  where
    relationType = schema <> "." <> rel
