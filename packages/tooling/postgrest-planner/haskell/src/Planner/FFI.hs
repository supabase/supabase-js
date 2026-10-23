{-# LANGUAGE ForeignFunctionInterface #-}

-- | Reactor entry points. Everything crosses the boundary as JSON in linear memory.
--
-- Buffers handed to the module come from @planner_alloc@ and are owned by the host until the call
-- returns. Every function that returns data returns a pointer to @[u32 little-endian length][bytes]@
-- allocated by the module; the host reads it and releases it with @planner_free@.
module Planner.FFI () where

import Control.Exception (SomeException, evaluate, try)
import Data.Aeson (Value, object, (.=))
import qualified Data.Aeson as JSON
import qualified Data.ByteString as BS
import qualified Data.ByteString.Lazy as LBS
import qualified Data.ByteString.Unsafe as BSU
import qualified Data.HashMap.Strict as HM
import Data.Int (Int32)
import qualified Data.IntMap.Strict as IM
import Data.IORef
import Data.Text (Text)
import qualified Data.Text as T
import qualified Data.Text.Encoding as T
import Data.Version (showVersion)
import Data.Word (Word32, Word8)
import Foreign.Marshal.Alloc (free, mallocBytes)
import Foreign.Marshal.Utils (copyBytes)
import Foreign.Ptr (Ptr, castPtr, plusPtr)
import Foreign.Storable (poke)
import System.IO.Unsafe (unsafePerformIO)
import System.Info (compilerName, compilerVersion)

import PostgREST.Config (AppConfig (..))
import PostgREST.SchemaCache (SchemaCache (..), showSummary)
import PostgREST.Version (prettyVersion)

import Planner.BuildInfo (pgrstCommit, pgrstTag)
import Planner.Config (loadAppConfig)
import Planner.Request (planRequest)
import Planner.SchemaCacheJSON (decodeSchemaCache, encodeSchemaCache)

-- | Bumped whenever an export's signature or a JSON shape changes incompatibly.
abiVersion :: Int
abiVersion = 1

data Loaded = Loaded {ldConfig :: AppConfig, ldCache :: SchemaCache}

{-# NOINLINE registry #-}
registry :: IORef (Int, IM.IntMap Loaded)
registry = unsafePerformIO (newIORef (1, IM.empty))

foreign export ccall planner_alloc :: Word32 -> IO (Ptr Word8)
foreign export ccall planner_free :: Ptr Word8 -> IO ()
foreign export ccall planner_info :: IO (Ptr Word8)
foreign export ccall planner_load :: Ptr Word8 -> Word32 -> Ptr Word8 -> Word32 -> IO (Ptr Word8)
foreign export ccall planner_dump :: Int32 -> IO (Ptr Word8)
foreign export ccall planner_free_cache :: Int32 -> IO ()
foreign export ccall planner_plan :: Int32 -> Ptr Word8 -> Word32 -> IO (Ptr Word8)

planner_alloc :: Word32 -> IO (Ptr Word8)
planner_alloc = mallocBytes . fromIntegral

planner_free :: Ptr Word8 -> IO ()
planner_free = free

-- | Release/commit of the upstream sources this module was built from, plus the ABI version.
planner_info :: IO (Ptr Word8)
planner_info =
  respond . object $
    [ "ok" .= True
    , "abi" .= abiVersion
    , "postgrest" .= object ["version" .= T.decodeUtf8 prettyVersion, "tag" .= pgrstTag, "commit" .= pgrstCommit]
    , "ghc" .= (compilerName <> " " <> showVersion compilerVersion)
    ]

-- | Load config (JSON object of PostgREST config keys) and a @--dump-schema@ document; returns a handle.
planner_load :: Ptr Word8 -> Word32 -> Ptr Word8 -> Word32 -> IO (Ptr Word8)
planner_load cfgP cfgN schemaP schemaN = guarded $ do
  cfgBytes <- BSU.unsafePackCStringLen (castPtr cfgP, fromIntegral cfgN)
  schemaBytes <- BSU.unsafePackCStringLen (castPtr schemaP, fromIntegral schemaN)
  case JSON.eitherDecodeStrict cfgBytes of
    Left e -> pure (failure "PLANNER_BAD_CONFIG" (T.pack e))
    Right cfgJson -> do
      cfgRes <- loadAppConfig cfgJson
      case cfgRes of
        Left e -> pure (failure "PLANNER_BAD_CONFIG" e)
        Right (conf, ignored) ->
          case decodeSchemaCache (LBS.fromStrict schemaBytes) of
            Left e -> pure (failure "PLANNER_BAD_SCHEMA_CACHE" (T.pack e))
            Right sc -> do
              -- Force the (lazily memoized) fuzzy index here so the first error does not pay for it.
              _ <- evaluate (foldr seq () (HM.elems (dbTablesFuzzyIndex sc)))
              h <- atomicModifyIORef' registry $ \(n, m) -> ((n + 1, IM.insert n (Loaded conf sc) m), n)
              pure . object $
                [ "ok" .= True
                , "handle" .= h
                , "summary" .= showSummary sc
                , "schemas" .= configDbSchemas conf
                , "ignoredConfigKeys" .= ignored
                ]

-- | Re-encode the loaded schema cache with upstream's own ToJSON (the @--dump-schema@ encoder).
planner_dump :: Int32 -> IO (Ptr Word8)
planner_dump h = withLoaded h $ \Loaded{ldCache} -> pure (encodeSchemaCache ldCache)

planner_free_cache :: Int32 -> IO ()
planner_free_cache h = atomicModifyIORef' registry $ \(n, m) -> ((n, IM.delete (fromIntegral h) m), ())

-- | Plan one request (JSON spec, see "Planner.Request") against a loaded cache.
planner_plan :: Int32 -> Ptr Word8 -> Word32 -> IO (Ptr Word8)
planner_plan h reqP reqN = withLoaded h $ \Loaded{ldConfig, ldCache} -> do
  reqBytes <- BSU.unsafePackCStringLen (castPtr reqP, fromIntegral reqN)
  pure $ case JSON.eitherDecodeStrict reqBytes of
    Left e -> failure "PLANNER_BAD_REQUEST" (T.pack e)
    Right spec -> planRequest ldConfig ldCache spec

withLoaded :: Int32 -> (Loaded -> IO Value) -> IO (Ptr Word8)
withLoaded h act = guarded $ do
  (_, m) <- readIORef registry
  case IM.lookup (fromIntegral h) m of
    Nothing -> pure (failure "PLANNER_BAD_HANDLE" "no schema cache loaded under that handle")
    Just l -> act l

failure :: Text -> Text -> Value
failure code msg = object ["ok" .= False, "status" .= (0 :: Int), "error" .= object ["code" .= code, "message" .= msg]]

-- | Run an action, serialise its result, and turn any Haskell exception into a JSON failure.
guarded :: IO Value -> IO (Ptr Word8)
guarded act = do
  r <- try (act >>= \v -> let bs = LBS.toStrict (JSON.encode v) in bs `seq` pure bs)
  case r of
    Right bs -> respondBytes bs
    Left e -> respond (failure "PLANNER_EXCEPTION" (T.pack (show (e :: SomeException))))

respond :: Value -> IO (Ptr Word8)
respond = respondBytes . LBS.toStrict . JSON.encode

respondBytes :: BS.ByteString -> IO (Ptr Word8)
respondBytes bs = do
  let n = BS.length bs
  p <- mallocBytes (4 + n)
  poke (castPtr p) (fromIntegral n :: Word32) -- wasm32 is little-endian
  BSU.unsafeUseAsCStringLen bs $ \(src, len) -> copyBytes (p `plusPtr` 4) (castPtr src) len
  pure p
