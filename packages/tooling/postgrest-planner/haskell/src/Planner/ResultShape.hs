{-# LANGUAGE LambdaCase #-}
{-# LANGUAGE NamedFieldPuns #-}

-- | The result shape of a plan: what the printer needs to type a response.
--
-- 'planShape' adds @form@, @shape@ and @degraded@ to the summary of a plan. @shape.fields@ describes the
-- root relation of reads and of mutations that return the representation: one entry per output column
-- with its name, normalised type, nullability and provenance.
--
-- A select item is evaluated the way @pgFmtSelectItem@ emits it (upstream @Query/SqlFragment.hs@):
-- expression (column, JSON path, representation) -> field cast -> aggregate -> aggregate cast. Names
-- follow upstream @addAliases@ (@Plan.hs@): alias, else the aggregate's name, else the last JSON key
-- (already set as the alias upstream), else the field name.
--
-- Not shaped yet: embeds and spreads (@shape@ has no @embeds@ and the plan is marked @embeds-unshaped@),
-- RPC rows (@shape@ is @null@, the plan is marked @rpc-shape@), filters.
module Planner.ResultShape
  ( planShape
  ) where

import Data.Aeson (Value (..), object, (.=))
import Data.Aeson.Types (Pair)
import qualified Data.HashMap.Strict as HM
import qualified Data.HashMap.Strict.InsOrd as HMI
import Data.List (nub)
import Data.Maybe (fromMaybe, isNothing)
import Data.Text (Text)
import qualified Data.Text as T
import Data.Tree (Tree (..))
import Text.Read (readMaybe)

import PostgREST.ApiRequest (ApiRequest (..))
import PostgREST.ApiRequest.Preferences (PreferRepresentation (..), Preferences (..))
import PostgREST.ApiRequest.QueryParams (QueryParams (..))
import PostgREST.ApiRequest.Types (AggregateFunction (..), JsonOperand (..), JsonOperation (..), SelectItem (..))
import PostgREST.Plan (ActionPlan (..), CrudPlan (..), DbActionPlan (..))
import PostgREST.Plan.CallPlan (CallPlan (..))
import qualified PostgREST.Plan.ReadPlan as RP
import PostgREST.Plan.Types (CoercibleField (..), CoercibleSelectField (..))
import PostgREST.SchemaCache (SchemaCache (..))
import PostgREST.SchemaCache.Identifiers (QualifiedIdentifier (..))
import PostgREST.SchemaCache.Routine (funcReturnsSingleComposite)
import PostgREST.SchemaCache.Table (Column (..), Table (..))

import Planner.PgType (aggregateType, normalizeType)
import Planner.Supplementary (SuppFunction (..), SuppReturn (..), Supplementary, findComputedField, orderColumns)

-- | @form@, @shape@ and @degraded@ for a plan. Plans that return no rows of a relation (inspection,
-- relation/routine info, mutations without a representation) have @shape: null@.
planShape :: SchemaCache -> Maybe Supplementary -> ApiRequest -> ActionPlan -> [Pair]
planShape sc supp apiReq = \case
  Db (DbCrud _ crud) -> crudShape crud
  _ -> result Nothing Nothing []
  where
    ctx = Ctx (dbTables sc) supp

    crudShape = \case
      WrappedReadPlan{wrReadPlan, crudQi} -> rowset crudQi wrReadPlan
      MutateReadPlan{mrReadPlan, crudQi}
        | preferRepresentation (iPreferences apiReq) == Just Full -> rowset crudQi mrReadPlan
        | otherwise -> result (Just "none") Nothing []
      CallReadPlan{crCallPlan = FunctionCall{funCScalar, funCSetOfScalar}, crProc}
        | funCScalar -> rpc "single-scalar"
        | funCSetOfScalar -> rpc "setof-scalar"
        | funcReturnsSingleComposite crProc -> rpc "single-composite"
        | otherwise -> rpc "rowset"

    rowset rel (Node rp kids) =
      let (fields, notes) = resolveSelect ctx rel (RP.select rp)
          shape = object ["relation" .= qiJSON rel, "fields" .= (fieldJSON <$> fields)]
          -- Upstream expands a @*@ next to an aggregate itself, in the order of the schema cache.
          starNotes = ["column-order:" <> qualified rel | requestsStar, not (columnOrderKnown ctx rel)]
      in  result (Just "rowset") (Just shape) (notes <> starNotes <> ["embeds-unshaped" | not (null kids)])

    requestsStar = any isBareStar (qsSelect (iQueryParams apiReq))
    isBareStar = \case
      Node SelectField{selField = ("*", []), selAggregateFunction = Nothing} _ -> True
      _ -> False

    -- P2 hook: the row shape of an RPC comes from its return type (supplementary @functions@).
    rpc form = result (Just form) Nothing ["rpc-shape"]

    result :: Maybe Text -> Maybe Value -> [Text] -> [Pair]
    result form shape notes = ["form" .= form, "shape" .= shape, "degraded" .= nub notes]

data Ctx = Ctx
  { cxTables :: HM.HashMap QualifiedIdentifier Table
  , cxSupp :: Maybe Supplementary
  }

-- | One output column.
data Field = Field
  { fName :: Text
  , fType :: Maybe Text
  , fBaseType :: Maybe Text
  -- ^ The base type of a domain, when it differs from 'fType'.
  , fNullable :: Bool
  , fProvenance :: Value
  }

fieldJSON :: Field -> Value
fieldJSON Field{fName, fType, fBaseType, fNullable, fProvenance} =
  object $
    [ "name" .= fName
    , "pgType" .= fType
    , "nullable" .= fNullable
    , "provenance" .= fProvenance
    ]
      <> [("baseType" .= b) | Just b <- [fBaseType]]

-- | The value of a select item before its output name is attached.
data Expr = Expr
  { eType :: Maybe Text
  , eBase :: Maybe Text
  , eNullable :: Bool
  , eProv :: Value
  }

resolveSelect :: Ctx -> QualifiedIdentifier -> [CoercibleSelectField] -> ([Field], [Text])
resolveSelect ctx rel sels = (concat fs, concat ns)
  where
    (fs, ns) = unzip (map (resolveOne ctx rel) sels)

resolveOne :: Ctx -> QualifiedIdentifier -> CoercibleSelectField -> ([Field], [Text])
resolveOne ctx rel CoercibleSelectField{csField = cf, csAggFunction = agg, csAggCast = aggCast, csCast = cast, csAlias = alias}
  | isStar && isNothing agg = expandStar ctx rel
  | otherwise = ([Field name (eType final) (eBase final) (eNullable final) (eProv final)], notes)
  where
    isStar = cfName cf == "*" && null (cfJsonPath cf)
    name = fromMaybe (maybe (cfName cf) aggName agg) alias

    (start, notes)
      | isStar = (Expr Nothing Nothing False Null, []) -- count(*): nothing is read
      | otherwise = baseExpr ctx rel cf

    final =
      applyCast aggCast
        . maybe id applyAggregate agg
        . applyCast cast
        . maybe id applyRepresentation (cfTransform cf)
        . applyJsonPath (cfJsonPath cf)
        $ start

aggName :: AggregateFunction -> Text
aggName = T.toLower . T.pack . show

-- | Whether the column order of a relation is known (or there is nothing to order).
columnOrderKnown :: Ctx -> QualifiedIdentifier -> Bool
columnOrderKnown Ctx{cxTables, cxSupp} rel = case HM.lookup rel cxTables of
  Nothing -> True
  Just table -> snd (orderColumns cxSupp rel (HMI.keys (tableColumns table)))

-- | An unexpanded @*@ (upstream only expands it next to aggregates or data representations): every
-- physical column in @attnum@ order. Computed fields are not columns, so they are not part of it.
expandStar :: Ctx -> QualifiedIdentifier -> ([Field], [Text])
expandStar Ctx{cxTables, cxSupp} rel = case HM.lookup rel cxTables of
  Nothing -> ([Field "*" Nothing Nothing True (unresolved ("unknown relation " <> qualified rel))], [])
  Just table ->
    let dumpOrder = HMI.keys (tableColumns table)
        (ordered, known) = orderColumns cxSupp rel dumpOrder
        columns = [col | n <- ordered, Just col <- [HMI.lookup n (tableColumns table)]]
    in  (columnField rel <$> columns, ["column-order:" <> qualified rel | not known])

columnField :: QualifiedIdentifier -> Column -> Field
columnField rel col = Field (colName col) (eType e) (eBase e) (eNullable e) (eProv e)
  where
    e = columnExpr rel col

columnExpr :: QualifiedIdentifier -> Column -> Expr
columnExpr rel col = Expr (Just ty) base (colNullable col) prov
  where
    ty = normalizeType (colNominalType col)
    base = let b = normalizeType (colType col) in if b == ty then Nothing else Just b
    prov = object ["kind" .= str "plain", "source" .= object ["schema" .= qiSchema rel, "relation" .= qiName rel, "column" .= colName col]]

-- | A named field of the relation: a column, or a computed field (a function over the row type).
baseExpr :: Ctx -> QualifiedIdentifier -> CoercibleField -> (Expr, [Text])
baseExpr Ctx{cxTables, cxSupp} rel CoercibleField{cfName = name} =
  case HM.lookup rel cxTables of
    Nothing -> bad ("unknown relation " <> qualified rel) []
    Just table -> case HMI.lookup name (tableColumns table) of
      Just col -> (columnExpr rel col, [])
      Nothing -> case cxSupp of
        Nothing -> bad (noField <> " (no supplementary catalog: computed fields are unknown)") ["computed-field:" <> qualified rel <> "." <> name]
        Just supp -> case findComputedField supp rel name of
          Nothing -> bad noField []
          Just SuppFunction{sfSchema, sfName, sfReturns = SuppReturn{srSetof, srType}}
            | srSetof -> bad ("function " <> sfSchema <> "." <> sfName <> " returns a set") []
            | otherwise ->
                ( Expr
                    (Just (normalizeType srType))
                    Nothing
                    True
                    ( object
                        [ "kind" .= str "computed"
                        , "function" .= object ["schema" .= sfSchema, "name" .= sfName]
                        , "relation" .= qiJSON rel
                        ]
                    )
                , []
                )
  where
    noField = "no column or computed field " <> name <> " on " <> qualified rel
    bad reason notes = (Expr Nothing Nothing True (unresolved reason), notes)

unresolved :: Text -> Value
unresolved reason = object ["kind" .= str "unresolved", "reason" .= reason]

-- | @->@ keeps json/jsonb (anything else goes through @to_jsonb@), @->>@ is text. A JSON path is
-- nullable whatever it reads: the key or index may be absent.
applyJsonPath :: [JsonOperation] -> Expr -> Expr
applyJsonPath [] e = e
applyJsonPath path e =
  Expr
    (Just resultType)
    Nothing
    True
    (object ["kind" .= str "jsonPath", "of" .= eProv e, "path" .= (step <$> path)])
  where
    resultType = case reverse path of
      J2Arrow{} : _ -> "text"
      _ | eType e == Just "json" -> "json"
      _ -> "jsonb"
    step = \case
      JArrow o -> operand "->" o
      J2Arrow o -> operand "->>" o
    operand op = \case
      JKey k -> object ["op" .= (op :: Text), "key" .= k]
      -- The parser keeps the sign of an index (@->+1@).
      JIdx i -> object ["op" .= op, "index" .= maybe (String i) (Number . fromIntegral) (readMaybe (T.unpack (fromMaybe i (T.stripPrefix "+" i))) :: Maybe Int)]

-- | A data representation maps the column to the output format (json). Upstream does not say what the
-- mapping function returns, so the value is nullable json. (Untested: the fixture has no representations.)
applyRepresentation :: Text -> Expr -> Expr
applyRepresentation fn e =
  Expr (Just "json") Nothing True (object ["kind" .= str "representation", "of" .= eProv e, "function" .= fn])

applyCast :: Maybe Text -> Expr -> Expr
applyCast Nothing e = e
applyCast (Just c) e =
  Expr (Just ty) Nothing (eNullable e) (object ["kind" .= str "cast", "of" .= eProv e, "to" .= ty])
  where
    ty = normalizeType c

-- | @count@ is @int8@ and never null; every other aggregate is null over an empty group.
applyAggregate :: AggregateFunction -> Expr -> Expr
applyAggregate fn e =
  Expr
    (case fn of Count -> Just "int8"; _ -> aggregateType fn <$> eType e)
    Nothing
    (case fn of Count -> False; _ -> True)
    (object ["kind" .= str "aggregate", "function" .= aggName fn, "of" .= eProv e])

qiJSON :: QualifiedIdentifier -> Value
qiJSON (QualifiedIdentifier s n) = object ["schema" .= s, "name" .= n]

qualified :: QualifiedIdentifier -> Text
qualified (QualifiedIdentifier s n) = s <> "." <> n

str :: Text -> Text
str = id
