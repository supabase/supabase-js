{-# LANGUAGE LambdaCase #-}

-- | Runs upstream's pure request pipeline on a synthetic request:
-- @userPreferences@ -> @userApiRequest@ -> @actionPlan@, with no database involved.
module Planner.Request
  ( planRequest
  ) where

import Data.Aeson (Value (..), object, (.=))
import qualified Data.Aeson as JSON
import qualified Data.Aeson.Key as Key
import qualified Data.Aeson.KeyMap as KM
import qualified Data.ByteString as BS
import qualified Data.ByteString.Char8 as BS8
import qualified Data.ByteString.Lazy as LBS
import qualified Data.CaseInsensitive as CI
import Data.Text (Text)
import qualified Data.Text.Encoding as T
import qualified Data.Vector as V
import qualified Network.HTTP.Types as HTTP
import qualified Network.Wai as Wai

import PostgREST.ApiRequest (ApiRequest (..), userApiRequest, userPreferences)
import PostgREST.Config (AppConfig (..))
import PostgREST.Error (Error (..), errorPayload, status)
import PostgREST.Plan (actionPlan)
import PostgREST.SchemaCache (SchemaCache)

import Planner.ResultShape (planShape)
import Planner.Summary (summarize)
import Planner.Supplementary (Supplementary)

-- | Request spec: @{"method":"GET","url":"/users?select=a","headers":{"Prefer":"..."},"body":"..."}@.
data Spec = Spec
  { spMethod :: BS.ByteString
  , spUrl :: BS.ByteString
  , spHeaders :: [(CI.CI BS.ByteString, BS.ByteString)]
  , spBody :: LBS.ByteString
  }

parseSpec :: Value -> Either Text Spec
parseSpec = \case
  Object o -> do
    method <- textField "method" o
    url <- textField "url" o
    hdrs <- case KM.lookup "headers" o of
      Nothing -> Right []
      Just (Object h) -> concat <$> traverse hdrEntry (KM.toList h)
      Just _ -> Left "headers must be an object"
    body <- case KM.lookup "body" o of
      Nothing -> Right ""
      Just Null -> Right ""
      Just (String b) -> Right (LBS.fromStrict (T.encodeUtf8 b))
      Just v -> Right (JSON.encode v)
    Right (Spec (T.encodeUtf8 method) (T.encodeUtf8 url) hdrs body)
  _ -> Left "request must be a JSON object"
  where
    textField k o = case KM.lookup k o of
      Just (String s) -> Right s
      _ -> Left ("missing string field " <> Key.toText k)
    hdrEntry (k, v) = case v of
      String s -> Right [(name k, T.encodeUtf8 s)]
      Array a -> traverse (\case String s -> Right (name k, T.encodeUtf8 s); _ -> Left "header values must be strings") (V.toList a)
      _ -> Left "header values must be strings or arrays of strings"
    name = CI.mk . T.encodeUtf8 . Key.toText

-- | The WAI request Warp would hand upstream: raw path, path segments, raw query string (with the '?').
toWai :: Spec -> Wai.Request
toWai Spec{spMethod, spUrl, spHeaders} =
  Wai.defaultRequest
    { Wai.requestMethod = spMethod
    , Wai.rawPathInfo = path
    , Wai.pathInfo = HTTP.decodePathSegments path
    , Wai.rawQueryString = if BS.null qs then "" else "?" <> qs
    , Wai.queryString = HTTP.parseQuery qs
    , Wai.requestHeaders = spHeaders
    }
  where
    (path, rest) = BS8.break (== '?') spUrl
    qs = BS.drop 1 rest

errorValue :: AppConfig -> Error -> Value
errorValue conf err =
  object
    [ "ok" .= False
    , "status" .= HTTP.statusCode (status err)
    , "error" .= (JSON.decode (errorPayload (configClientErrorVerbosity conf) err) :: Maybe Value)
    ]

-- | Plan one request. 'Left' is an upstream error (or a malformed spec) rendered as JSON.
planRequest :: AppConfig -> SchemaCache -> Maybe Supplementary -> Value -> Value
planRequest conf sCache supp specJson = case parseSpec specJson of
  Left e -> object ["ok" .= False, "status" .= (0 :: Int), "error" .= object ["code" .= ("PLANNER_BAD_REQUEST" :: Text), "message" .= e]]
  Right spec ->
    let req = toWai spec
        prefs = userPreferences conf req
    in  case userApiRequest conf prefs req (spBody spec) of
          Left e -> errorValue conf (ApiRequestErr e)
          Right apiReq -> case actionPlan (iAction apiReq) conf apiReq sCache of
            Left e -> errorValue conf e
            Right plan -> case summarize apiReq plan of
              Object o -> Object (o <> KM.fromList (planShape sCache supp apiReq plan))
              other -> other
