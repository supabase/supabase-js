{-# LANGUAGE LambdaCase #-}
-- | Builds an upstream 'AppConfig' from a JSON object of PostgREST config keys.
--
-- Goes through upstream's own 'readAppConfig' (the same path as in-database @pgrst.*@ settings), so
-- every key keeps upstream's parsing, defaults and validation. Only keys that influence planning
-- are accepted; everything else (db-uri, jwt-secret, server-*, ...) is reported back as ignored.
module Planner.Config
  ( loadAppConfig
  ) where

import Data.Aeson (Value (..))
import qualified Data.Aeson.Key as Key
import qualified Data.Aeson.KeyMap as KM
import Data.List (partition)
import Data.Scientific (floatingOrInteger)
import Data.Text (Text)
import qualified Data.Text as T
import qualified Data.HashMap.Strict as HM

import PostgREST.Config (AppConfig, readAppConfig)

-- | Config keys that change what the planner does.
planningKeys :: [Text]
planningKeys =
  [ "client-error-verbosity"
  , "db-aggregates-enabled"
  , "db-anon-role"
  , "db-extra-search-path"
  , "db-max-rows"
  , "db-plan-enabled"
  , "db-prepared-statements"
  , "db-pre-request"
  , "db-root-spec"
  , "db-schemas"
  , "db-tx-end"
  , "openapi-mode"
  , "url-use-legacy-target-names"
  ]

scalarText :: Value -> Maybe Text
scalarText = \case
  String s -> Just s
  Bool b -> Just (if b then "true" else "false")
  Number n -> Just (either (T.pack . show @Double) (T.pack . show @Integer) (floatingOrInteger n))
  _ -> Nothing

-- | Returns the config and the list of ignored keys.
loadAppConfig :: Value -> IO (Either Text (AppConfig, [Text]))
loadAppConfig = \case
  Object o -> do
    let kvs = [(Key.toText k, v) | (k, v) <- KM.toList o]
        (planning, ignored) = partition ((`elem` planningKeys) . fst) kvs
    case traverse (\(k, v) -> (,) (T.replace "-" "_" k) <$> scalarText v) planning of
      Nothing -> pure (Left "config values must be strings, numbers or booleans")
      Just dbSettings ->
        fmap (\c -> (c, fst <$> ignored)) <$> readAppConfig dbSettings Nothing Nothing HM.empty HM.empty
  _ -> pure (Left "config must be a JSON object")
