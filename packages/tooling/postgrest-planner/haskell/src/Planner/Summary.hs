{-# LANGUAGE LambdaCase #-}
{-# LANGUAGE NamedFieldPuns #-}

-- | Reduces an upstream 'ActionPlan' to a small JSON description.
--
-- Only exported upstream types are inspected (ActionPlan, CrudPlan, ReadPlan, MutatePlan, CallPlan,
-- Routine, Relationship), nothing is patched. The raw @Show@ of the read plan tree is attached under
-- @debug@ so the full plan can be eyeballed while the typed summary stays small.
module Planner.Summary
  ( summarize
  ) where

import Data.Aeson (Value, object, (.=))
import qualified Data.Aeson.Key as Key
import qualified Data.HashMap.Strict as HM
import Data.Maybe (fromMaybe, isJust)
import qualified Data.Set as Set
import Data.Text (Text)
import qualified Data.Text.Encoding as T
import Data.Tree (Tree (..))
import qualified Hasql.Transaction.Sessions as SQL

import PostgREST.ApiRequest (ApiRequest (..))
import PostgREST.ApiRequest.Preferences (PreferResolution (..))
import PostgREST.ApiRequest.Types (Mutation (..))
import PostgREST.MediaType (MediaType, toMime)
import PostgREST.Plan
  ( ActionPlan (..)
  , CrudPlan (..)
  , DbActionPlan (..)
  , InfoPlan (..)
  , InspectPlan (..)
  , legacyWarnings
  )
import PostgREST.Plan.CallPlan (CallArgs (..), CallParams (..), CallPlan (..))
import qualified PostgREST.Plan.MutatePlan as MP
import qualified PostgREST.Plan.ReadPlan as RP
import PostgREST.Plan.Types
  ( CoercibleField (..)
  , CoercibleSelectField (..)
  , RelJsonEmbedMode (..)
  , RelSelectField (..)
  )
import PostgREST.SchemaCache.Identifiers (QualifiedIdentifier (..))
import PostgREST.SchemaCache.Relationship (Cardinality (..), Junction (..), Relationship (..), relIsToOne)
import PostgREST.SchemaCache.Routine
  ( PgType (..)
  , RetType (..)
  , Routine (..)
  , RoutineParam (..)
  )

summarize :: ApiRequest -> ActionPlan -> Value
summarize apiReq plan =
  object $
    ["ok" .= True]
      <> body
      <> ["warnings" .= [object ["relName" .= n, "alias" .= a] | (n, a) <- legacyWarnings plan]]
  where
    payloadKeys = Set.toList (iColumns apiReq)
    body = case plan of
      Db (DbCrud isExplain crud) -> crudSummary payloadKeys isExplain crud
      Db (MayUseDb InspectPlan{ipMedia, ipSchema}) ->
        ["action" .= str "inspect", "schema" .= ipSchema, "media" .= mime ipMedia]
      NoDb (RelInfoPlan qi) -> ["action" .= str "relationInfo", "target" .= qiJSON qi]
      NoDb (RoutineInfoPlan r) -> ["action" .= str "routineInfo", "routine" .= routineJSON r]
      NoDb SchemaInfoPlan -> ["action" .= str "schemaInfo"]

str :: Text -> Text
str = id

crudSummary :: [Text] -> Bool -> CrudPlan -> [(Key.Key, Value)]
crudSummary payloadKeys isExplain = \case
  WrappedReadPlan{wrReadPlan, pTxMode, pMedia, wrHdrsOnly, crudQi} ->
    ["action" .= str (if wrHdrsOnly then "head" else "read")]
      <> common crudQi pTxMode pMedia
      <> readTree wrReadPlan
  MutateReadPlan{mrReadPlan, mrMutatePlan, pTxMode, pMedia, mrMutation, crudQi} ->
    ["action" .= mutationName mrMutation]
      <> common crudQi pTxMode pMedia
      <> ["mutation" .= mutateJSON mrMutatePlan]
      <> readTree mrReadPlan
  CallReadPlan{crReadPlan, crCallPlan, pTxMode, pMedia, crProc, crQi} ->
    ["action" .= str "rpc"]
      <> common crQi pTxMode pMedia
      <> ["routine" .= routineJSON crProc, "call" .= callJSON crCallPlan, "payloadKeys" .= payloadKeys]
      <> readTree crReadPlan
  where
    common qi mode media =
      [ "target" .= qiJSON qi
      , "txMode" .= (case mode of SQL.Read -> str "read"; SQL.Write -> str "write")
      , "media" .= mime media
      , "explain" .= isExplain
      ]
    readTree t = ["select" .= rootSelect t, "embeds" .= embedsOf t, "debug" .= show t]

mutationName :: Mutation -> Text
mutationName = \case
  MutationCreate -> "insert"
  MutationDelete -> "delete"
  MutationSingleUpsert -> "upsert"
  MutationUpdate -> "update"

mime :: MediaType -> Text
mime = T.decodeUtf8Lenient . toMime

qiJSON :: QualifiedIdentifier -> Value
qiJSON (QualifiedIdentifier s n) = object ["schema" .= s, "name" .= n]

-- Read plan ---------------------------------------------------------------------------------------

rootSelect :: RP.ReadPlanTree -> [Value]
rootSelect (Node rp _) = selectJSON <$> RP.select rp

selectJSON :: CoercibleSelectField -> Value
selectJSON CoercibleSelectField{csField, csAggFunction, csAggCast, csCast, csAlias} =
  object
    [ "name" .= cfName csField
    , "alias" .= csAlias
    , "outputName" .= fromMaybe (cfName csField) csAlias
    , "type" .= cfIRType csField
    , "jsonPath" .= (if null (cfJsonPath csField) then Nothing else Just (show (cfJsonPath csField)))
    , "aggregate" .= (show <$> csAggFunction)
    , "aggregateCast" .= csAggCast
    , "cast" .= csCast
    ]

-- | The embeds of a read plan node, in select order, with cardinality taken from the relationship
-- upstream resolved (not from the name we typed).
embedsOf :: RP.ReadPlanTree -> [Value]
embedsOf (Node parent kids) = embedJSON <$> kids
  where
    embedMode name =
      case [m | JsonEmbed{rsSelName, rsEmbedMode = m} <- RP.relSelect parent, rsSelName == name] of
        (JsonObject : _) -> Just ("object" :: Text)
        (JsonArray : _) -> Just "array"
        [] -> Nothing
    embedJSON k@(Node rp _) =
      let name = RP.relName rp
          outName = fromMaybe name (RP.relAlias rp)
      in  object
            [ "name" .= name
            , "alias" .= RP.relAlias rp
            , "outputName" .= outName
            , "target" .= qiJSON (RP.from rp)
            , "relationship" .= (relationshipJSON <$> RP.relToParent rp)
            , "toOne" .= (relIsToOne <$> RP.relToParent rp)
            , "jsonMode" .= (case RP.relSpread rp of Just _ -> Just "spread"; Nothing -> embedMode outName)
            , "spread" .= isJust (RP.relSpread rp)
            , "hint" .= RP.relHint rp
            , "joinType" .= (show <$> RP.relJoinType rp)
            , "select" .= (selectJSON <$> RP.select rp)
            , "embeds" .= embedsOf k
            ]

relationshipJSON :: Relationship -> Value
relationshipJSON = \case
  Relationship{relTable, relForeignTable, relCardinality, relIsSelf} ->
    object $
      [ "kind" .= cardKind relCardinality
      , "table" .= qiJSON relTable
      , "foreignTable" .= qiJSON relForeignTable
      , "isSelf" .= relIsSelf
      ]
        <> cardDetail relCardinality
  ComputedRelationship{relFunction, relTable, relForeignTable, relToOne} ->
    object
      [ "kind" .= str "computed"
      , "function" .= qiJSON relFunction
      , "table" .= qiJSON relTable
      , "foreignTable" .= qiJSON relForeignTable
      , "toOne" .= relToOne
      ]
  where
    cardKind = \case
      O2M{} -> str "o2m"
      M2O{} -> "m2o"
      O2O{} -> "o2o"
      M2M{} -> "m2m"
    cardDetail = \case
      O2M{relCons, relColumns} -> ["constraint" .= relCons, "columns" .= relColumns]
      M2O{relCons, relColumns} -> ["constraint" .= relCons, "columns" .= relColumns]
      O2O{relCons, relColumns, isParent} -> ["constraint" .= relCons, "columns" .= relColumns, "isParent" .= isParent]
      M2M Junction{junTable, junConstraint1, junConstraint2} ->
        ["junction" .= qiJSON junTable, "constraints" .= [junConstraint1, junConstraint2]]

-- Mutations ---------------------------------------------------------------------------------------

mutateJSON :: MP.MutatePlan -> Value
mutateJSON = \case
  MP.Insert{MP.in_, MP.insCols, MP.onConflict, MP.returning, MP.applyDefs} ->
    object
      [ "kind" .= str "insert"
      , "into" .= qiJSON in_
      , "columns" .= (cfName <$> insCols)
      , "onConflict" .= ((\(res, cols) -> object ["resolution" .= resName res, "columns" .= cols]) <$> onConflict)
      , "returning" .= returning
      , "applyDefaults" .= applyDefs
      ]
  MP.Update{MP.in_, MP.updCols, MP.returning, MP.applyDefs} ->
    object
      [ "kind" .= str "update"
      , "into" .= qiJSON in_
      , "columns" .= (cfName <$> updCols)
      , "returning" .= returning
      , "applyDefaults" .= applyDefs
      ]
  MP.Delete{MP.in_, MP.returning} ->
    object ["kind" .= str "delete", "from" .= qiJSON in_, "returning" .= returning]
  where
    resName :: PreferResolution -> Text
    resName MergeDuplicates = "merge-duplicates"
    resName IgnoreDuplicates = "ignore-duplicates"

-- Routines ----------------------------------------------------------------------------------------

routineJSON :: Routine -> Value
routineJSON Function{pdSchema, pdName, pdParams, pdReturnType, pdVolatility, pdHasVariadic} =
  object
    [ "schema" .= pdSchema
    , "name" .= pdName
    , "params" .= (paramJSON <$> pdParams)
    , "returnType" .= retJSON pdReturnType
    , "volatility" .= show pdVolatility
    , "hasVariadic" .= pdHasVariadic
    ]
  where
    paramJSON RoutineParam{ppName, ppType, ppReq, ppVar} =
      object ["name" .= ppName, "type" .= ppType, "required" .= ppReq, "variadic" .= ppVar]
    retJSON rt =
      let (multiplicity, pg) = case rt of Single p -> (str "single", p); SetOf p -> ("setof", p)
          (kind, qi, domainAlias) = case pg of
            Scalar q -> (str "scalar", q, Nothing)
            Composite q d -> ("composite", q, Just d)
      in  object
            [ "multiplicity" .= multiplicity
            , "kind" .= kind
            , "type" .= qiJSON qi
            , "isDomainAlias" .= domainAlias
            ]

callJSON :: CallPlan -> Value
callJSON FunctionCall{funCQi, funCParams, funCArgs, funCScalar, funCSetOfScalar, funCFilterFields, funCReturning} =
  object
    [ "function" .= qiJSON funCQi
    , "params" .= (case funCParams of
        KeyParams ps -> object ["style" .= str "named", "names" .= (ppName <$> ps)]
        OnePosParam p -> object ["style" .= str "single-positional", "names" .= [ppName p]])
    , "args" .= (case funCArgs of
        DirectArgs m -> object ["source" .= str "query-string", "names" .= HM.keys m]
        JsonArgs b -> object ["source" .= str "json-body", "hasBody" .= isJust b])
    , "returnsScalar" .= funCScalar
    , "returnsSetOfScalar" .= funCSetOfScalar
    , "filterFields" .= Set.toList funCFilterFields
    , "returning" .= Set.toList funCReturning
    ]
