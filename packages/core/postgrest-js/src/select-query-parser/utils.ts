import { FieldNode, Node, SpreadNode } from './parser/ast'
import {
  AggregateFunctions,
  ContainsNull,
  GenericRelationship,
  GenericSchema,
  GenericTable,
  IsNonEmptyArray,
  TablesAndViews,
  UnionToArray,
} from './types'

export type SelectQueryError<Message extends string> = { error: true } & Message

export type ProcessedNodeResult = Record<string, unknown> | SelectQueryError<string>

type RequireHintingSelectQueryError<
  DistantName extends string,
  RelationName extends string
> = SelectQueryError<`Could not embed because more than one relationship was found for '${DistantName}' and '${RelationName}' you need to hint the column with ${DistantName}!<columnName> ?`>

export type GetFieldNodeResultName<Field extends FieldNode> = Field['alias'] extends string
  ? Field['alias']
  : Field['aggregateFunction'] extends AggregateFunctions
  ? Field['aggregateFunction']
  : Field['name']

type FilterRelationNodes<Nodes extends Node[]> = UnionToArray<
  {
    [K in keyof Nodes]: Nodes[K] extends SpreadNode
      ? Nodes[K]['target']
      : Nodes[K] extends FieldNode
      ? IsNonEmptyArray<Nodes[K]['children']> extends true
        ? Nodes[K]
        : never
      : never
  }[number]
>

export type ResolveRelationships<
  Schema extends GenericSchema,
  RelationName extends string,
  Relationships extends GenericRelationship[],
  Nodes extends FieldNode[]
> = UnionToArray<{
  [K in keyof Nodes]: ResolveRelationship<
    Schema,
    Relationships,
    Nodes[K],
    RelationName
  > extends infer Relation
    ? Relation extends {
        relation: {
          referencedRelation: any
          foreignKeyName: any
          match: any
        }
        from: any
      }
      ? {
          referencedTable: Relation['relation']['referencedRelation']
          fkName: Relation['relation']['foreignKeyName']
          from: Relation['from']
          match: Relation['relation']['match']
          fieldName: GetFieldNodeResultName<Nodes[K]>
        }
      : never
    : never
}>[0]

/**
 * Checks if a relation is implicitly referenced twice, requiring disambiguation
 */
type IsDoubleReference<T, U> = T extends {
  referencedTable: infer RT
  fieldName: infer FN
  match: infer M extends 'col' | 'refrel'
}
  ? U extends { referencedTable: RT; fieldName: FN; match: M }
    ? true
    : false
  : false

/**
 * Compares one element with all other elements in the array to find duplicates
 */
type CheckDuplicates<Arr extends any[], Current> = Arr extends [infer Head, ...infer Tail]
  ? IsDoubleReference<Current, Head> extends true
    ? Head | CheckDuplicates<Tail, Current> // Return the Head if duplicate
    : CheckDuplicates<Tail, Current> // Otherwise, continue checking
  : never

/**
 * Iterates over the elements of the array to find duplicates
 */
type FindDuplicates<Arr extends any[]> = Arr extends [infer Head, ...infer Tail]
  ? CheckDuplicates<Tail, Head> | FindDuplicates<Tail>
  : never

export type CheckDuplicateEmbededReference<
  Schema extends GenericSchema,
  RelationName extends string,
  Relationships extends GenericRelationship[],
  Nodes extends Node[]
> = FilterRelationNodes<Nodes> extends infer RelationsNodes extends FieldNode[]
  ? ResolveRelationships<
      Schema,
      RelationName,
      Relationships,
      RelationsNodes
    > extends infer ResolvedRels
    ? ResolvedRels extends unknown[]
      ? FindDuplicates<ResolvedRels> extends infer Duplicates
        ? Duplicates extends never
          ? false
          : Duplicates extends { fieldName: infer FieldName extends string }
          ? {
              [K in FieldName]: SelectQueryError<`table "${RelationName}" specified more than once use hinting for desambiguation`>
            }
          : false
        : false
      : false
    : false
  : false

/**
 * Returns a boolean representing whether there is a foreign key referencing
 * a given relation.
 */
type HasFKeyToFRel<FRelName, Relationships> = Relationships extends [infer R]
  ? R extends { referencedRelation: FRelName }
    ? true
    : false
  : Relationships extends [infer R, ...infer Rest]
  ? HasFKeyToFRel<FRelName, [R]> extends true
    ? true
    : HasFKeyToFRel<FRelName, Rest>
  : false
/**
 * Checks if there is more than one relation to a given foreign relation name in the Relationships.
 */
type HasMultipleFKeysToFRel<FRelName, Relationships> = Relationships extends [
  infer R,
  ...infer Rest
]
  ? R extends { referencedRelation: FRelName }
    ? HasFKeyToFRel<FRelName, Rest> extends true
      ? true
      : HasMultipleFKeysToFRel<FRelName, Rest>
    : HasMultipleFKeysToFRel<FRelName, Rest>
  : false

type CheckRelationshipError<
  Schema extends GenericSchema,
  Relationships extends GenericRelationship[],
  CurrentTableOrView extends keyof TablesAndViews<Schema>,
  FoundRelation
> = FoundRelation extends SelectQueryError<string>
  ? FoundRelation
  : // If the relation is a reverse relation with no hint (matching by name)
  FoundRelation extends {
      relation: {
        referencedRelation: infer RelatedRelationName extends string
        name: string
      }
      direction: 'reverse'
    }
  ? // We check if there is possible confusion with other relations with this table
    HasMultipleFKeysToFRel<RelatedRelationName, Relationships> extends true
    ? // If there is, postgrest will fail at runtime, and require desambiguation via hinting
      RequireHintingSelectQueryError<
        RelatedRelationName,
        CurrentTableOrView extends string ? CurrentTableOrView : 'unknown'
      >
    : FoundRelation
  : // Same check for forward relationships, but we must gather the relationships from the found relation
  FoundRelation extends {
      relation: {
        referencedRelation: infer RelatedRelationName extends string
        name: string
      }
      direction: 'forward'
      from: infer From extends keyof TablesAndViews<Schema>
    }
  ? HasMultipleFKeysToFRel<
      RelatedRelationName,
      TablesAndViews<Schema>[From]['Relationships']
    > extends true
    ? RequireHintingSelectQueryError<From extends string ? From : 'unknown', RelatedRelationName>
    : FoundRelation
  : FoundRelation

/**
 * Resolves relationships for embedded resources and retrieves the referenced Table
 */
export type ResolveRelationship<
  Schema extends GenericSchema,
  Relationships extends GenericRelationship[],
  Field extends FieldNode,
  CurrentTableOrView extends keyof TablesAndViews<Schema>
> = ResolveReverseRelationship<
  Schema,
  Relationships,
  Field,
  CurrentTableOrView
> extends infer ReverseRelationship
  ? ReverseRelationship extends false
    ? CheckRelationshipError<
        Schema,
        Relationships,
        CurrentTableOrView,
        ResolveForwardRelationship<Schema, Field, CurrentTableOrView>
      >
    : CheckRelationshipError<Schema, Relationships, CurrentTableOrView, ReverseRelationship>
  : never

/**
 * Resolves reverse relationships (from children to parent)
 */
type ResolveReverseRelationship<
  Schema extends GenericSchema,
  Relationships extends GenericRelationship[],
  Field extends FieldNode,
  CurrentTableOrView extends keyof TablesAndViews<Schema>
> = FindFieldMatchingRelationships<Schema, Relationships, Field> extends infer FoundRelation
  ? FoundRelation extends never
    ? false
    : FoundRelation extends { referencedRelation: infer RelatedRelationName extends string }
    ? RelatedRelationName extends keyof TablesAndViews<Schema>
      ? // If the relation was found via hinting we just return it without any more checks
        FoundRelation extends { hint?: string }
        ? {
            referencedTable: TablesAndViews<Schema>[RelatedRelationName]
            relation: FoundRelation
            direction: 'reverse'
            from: CurrentTableOrView
          }
        : // If the relation was found via implicit relation naming, we must ensure there is no conflicting matches
        HasMultipleFKeysToFRel<RelatedRelationName, Relationships> extends true
        ? RequireHintingSelectQueryError<
            RelatedRelationName,
            CurrentTableOrView extends string ? CurrentTableOrView : 'unknown'
          >
        : {
            referencedTable: TablesAndViews<Schema>[RelatedRelationName]
            relation: FoundRelation
            direction: 'reverse'
            from: CurrentTableOrView
          }
      : SelectQueryError<`Relation '${RelatedRelationName}' not found in schema.`>
    : false
  : false

// Utility type to find embeded relationships by all their possibles references
export type FindMatchingRelationships<
  value extends string,
  Relationships extends GenericRelationship[]
> = Relationships extends [infer R, ...infer Rest extends GenericRelationship[]]
  ? R extends { foreignKeyName: value }
    ? R
    : R extends { referencedRelation: value }
    ? R
    : R extends { columns: [value] }
    ? R
    : FindMatchingRelationships<value, Rest>
  : false

export type FindMatchingTableRelationships<
  Schema extends GenericSchema,
  Relationships extends GenericRelationship[],
  value extends string
> = Relationships extends [infer R, ...infer Rest extends GenericRelationship[]]
  ? R extends { referencedRelation: infer ReferencedRelation }
    ? ReferencedRelation extends keyof Schema['Tables']
      ? R extends { foreignKeyName: value }
        ? R & { match: 'fkname' }
        : R extends { referencedRelation: value }
        ? R & { match: 'refrel' }
        : R extends { columns: [value] }
        ? R & { match: 'col' }
        : FindMatchingTableRelationships<Schema, Rest, value>
      : FindMatchingTableRelationships<Schema, Rest, value>
    : false
  : false

export type FindMatchingViewRelationships<
  Schema extends GenericSchema,
  Relationships extends GenericRelationship[],
  value extends string
> = Relationships extends [infer R, ...infer Rest extends GenericRelationship[]]
  ? R extends { referencedRelation: infer ReferencedRelation }
    ? ReferencedRelation extends keyof Schema['Views']
      ? R extends { foreignKeyName: value }
        ? R & { match: 'fkname' }
        : R extends { referencedRelation: value }
        ? R & { match: 'refrel' }
        : R extends { columns: [value] }
        ? R & { match: 'col' }
        : FindMatchingViewRelationships<Schema, Rest, value>
      : FindMatchingViewRelationships<Schema, Rest, value>
    : false
  : false

export type FindMatchingHintTableRelationships<
  Schema extends GenericSchema,
  Relationships extends GenericRelationship[],
  hint extends string,
  name extends string
> = Relationships extends [infer R, ...infer Rest extends GenericRelationship[]]
  ? R extends { referencedRelation: infer ReferencedRelation }
    ? ReferencedRelation extends name
      ? R extends { foreignKeyName: hint }
        ? R & { match: 'fkname' }
        : R extends { referencedRelation: hint }
        ? R & { match: 'refrel' }
        : R extends { columns: [hint] }
        ? R & { match: 'col' }
        : FindMatchingHintTableRelationships<Schema, Rest, hint, name>
      : FindMatchingHintTableRelationships<Schema, Rest, hint, name>
    : false
  : false

export type FindMatchingHintViewRelationships<
  Schema extends GenericSchema,
  Relationships extends GenericRelationship[],
  hint extends string,
  name extends string
> = Relationships extends [infer R, ...infer Rest extends GenericRelationship[]]
  ? R extends { referencedRelation: infer ReferencedRelation }
    ? ReferencedRelation extends name
      ? R extends { foreignKeyName: hint }
        ? R & { match: 'fkname' }
        : R extends { referencedRelation: hint }
        ? R & { match: 'refrel' }
        : R extends { columns: [hint] }
        ? R & { match: 'col' }
        : FindMatchingHintViewRelationships<Schema, Rest, hint, name>
      : FindMatchingHintViewRelationships<Schema, Rest, hint, name>
    : false
  : false

type IsColumnsNullable<
  Table extends Pick<GenericTable, 'Row'>,
  Columns extends (keyof Table['Row'])[]
> = Columns extends [infer Column, ...infer Rest]
  ? Column extends keyof Table['Row']
    ? ContainsNull<Table['Row'][Column]> extends true
      ? true
      : IsColumnsNullable<Table, Rest extends (keyof Table['Row'])[] ? Rest : []>
    : false
  : false

// Check weither or not a 1-1 relation is nullable by checking against the type of the columns
export type IsRelationNullable<
  Table extends GenericTable,
  Relation extends GenericRelationship
> = IsColumnsNullable<Table, Relation['columns']>

type TableForwardRelationships<
  Schema extends GenericSchema,
  TName
> = TName extends keyof TablesAndViews<Schema>
  ? UnionToArray<
      RecursivelyFindRelationships<Schema, TName, keyof TablesAndViews<Schema>>
    > extends infer R extends (GenericRelationship & { from: keyof TablesAndViews<Schema> })[]
    ? R
    : []
  : []

type RecursivelyFindRelationships<
  Schema extends GenericSchema,
  TName,
  Keys extends keyof TablesAndViews<Schema>
> = Keys extends infer K
  ? K extends keyof TablesAndViews<Schema>
    ? FilterRelationships<TablesAndViews<Schema>[K]['Relationships'], TName, K> extends never
      ? RecursivelyFindRelationships<Schema, TName, Exclude<Keys, K>>
      :
          | FilterRelationships<TablesAndViews<Schema>[K]['Relationships'], TName, K>
          | RecursivelyFindRelationships<Schema, TName, Exclude<Keys, K>>
    : false
  : false

type FilterRelationships<R, TName, From> = R extends readonly (infer Rel)[]
  ? Rel extends { referencedRelation: TName }
    ? Rel & { from: From }
    : never
  : never

// Find a relationship from the parent to the childrens
type ResolveForwardRelationship<
  Schema extends GenericSchema,
  Field extends FieldNode,
  CurrentTableOrView extends keyof TablesAndViews<Schema>
> = FindFieldMatchingRelationships<
  Schema,
  TablesAndViews<Schema>[Field['name']]['Relationships'],
  FieldNode & { name: CurrentTableOrView; hint: Field['hint'] }
> extends infer FoundByName extends GenericRelationship
  ? {
      referencedTable: TablesAndViews<Schema>[Field['name']]
      relation: FoundByName
      direction: 'forward'
      from: Field['name']
      type: 'found-by-name'
    }
  : // The Field['name'] can sometimes be a reference to the related foreign key
  // In that case, we can't use the Field['name'] to get back the relations, instead, we will find all relations pointing
  // to our current table or view, and search if we can find a match in it
  FindFieldMatchingRelationships<
      Schema,
      TableForwardRelationships<Schema, CurrentTableOrView>,
      Field
    > extends infer FoundByMatch extends GenericRelationship & {
      from: keyof TablesAndViews<Schema>
    }
  ? {
      referencedTable: TablesAndViews<Schema>[FoundByMatch['from']]
      relation: FoundByMatch
      direction: 'forward'
      from: CurrentTableOrView
      type: 'found-my-match'
    }
  : SelectQueryError<'could not find the relation'>

/**
 * Finds a matching relationship based on the FieldNode's name and optional hint.
 */
export type FindFieldMatchingRelationships<
  Schema extends GenericSchema,
  Relationships extends GenericRelationship[],
  Field extends FieldNode
> = Field extends { hint?: infer Hint extends string }
  ? FindMatchingHintTableRelationships<
      Schema,
      Relationships,
      Hint,
      Field['name']
    > extends infer TableRelationViaHint extends GenericRelationship
    ? TableRelationViaHint & {
        branch: 'found-in-table-via-hint'
        hint: Field['hint']
      }
    : FindMatchingHintViewRelationships<
        Schema,
        Relationships,
        Hint,
        Field['name']
      > extends infer TableViewViaHint extends GenericRelationship
    ? TableViewViaHint & {
        branch: 'found-in-view-via-hint'
        hint: Field['hint']
      }
    : SelectQueryError<'Failed to find matching relation via hint'>
  : FindMatchingTableRelationships<
      Schema,
      Relationships,
      Field['name']
    > extends infer TableRelationViaName extends GenericRelationship
  ? TableRelationViaName & {
      branch: 'found-in-table-via-name'
      name: Field['name']
    }
  : FindMatchingViewRelationships<
      Schema,
      Relationships,
      Field['name']
    > extends infer ViewRelationViaName extends GenericRelationship
  ? ViewRelationViaName & {
      branch: 'found-in-view-via-name'
      name: Field['name']
    }
  : SelectQueryError<'Failed to find matching relation via name'>
