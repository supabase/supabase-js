{-# LANGUAGE DeriveAnyClass #-}
{-# LANGUAGE DerivingStrategies #-}
{-# LANGUAGE StandaloneDeriving #-}

-- | FromJSON instances for upstream's schema cache types.
--
-- Upstream only ships ToJSON (it backs @postgrest --dump-schema@). The instances below are the
-- generic mirror images of those ToJSON instances, declared as orphans so that no upstream module
-- has to change. The derived fuzzy-match index is not part of the dump, so it is rebuilt here the
-- same way 'PostgREST.SchemaCache.querySchemaCache' builds it.
module Planner.SchemaCacheJSON
  ( decodeSchemaCache
  , encodeSchemaCache
  ) where

import Control.Arrow ((&&&))
import Data.Aeson (FromJSON (..), FromJSONKey (..), Value, (.:))
import qualified Data.Aeson as JSON
import qualified Data.ByteString.Lazy as LBS
import qualified Data.FuzzySet as Fuzzy
import qualified Data.HashMap.Strict as HM
import Hasql.Transaction.Sessions (IsolationLevel)

import PostgREST.MediaType (MTVndPlanFormat, MTVndPlanOption, MediaType)
import PostgREST.SchemaCache (SchemaCache (..))
import PostgREST.SchemaCache.Identifiers (QualifiedIdentifier (..), RelIdentifier)
import PostgREST.SchemaCache.Relationship (Cardinality, Junction, Relationship)
import PostgREST.SchemaCache.Routine
  ( FuncVolatility
  , MediaHandler
  , PgType
  , RetType
  , Routine
  , RoutineParam
  )
import PostgREST.SchemaCache.Table (Column, Table)

deriving anyclass instance FromJSON QualifiedIdentifier
deriving anyclass instance FromJSONKey QualifiedIdentifier
deriving anyclass instance FromJSON RelIdentifier
deriving anyclass instance FromJSONKey RelIdentifier

deriving anyclass instance FromJSON MediaType
deriving anyclass instance FromJSON MTVndPlanOption
deriving anyclass instance FromJSON MTVndPlanFormat

deriving anyclass instance FromJSON Column
deriving anyclass instance FromJSON Table

deriving anyclass instance FromJSON Cardinality
deriving anyclass instance FromJSON Junction
deriving anyclass instance FromJSON Relationship

deriving anyclass instance FromJSON PgType
deriving anyclass instance FromJSON RetType
deriving anyclass instance FromJSON FuncVolatility
deriving anyclass instance FromJSON RoutineParam
deriving anyclass instance FromJSON IsolationLevel
deriving anyclass instance FromJSON Routine
deriving anyclass instance FromJSON MediaHandler

-- Same policy as upstream: schemas with too many relations get no fuzzy index.
maxDbTablesForFuzzySearch :: Int
maxDbTablesForFuzzySearch = 500

instance FromJSON SchemaCache where
  parseJSON = JSON.withObject "SchemaCache" $ \o -> do
    tabs <- o .: "dbTables"
    rels <- o .: "dbRelationships"
    routs <- o .: "dbRoutines"
    reps <- o .: "dbRepresentations"
    hdlrs <- o .: "dbMediaHandlers"
    pure
      SchemaCache
        { dbTables = tabs
        , dbRelationships = rels
        , dbRoutines = routs
        , dbRepresentations = reps
        , dbMediaHandlers = hdlrs
        , dbTablesFuzzyIndex =
            Fuzzy.fromList
              <$> HM.filter
                ((< maxDbTablesForFuzzySearch) . length)
                (HM.fromListWith (<>) ((qiSchema &&& pure . qiName) <$> HM.keys tabs))
        }

decodeSchemaCache :: LBS.ByteString -> Either String SchemaCache
decodeSchemaCache = JSON.eitherDecode

-- | Re-encode with upstream's ToJSON (the --dump-schema path), as a 'Value' so key order is canonical.
encodeSchemaCache :: SchemaCache -> Value
encodeSchemaCache = JSON.toJSON
