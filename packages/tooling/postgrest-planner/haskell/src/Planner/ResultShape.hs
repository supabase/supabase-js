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
-- @shape.embeds@ lists the embeds of a node in the order PostgREST emits them (after the fields), each with
-- its own @shape@. A to-one embed is nullable unless one of the rules in 'embedEntry' proves a row; a
-- to-one spread merges its fields into the parent with that nullability ORed in, a to-many spread merges
-- arrays. Aggregates inside a to-one spread are hoisted by upstream to the nearest non-spread ancestor
-- (@hoistSpreadAggFunctions@); 'spreadFields' reads them back from that ancestor's @rsSpreadSel@.
--
-- An RPC plan adds @rpc@ (function, volatility from the supplementary catalog, and the @source@ of its rows:
-- a relation, a composite type or the @RETURNS TABLE@ columns). Its rows are function rows: every field is
-- nullable (a function can return rows the table constraints would refuse) and so is every first-level
-- to-one embed, with the reason @function-rows@; the embed keeps @fkProven@ for a printer that can trace the
-- function. Scalar returns have no rows: @shape@ and @source@ are @null@. The rows of a computed relationship
-- are function rows too: its fields and its first-level to-one embeds are nullable with the same reason.
--
-- @filters@ lists the target of every filter of the plan ('filtersOf'): the column it tests, or the embed
-- that @embed=is.null@ tests.
module Planner.ResultShape
  ( planShape
  ) where

import Data.Aeson (Value (..), object, (.=))
import Data.Aeson.Types (Pair)
import Data.Either (isRight)
import qualified Data.HashMap.Strict as HM
import qualified Data.HashMap.Strict.InsOrd as HMI
import Data.List (find, nub)
import Data.Maybe (fromMaybe, isJust, isNothing, listToMaybe)
import Data.Text (Text)
import qualified Data.Text as T
import Data.Tree (Tree (..))
import Text.Read (readMaybe)

import PostgREST.ApiRequest (ApiRequest (..))
import PostgREST.ApiRequest.Preferences (PreferRepresentation (..), Preferences (..))
import PostgREST.ApiRequest.QueryParams (QueryParams (..))
import PostgREST.ApiRequest.Types (AggregateFunction (..), JoinType (..), JsonOperand (..), JsonOperation (..), LogicOperator (..), SelectItem (..))
import PostgREST.Plan (ActionPlan (..), CrudPlan (..), DbActionPlan (..))
import PostgREST.Plan.CallPlan (CallPlan (..))
import qualified PostgREST.Plan.MutatePlan as MP
import qualified PostgREST.Plan.ReadPlan as RP
import PostgREST.Plan.Types (CoercibleField (..), CoercibleFilter (..), CoercibleLogicTree (..), CoercibleSelectField (..), RelSelectField (..), SpreadSelectField (..), SpreadType (..))
import PostgREST.RangeQuery (allRange, hasLimitZero, rangeOffset)
import PostgREST.SchemaCache (SchemaCache (..))
import PostgREST.SchemaCache.Identifiers (QualifiedIdentifier (..))
import PostgREST.SchemaCache.Relationship (Cardinality (..), Junction (..), Relationship (..), relIsToOne)
import PostgREST.SchemaCache.Routine (FuncVolatility (..), PgType (..), RetType (..), Routine (..), RoutineParam (..), RoutineMap, funcReturnsSingleComposite)
import PostgREST.SchemaCache.Table (Column (..), Table (..))

import Planner.PgType (aggregateType, isBuiltinType, normalizeType)
import Planner.Supplementary (SuppFunction (..), SuppReturn (..), Supplementary (..), findComputedField, findRoutine, foreignKeyValidated, orderColumns)

-- | @form@, @shape@, @rpc@, @filters@ and @degraded@ for a plan. Plans that return no rows of a relation
-- (inspection, relation/routine info, mutations without a representation, scalar RPCs) have @shape: null@.
planShape :: SchemaCache -> Maybe Supplementary -> ApiRequest -> ActionPlan -> [Pair]
planShape sc supp apiReq = \case
  Db (DbCrud _ crud) -> crudShape crud
  _ -> result Nothing Nothing [] Nothing ([], [])
  where
    ctx = Ctx (dbTables sc) (dbRoutines sc) supp Nothing
    selectTree = qsSelect (iQueryParams apiReq)

    crudShape = \case
      WrappedReadPlan{wrReadPlan, crudQi} -> rowset False crudQi wrReadPlan []
      MutateReadPlan{mrReadPlan, mrMutatePlan, crudQi}
        | preferRepresentation (iPreferences apiReq) == Just Full -> rowset True crudQi mrReadPlan (mutationWhere mrMutatePlan)
        | otherwise -> result (Just "none") Nothing [] Nothing (filtersOf ctx ctx crudQi (mutationWhere mrMutatePlan) mrReadPlan)
      CallReadPlan{crReadPlan, crCallPlan = FunctionCall{funCScalar, funCSetOfScalar}, crProc}
        | funCScalar -> rpc "single-scalar" crReadPlan crProc
        | funCSetOfScalar -> rpc "setof-scalar" crReadPlan crProc
        | funcReturnsSingleComposite crProc -> rpc "single-composite" crReadPlan crProc
        | otherwise -> rpc "rowset" crReadPlan crProc

    -- The filters of a mutation are @qsFiltersRoot@ followed by one tree per @qsLogic@ entry (@mutatePlan@). That
    -- includes the trees that name an embed (@embed.or=(...)@), resolved against the mutated table: the read
    -- plan carries them on the embed, which is where they are reported.
    mutationWhere mp =
      let logic = qsLogic (iQueryParams apiReq)
          (filters, trees) = splitAt (length (MP.where_ mp) - length logic) (MP.where_ mp)
      in  filters <> [t | ((path, _), t) <- zip logic trees, null path]

    -- @isWrite@: the read plan of a mutation (upstream reads its embeds from the physical tables, under the
    -- statement's snapshot, so a to-one embed can be missing even when its key holds). @rootWhere@: the
    -- filters of the mutation itself, which upstream keeps in the mutate plan.
    rowset isWrite rel tree@(Node rp _) rootWhere =
      let env = Env ctx isWrite
          (fields, notes) = nodeFields ctx selectTree rp rel
          embeds = childEmbeds env (Parent [] [] Nothing selectTree False) Nothing tree
          shape = object ["relation" .= qiJSON rel, "fields" .= (fieldJSON <$> fields), "embeds" .= (emJSON <$> embeds)]
      in  result (Just "rowset") (Just shape) (notes <> concatMap emNotes embeds) Nothing (filtersOf ctx ctx rel rootWhere tree)

    -- The rows of a function come from its return type, not from the relation upstream reads the plan
    -- against (@Plan.hs@ @callReadPlan@ names it @<function schema>.<return type name>@, which is another
    -- table for a composite of a different schema and no table at all for @RETURNS TABLE@).
    rpc form tree@(Node rp _) proc =
      let RpcRows{rrRel, rrRows, rrSource, rrNotes} = rpcRows ctx proc
          info =
            object
              [ "function" .= qiJSON (QualifiedIdentifier (pdSchema proc) (pdName proc))
              , "volatility" .= routineVolatility proc
              , "source" .= rrSource
              ]
          rootCtx = ctx{cxRows = Just rrRows}
          filters = filtersOf rootCtx ctx (fromMaybe (QualifiedIdentifier "pg_catalog" "record") rrRel) [] tree
          notes0 = rrNotes
      in  case rrRel of
            Nothing -> result (Just form) Nothing notes0 (Just info) filters
            Just rel ->
              let env = Env ctx False
                  (fields, notes) = nodeFields rootCtx selectTree rp rel
                  embeds = childEmbeds env (Parent [] [] Nothing selectTree True) Nothing tree
                  upstreamRel = QualifiedIdentifier (pdSchema proc) (qiName rel)
                  mismatch = ["rpc-embed-relation:" <> qualified rel | not (null embeds), upstreamRel /= rel, not (isRecord rel)]
                  shape = object ["relation" .= qiJSON rel, "fields" .= (fieldJSON <$> fields), "embeds" .= (emJSON <$> embeds)]
              in  result (Just form) (Just shape) (notes0 <> notes <> concatMap emNotes embeds <> mismatch) (Just info) filters

    result :: Maybe Text -> Maybe Value -> [Text] -> Maybe Value -> ([Value], [Text]) -> [Pair]
    result form shape notes info (filters, filterNotes) =
      ["form" .= form, "shape" .= shape, "rpc" .= info, "filters" .= filters, "degraded" .= nub (notes <> filterNotes)]

isRecord :: QualifiedIdentifier -> Bool
isRecord = (== QualifiedIdentifier "pg_catalog" "record")

data Ctx = Ctx
  { cxTables :: HM.HashMap QualifiedIdentifier Table
  , cxRoutines :: RoutineMap
  , cxSupp :: Maybe Supplementary
  , cxRows :: Maybe Rows
  -- ^ Set for the root of an RPC plan: where its columns come from. Embeds resolve against their tables.
  }

-- | The rows of a function.
data Rows
  = TableRows
  -- ^ The rows of a table or view: its columns, read as function rows.
  | AttrRows [(Text, Expr)]
  -- ^ The attributes of a composite type or the @OUT@ / @RETURNS TABLE@ columns, in order.
  | NoRows Text
  -- ^ Nothing is known about the columns (scalar return, or the catalog does not describe them).

-- | One output column.
data Field = Field
  { fName :: Text
  , fType :: Maybe Text
  , fBaseType :: Maybe Text
  -- ^ The base type of a domain, when it differs from 'fType'.
  , fNullable :: Bool
  , fProvenance :: Value
  , fRows :: Bool
  -- ^ Read straight from a function row: nullable because of that (reason @function-rows@).
  }

fieldJSON :: Field -> Value
fieldJSON f = object (("name" .= fName f) : valuePairs f)

-- | What a field and a filter target say about the value they read.
valuePairs :: Field -> [Pair]
valuePairs Field{fType, fBaseType, fNullable, fProvenance, fRows} =
  [ "pgType" .= fType
  , "nullable" .= fNullable
  , "provenance" .= fProvenance
  ]
    <> [("baseType" .= b) | Just b <- [fBaseType]]
    <> ["reason" .= str "function-rows" | fRows]

mkField :: Text -> Expr -> Field
mkField name Expr{eType, eBase, eNullable, eProv, eRows} = Field name eType eBase eNullable eProv eRows

-- | The value of a select item before its output name is attached.
data Expr = Expr
  { eType :: Maybe Text
  , eBase :: Maybe Text
  , eNullable :: Bool
  , eProv :: Value
  , eRows :: Bool
  -- ^ A function row's value, not yet changed by a JSON path or an aggregate.
  }

data Env = Env
  { evCtx :: Ctx
  , evWrite :: Bool
  -- ^ The plan is the read plan of a mutation.
  }

-- | Where a node sits: what its children need to name themselves and to know what encloses them.
data Parent = Parent
  { pIdPath :: [Text]
  -- ^ Identity path from the root (alias, else relationship name; spreads use the relationship name).
  , pOutPath :: [Text]
  -- ^ Result path of the parent's own value; a spread adds no segment, its fields land in the grand-parent.
  , pInherited :: Maybe Text
  -- ^ Why an enclosing to-one spread can be null (its values are merged into the parent, so they inherit it).
  , pSelect :: [Tree SelectItem]
  -- ^ The parsed select items below the parent (to tell whether a @*@ was written).
  , pFunctionRows :: Bool
  -- ^ The parent is the root of an RPC plan: its rows come from a function.
  }

-- | Where the entries of a to-one spread start in the @rsSpreadSel@ of the nearest non-spread ancestor.
data Hoist = Hoist
  { hSels :: [SpreadSelectField]
  , hOff :: Int
  }

data Emb = Emb
  { emJSON :: Value
  , emOutputs :: [[Text]]
  , emNotes :: [Text]
  }

-- | The fields of a node that is not a to-one spread, and the notes they raise.
nodeFields :: Ctx -> [Tree SelectItem] -> RP.ReadPlan -> QualifiedIdentifier -> ([Field], [Text])
nodeFields ctx selectTree rp rel = (fields, notes <> starNotes ctx selectTree rel)
  where
    (fields, notes) = resolveSelect ctx rel (RP.select rp)

-- | Upstream expands a @*@ next to an aggregate itself, in the order of the schema cache.
starNotes :: Ctx -> [Tree SelectItem] -> QualifiedIdentifier -> [Text]
starNotes ctx selectTree rel = ["column-order:" <> qualified rel | requestsStar selectTree, not (columnOrderKnown ctx rel)]

requestsStar :: [Tree SelectItem] -> Bool
requestsStar = any isBareStar
  where
    isBareStar = \case
      Node SelectField{selField = ("*", []), selAggregateFunction = Nothing} _ -> True
      _ -> False

-- | The embeds of a node, in the order PostgREST emits them: the entries of its @relSelect@, each paired with
-- the child it describes (matched by @relAggAlias@: @updateNode@ reorders the forest, @relSelect@ follows
-- the reordered one). @myHoist@ is the hoisting context when the node is itself a to-one spread.
childEmbeds :: Env -> Parent -> Maybe Hoist -> ReadPlanTree -> [Emb]
childEmbeds env par myHoist (Node rp kids) = go (maybe 0 hOff myHoist + length (RP.select rp)) (pairKids (RP.relSelect rp) kids)
  where
    go _ [] = []
    go off ((sel, kid) : rest) = embedEntry env par (hoistFor sel off) sel kid : go (off + entryCount sel kid) rest
    hoistFor sel off = case (myHoist, sel) of
      (Just h, Spread{}) -> Just h{hOff = off}
      (Nothing, Spread{rsSpreadSel}) -> Just (Hoist rsSpreadSel 0)
      _ -> Nothing

type ReadPlanTree = Tree RP.ReadPlan

pairKids :: [RelSelectField] -> [ReadPlanTree] -> [(RelSelectField, ReadPlanTree)]
pairKids [] _ = []
pairKids (s : ss) ks = case break ((== rsAggAlias s) . RP.relAggAlias . rootLabel) ks of
  (before, k : after) -> (s, k) : pairKids ss (before <> after)
  _ -> pairKids ss ks

-- | How many entries a @relSelect@ entry adds to the @rsSpreadSel@ of an enclosing spread (a @*@ is one).
entryCount :: RelSelectField -> ReadPlanTree -> Int
entryCount JsonEmbed{} _ = 1
entryCount Spread{} (Node rp kids) = length (RP.select rp) + sum [entryCount s k | (s, k) <- pairKids (RP.relSelect rp) kids]

-- | One embed: how it is joined, whether its value can be null, what it merges or nests, and its own shape.
embedEntry :: Env -> Parent -> Maybe Hoist -> RelSelectField -> ReadPlanTree -> Emb
embedEntry env@Env{evCtx = ctx, evWrite} par hoist sel node@(Node rp kids) = Emb json outputs notes
  where
    rel = RP.from rp
    relationship = RP.relToParent rp
    isSpread = isJust (RP.relSpread rp)
    isToOneSpread = RP.relSpread rp == Just ToOneSpread
    toOne = maybe True relIsToOne relationship
    key = fromMaybe (RP.relName rp) (RP.relAlias rp)
    isEmpty = case sel of JsonEmbed{rsEmptyEmbed} -> rsEmptyEmbed; _ -> False
    -- A computed relationship calls the function directly, which checks only the types of the row it returns,
    -- not the constraints of the table: its columns, and the first-level to-one embeds of its rows, are read
    -- as the rows of a function (nullable, reason @function-rows@), as at the root of an RPC plan.
    computed = maybe False isComputed relationship
    embedCtx = if computed then ctx{cxRows = Just TableRows} else ctx
    -- A computed relationship to a function that returns ONE composite (not @setof@): Postgres always yields a
    -- row, a composite of NULLs when nothing matches, so the embed is never null.
    singleComposite = maybe False (computedReturnsSingleComposite ctx) relationship
    idPath = pIdPath par <> [key]
    outPath = if isSpread then pOutPath par else pOutPath par <> [key]
    joinInner = RP.relJoinType rp == Just JTInner

    -- Nullability of the embed's value (see v3 §5.2 and v5 §5.2). A to-many embed is an array, never null.
    (proof, proofNotes) = maybe (Left "unknown-relationship", []) (relProof ctx) relationship
    -- The embed's own rows can go away: a filter on it, an offset or limit 0. Nested @!inner@: a direct child
    -- joined with INNER JOIN drops the row of this embed when it has no match.
    filtered = not (null (RP.where_ rp)) || (RP.range_ rp /= allRange && (hasLimitZero (RP.range_ rp) || rangeOffset (RP.range_ rp) > 0))
    nestedInner = any ((== Just JTInner) . RP.relJoinType . rootLabel) kids
    (ownNullable, ownReason)
      | not toOne = (False, "array")
      | joinInner = (False, "inner-join")
      | singleComposite, not filtered, not nestedInner = (False, "single-composite")
      | evWrite = (True, "write")
      | pFunctionRows par = (True, "function-rows")
      | Left r <- proof = (True, r)
      | filtered = (True, "filtered")
      | nestedInner = (True, "nested-inner")
      | otherwise = (False, "fk-proven")
    -- Inside a to-one spread that can be null, the values are merged into the parent: they inherit it.
    nullable = ownNullable || isJust (pInherited par)
    reason = if ownNullable then ownReason else maybe ownReason (const "spread-parent") (pInherited par)

    sub = case [s | Node si s <- pSelect par, matchesSelect si rp] of
      (s : _) -> s
      [] -> []
    (fields, fieldNotes)
      | isToOneSpread = spreadFields embedCtx sub rel hoist nullable rp
      | otherwise = nodeFields embedCtx sub rp rel
    children =
      childEmbeds
        env
        Parent
          { pIdPath = idPath
          , pOutPath = outPath
          , pInherited = if isToOneSpread && nullable then Just reason else Nothing
          , pSelect = sub
          , pFunctionRows = computed
          }
        (if isToOneSpread then hoist else Nothing)
        node

    outputs
      | isSpread = [pOutPath par <> [fName f] | f <- fields] <> concatMap emOutputs children
      | isEmpty = []
      | otherwise = [outPath]
    notes = fieldNotes <> proofNotes <> concatMap emNotes children

    json =
      object
        [ "name" .= RP.relName rp
        , "alias" .= RP.relAlias rp
        , "key" .= (if isSpread || isEmpty then Nothing else Just key)
        , "spread" .= isSpread
        , "empty" .= isEmpty
        , "path" .= idPath
        , "outputs" .= outputs
        , "join" .= (if joinInner then "inner" else "left" :: Text)
        , "cardinality" .= (if toOne then "one" else "many" :: Text)
        , "relationship" .= (relationshipJSON <$> relationship)
        , "target" .= targetJSON rel relationship
        , "nullable" .= nullable
        , "reason" .= reason
        , "fkProven" .= isRight proof
        , "shape"
            .= object
              [ "relation" .= qiJSON rel
              , "fields" .= (fieldJSON <$> fields)
              , "embeds" .= (emJSON <$> children)
              ]
        ]

isComputed :: Relationship -> Bool
isComputed = \case
  ComputedRelationship{} -> True
  _ -> False

-- | Whether a computed relationship is a function that returns a single composite value (not @setof@). The
-- relationship names the function and the table of its argument; the dump lists the overloads of a name.
computedReturnsSingleComposite :: Ctx -> Relationship -> Bool
computedReturnsSingleComposite Ctx{cxRoutines} = \case
  ComputedRelationship{relFunction, relTable} ->
    let overloads = HM.lookupDefault [] relFunction cxRoutines
        takesTable r = case pdParams r of
          p : _ -> ppType p == qualified relTable
          [] -> False
    in  case filter takesTable overloads of
          r : _ -> funcReturnsSingleComposite r
          [] -> case overloads of
            [r] -> funcReturnsSingleComposite r
            _ -> False
  _ -> False

-- | Whether a parsed select relation is the one a plan node came from.
matchesSelect :: SelectItem -> RP.ReadPlan -> Bool
matchesSelect si rp = case si of
  SelectRelation{selRelation, selAlias} -> selRelation == RP.relName rp && selAlias == RP.relAlias rp && isNothing (RP.relSpread rp)
  SpreadRelation{selRelation} -> selRelation == RP.relName rp && isJust (RP.relSpread rp)
  _ -> False

-- | The fields a to-one spread merges into its parent. Upstream strips the aggregates of a spread's select
-- (@hoistFromSelectFields@) and applies them in the @rsSpreadSel@ of the nearest non-spread ancestor, so each
-- select item is put back together with the aggregate found at its position there. The values are nullable
-- when the join can be (@widen@), except an aggregate that is never null (@count@).
spreadFields :: Ctx -> [Tree SelectItem] -> QualifiedIdentifier -> Maybe Hoist -> Bool -> RP.ReadPlan -> ([Field], [Text])
spreadFields ctx selectTree rel hoist widen rp = (concat fs, concat ns <> starNotes ctx selectTree rel)
  where
    (fs, ns) = unzip (zipWith one [0 ..] (RP.select rp))
    one :: Int -> CoercibleSelectField -> ([Field], [Text])
    one i cs = case hoisted i of
      Just (f, c) ->
        let (flds, notes) = resolveOne ctx rel cs{csAggFunction = Just f, csAggCast = c}
        in  (flds, notes) -- an aggregate says by itself whether it is null: no widening
      Nothing ->
        let (flds, notes) = resolveOne ctx rel cs
        in  (widenField widen <$> flds, notes)
    hoisted i = do
      Hoist{hSels, hOff} <- hoist
      SpreadSelectField{ssSelAggFunction = Just f, ssSelAggCast = c} <- listToMaybe (drop (hOff + i) hSels)
      Just (f, c)

widenField :: Bool -> Field -> Field
widenField widen f = f{fNullable = fNullable f || widen}

-- | The relationship of an embed and, for a to-one one, whether its row is proven to exist: only a many-to-one
-- (or the owning side of a one-to-one) whose key columns are all NOT NULL, whose key is validated, between two
-- tables. The @Left@ says what is missing. A key whose validity the catalog does not give counts as not proven
-- and is noted, so a missing catalog never silently widens or narrows a type.
relProof :: Ctx -> Relationship -> (Either Text (), [Text])
relProof Ctx{cxTables, cxSupp} = \case
  ComputedRelationship{} -> (Left "computed", [])
  Relationship{relCardinality = card, relTable, relTableIsView, relFTableIsView} -> case card of
    M2O{relCons, relColumns} -> ownKey relTable relTableIsView relFTableIsView relCons relColumns
    O2O{relCons, relColumns, isParent = False} -> ownKey relTable relTableIsView relFTableIsView relCons relColumns
    O2O{} -> (Left "inverse-o2o", [])
    _ -> (Left "to-many", [])
  where
    ownKey origin originIsView targetIsView cons cols
      | originIsView = (Left "view-origin", [])
      | targetIsView = (Left "view-target", [])
      | not (all (notNull origin . fst) cols) = (Left "nullable-fk-column", [])
      | otherwise = case cxSupp >>= \supp -> foreignKeyValidated supp origin cons of
          Just True -> (Right (), [])
          Just False -> (Left "fk-not-validated", [])
          Nothing -> (Left "fk-unknown", ["fk-validation:" <> qualified origin <> "." <> cons])
    notNull origin col = case HM.lookup origin cxTables >>= HMI.lookup col . tableColumns of
      Just c -> not (colNullable c)
      Nothing -> False

relationshipJSON :: Relationship -> Value
relationshipJSON = \case
  ComputedRelationship{relFunction} -> mk "computed" Nothing Nothing [] Nothing (Just relFunction)
  Relationship{relCardinality = card} -> case card of
    M2O{relCons, relColumns} -> mk "m2o" (Just "origin") (Just relCons) relColumns Nothing Nothing
    O2O{relCons, relColumns, isParent} -> mk "o2o" (Just (if isParent then "target" else "origin")) (Just relCons) relColumns Nothing Nothing
    O2M{relCons, relColumns} -> mk "o2m" (Just "target") (Just relCons) relColumns Nothing Nothing
    M2M Junction{junTable, junConstraint1, junConstraint2} ->
      mk "m2m" Nothing Nothing [] (Just (junTable, [junConstraint1, junConstraint2])) Nothing
  where
    mk :: Text -> Maybe Text -> Maybe Text -> [(Text, Text)] -> Maybe (QualifiedIdentifier, [Text]) -> Maybe QualifiedIdentifier -> Value
    mk kind fkSide constraint cols junction function =
      object
        [ "kind" .= kind
        , "fkSide" .= fkSide
        , "constraint" .= constraint
        , "columns" .= [object ["from" .= from, "to" .= to] | (from, to) <- cols]
        , "junction" .= ((\(qi, cs) -> object ["schema" .= qiSchema qi, "name" .= qiName qi, "constraints" .= cs]) <$> junction)
        , "function" .= (qiJSON <$> function)
        ]

-- | The relation the embed reads: the table or view it resolves its fields against, or, for a computed
-- relationship, the function that produces it.
targetJSON :: QualifiedIdentifier -> Maybe Relationship -> Value
targetJSON (QualifiedIdentifier s n) relationship =
  object ["schema" .= s, "name" .= n, "kind" .= kind]
  where
    kind :: Text
    kind = case relationship of
      Just ComputedRelationship{} -> "function"
      Just Relationship{relFTableIsView = True} -> "view"
      _ -> "table"

resolveSelect :: Ctx -> QualifiedIdentifier -> [CoercibleSelectField] -> ([Field], [Text])
resolveSelect ctx rel sels = (concat fs, concat ns)
  where
    (fs, ns) = unzip (map (resolveOne ctx rel) sels)

resolveOne :: Ctx -> QualifiedIdentifier -> CoercibleSelectField -> ([Field], [Text])
resolveOne ctx rel CoercibleSelectField{csField = cf, csAggFunction = agg, csAggCast = aggCast, csCast = cast, csAlias = alias}
  | isStar && isNothing agg && not (cfFullRow cf) = expandStar ctx rel
  | otherwise = ([mkField name final], notes)
  where
    isStar = cfName cf == "*" && null (cfJsonPath cf)
    name = fromMaybe (maybe (cfName cf) aggName agg) alias

    (start, notes)
      | isStar = (Expr Nothing Nothing False Null False, []) -- count(*): nothing is read
      | isNothing agg, legacyCount ctx rel cf = (applyAggregate Count (Expr Nothing Nothing False Null False), [])
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
-- physical column in @attnum@ order. Computed fields are not columns, so they are not part of it. The
-- rows of a function have the columns of what it returns.
expandStar :: Ctx -> QualifiedIdentifier -> ([Field], [Text])
expandStar ctx@Ctx{cxTables, cxSupp, cxRows} rel = case cxRows of
  Just (AttrRows attrs) -> ([mkField n e | (n, e) <- attrs], [])
  Just (NoRows reason) -> ([mkField "*" (unresolvedExpr reason)], [])
  _ -> case HM.lookup rel cxTables of
    Nothing -> ([mkField "*" (unresolvedExpr ("unknown relation " <> qualified rel))], [])
    Just table ->
      let dumpOrder = HMI.keys (tableColumns table)
          (ordered, known) = orderColumns cxSupp rel dumpOrder
          columns = [col | n <- ordered, Just col <- [HMI.lookup n (tableColumns table)]]
      in  (columnField ctx rel <$> columns, ["column-order:" <> qualified rel | not known])

columnField :: Ctx -> QualifiedIdentifier -> Column -> Field
columnField ctx rel col = mkField (colName col) (columnExpr ctx rel col)

-- | A column. Read from the rows of a function it is nullable, whatever the table says: the function may
-- return rows the table constraints would refuse.
columnExpr :: Ctx -> QualifiedIdentifier -> Column -> Expr
columnExpr Ctx{cxRows} rel col = case cxRows of
  Just TableRows -> e{eNullable = True, eRows = True}
  _ -> e
  where
    ty = normalizeType (colNominalType col)
    base = let b = normalizeType (colType col) in if b == ty then Nothing else Just b
    prov = object ["kind" .= str "plain", "source" .= object ["schema" .= qiSchema rel, "relation" .= qiName rel, "column" .= colName col]]
    e = Expr (Just ty) base (colNullable col) prov False

-- | A bare @count@ that names no column and no computed field of a table. Upstream parses it as an ordinary
-- field; Postgres reads @<table>.count@ as the function @count(<table>)@ (attribute notation on a row), which
-- is the @count@ aggregate over the rows, so it is @count()@: @int8@, never null. No other aggregate has this
-- spelling (@sum@ and the like are not functions of a row), and a column or computed field of that name wins.
-- It needs the supplementary catalog to rule a computed field out.
legacyCount :: Ctx -> QualifiedIdentifier -> CoercibleField -> Bool
legacyCount Ctx{cxTables, cxSupp, cxRows} rel CoercibleField{cfName, cfJsonPath} =
  cfName == "count" && null cfJsonPath && rowsAreTable && case (HM.lookup rel cxTables, cxSupp) of
    (Just table, Just supp) -> isNothing (HMI.lookup cfName (tableColumns table)) && isNothing (findComputedField supp rel cfName)
    _ -> False
  where
    rowsAreTable = case cxRows of
      Nothing -> True
      Just TableRows -> True
      _ -> False

-- | A named field of the relation: a column, or a computed field (a function over the row type). The root
-- of an RPC plan reads its columns from the rows of the function.
baseExpr :: Ctx -> QualifiedIdentifier -> CoercibleField -> (Expr, [Text])
baseExpr ctx@Ctx{cxTables, cxSupp, cxRows} rel CoercibleField{cfName = name} = case cxRows of
  Just (AttrRows attrs) -> case lookup name attrs of
    Just e -> (e, [])
    Nothing -> bad ("no attribute " <> name <> " in the rows of the function") []
  Just (NoRows reason) -> bad reason []
  _ -> case HM.lookup rel cxTables of
    Nothing -> bad ("unknown relation " <> qualified rel) []
    Just table -> case HMI.lookup name (tableColumns table) of
      Just col -> (columnExpr ctx rel col, [])
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
                    False
                , []
                )
  where
    noField = "no column or computed field " <> name <> " on " <> qualified rel
    bad reason notes = (unresolvedExpr reason, notes)

unresolvedExpr :: Text -> Expr
unresolvedExpr reason = Expr Nothing Nothing True (unresolved reason) False

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
    (object ["kind" .= str "jsonPath", "of" .= eProv e, "path" .= jsonPathSteps path])
    False
  where
    resultType = case reverse path of
      J2Arrow{} : _ -> "text"
      _ | eType e == Just "json" -> "json"
      _ -> "jsonb"

-- | A JSON path as the plan writes it: each step with its operator and key or index.
jsonPathSteps :: [JsonOperation] -> [Value]
jsonPathSteps = map step
  where
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
  Expr (Just "json") Nothing True (object ["kind" .= str "representation", "of" .= eProv e, "function" .= fn]) False

applyCast :: Maybe Text -> Expr -> Expr
applyCast Nothing e = e
applyCast (Just c) e =
  Expr (Just ty) Nothing nullable (object ["kind" .= str "cast", "of" .= eProv e, "to" .= ty]) (eRows e)
  where
    ty = normalizeType c
    -- A builtin cast keeps non-NULL, but the cast function of any other type (domain, enum, composite,
    -- extension type) can return NULL for a non-NULL value.
    nullable = eNullable e || not (maybe False isBuiltinType (eType e) && isBuiltinType ty)

-- | @count@ is @int8@ and never null; every other aggregate is null over an empty group.
applyAggregate :: AggregateFunction -> Expr -> Expr
applyAggregate fn e =
  Expr
    (case fn of Count -> Just "int8"; _ -> aggregateType fn <$> eType e)
    Nothing
    (case fn of Count -> False; _ -> True)
    (object ["kind" .= str "aggregate", "function" .= aggName fn, "of" .= eProv e])
    False

-- | Where the rows of a function come from.
data RpcRows = RpcRows
  { rrRel :: Maybe QualifiedIdentifier
  -- ^ The relation of the shape; 'Nothing' for a scalar return (no rows, no shape). @pg_catalog.record@ for
  -- @RETURNS TABLE@ / @OUT@ columns.
  , rrRows :: Rows
  , rrSource :: Value
  , rrNotes :: [Text]
  }

-- | The rows of a function, from its return type (the dump) and, for a composite type or @RETURNS TABLE@, the
-- supplementary catalog.
rpcRows :: Ctx -> Routine -> RpcRows
rpcRows Ctx{cxTables, cxSupp} proc = case pdReturnType proc of
  Single (Scalar _) -> scalar
  SetOf (Scalar _) -> scalar
  Single (Composite qi _) -> composite qi
  SetOf (Composite qi _) -> composite qi
  where
    fn = QualifiedIdentifier (pdSchema proc) (pdName proc)
    scalar = RpcRows Nothing (NoRows "the function returns a scalar") Null []
    unknown qi = RpcRows (Just qi) (NoRows ("the columns of " <> qualified qi <> " are unknown")) Null ["rpc-columns:" <> qualified fn]
    composite qi
      | isRecord qi = case cxSupp >>= (`findRoutine` proc) >>= sfOutColumns of
          Just cols ->
            RpcRows
              (Just qi)
              (AttrRows [(n, attribute (object ["kind" .= str "outColumn", "function" .= qiJSON fn, "column" .= n]) t) | (n, t) <- cols])
              (object ["kind" .= str "returnsTable", "columns" .= [object ["name" .= n, "pgType" .= normalizeType t] | (n, t) <- cols]])
              []
          Nothing -> unknown qi
      | Just table <- HM.lookup qi cxTables =
          RpcRows (Just qi) TableRows (object ["kind" .= str "relation", "schema" .= qiSchema qi, "name" .= qiName qi, "view" .= tableIsView table]) []
      | Just attrs <- cxSupp >>= HM.lookup qi . suppComposites =
          RpcRows
            (Just qi)
            (AttrRows [(n, attribute (object ["kind" .= str "compositeAttribute", "type" .= qiJSON qi, "attribute" .= n]) t) | (n, t) <- attrs])
            (object ["kind" .= str "composite", "schema" .= qiSchema qi, "name" .= qiName qi])
            []
      | otherwise = unknown qi
    -- Neither an @OUT@ column nor an attribute carries a constraint, and a function can return anything.
    attribute prov t = Expr (Just (normalizeType t)) Nothing True prov True

-- | @provolatile@ of the function. The dump carries it (it is what upstream picks the transaction mode from).
routineVolatility :: Routine -> Text
routineVolatility proc = case pdVolatility proc of
  Immutable -> "immutable"
  Stable -> "stable"
  Volatile -> "volatile"

-- | The target of every filter of a plan, in the order upstream applies them: for each node of the tree
-- (the root first), its @where_@, which holds the filters and the @or@ / @and@ trees of the query that name
-- the node. @rootWhere@ is the filter of a mutation, which upstream keeps in the mutate plan.
--
-- A filter on a column reports the column (its type, nullability and provenance, as a select item would) and
-- its JSON path. A filter that names an embed (@embed=is.null@, @embed=not.is.null@) reports the embed it
-- tests. A filter that names neither a column nor a selected embed has an unresolved provenance; a filter
-- under an embed that is not selected makes upstream fail the plan (PGRST108), so it never gets here.
filtersOf :: Ctx -> Ctx -> QualifiedIdentifier -> [CoercibleLogicTree] -> ReadPlanTree -> ([Value], [Text])
filtersOf rootCtx ctx rootRel rootWhere tree = (concat vs, concat ns)
  where
    (vs, ns) = unzip (map (treeEntries rootCtx rootRel [] [] []) rootWhere <> walk rootCtx rootRel [] tree)

    walk c rel path (Node rp kids) =
      map (treeEntries c rel path kids []) (RP.where_ rp)
        <> concat [walk (kidCtx k) (RP.from k) (path <> [nodeKey k]) n | n@(Node k _) <- kids]

    -- The columns of a computed relationship are read from the rows of a function.
    kidCtx k
      | maybe False isComputed (RP.relToParent k) = ctx{cxRows = Just TableRows}
      | otherwise = ctx

    nodeKey rp = fromMaybe (RP.relName rp) (RP.relAlias rp)

-- | The filters of a logic tree. @groups@ are the enclosing @and@ / @or@ groups, outermost first.
treeEntries :: Ctx -> QualifiedIdentifier -> [Text] -> [ReadPlanTree] -> [(LogicOperator, Bool)] -> CoercibleLogicTree -> ([Value], [Text])
treeEntries ctx rel embed kids groups = \case
  CoercibleExpr negated op trees ->
    let (vs, ns) = unzip (map (treeEntries ctx rel embed kids (groups <> [(op, negated)])) trees)
    in  (concat vs, concat ns)
  CoercibleStmnt (CoercibleFilterNullEmbed negated aggAlias) ->
    let key = case find ((== aggAlias) . RP.relAggAlias . rootLabel) kids of
          Just (Node rp _) -> fromMaybe (RP.relName rp) (RP.relAlias rp)
          Nothing -> aggAlias
    in  ( [ object
              [ "kind" .= str "embed"
              , "embed" .= embed
              , "column" .= key
              , "tested" .= (embed <> [key])
              , "negated" .= negated
              , "logic" .= logic
              ]
          ]
        , []
        )
  CoercibleStmnt (CoercibleFilter{field = cf}) ->
    let (e, notes) = baseExpr ctx rel cf
    in  ( [ object $
              [ "kind" .= str "column"
              , "embed" .= embed
              , "column" .= cfName cf
              , "jsonPath" .= jsonPathSteps (cfJsonPath cf)
              , "logic" .= logic
              ]
                <> valuePairs (mkField (cfName cf) e)
          ]
        , notes
        )
  where
    logic = [object ["operator" .= (case op of And -> "and"; Or -> "or" :: Text), "negated" .= negated] | (op, negated) <- groups]

qiJSON :: QualifiedIdentifier -> Value
qiJSON (QualifiedIdentifier s n) = object ["schema" .= s, "name" .= n]

qualified :: QualifiedIdentifier -> Text
qualified (QualifiedIdentifier s n) = s <> "." <> n

str :: Text -> Text
str = id
