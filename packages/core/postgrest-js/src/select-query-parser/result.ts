import { GenericTable } from '../types'
import { ContainsNull, GenericRelationship, PostgreSQLTypes } from './types'
import { Ast, ParseQuery } from './parser'
import {
  AggregateFunctions,
  ExtractFirstProperty,
  GenericSchema,
  IsNonEmptyArray,
  Prettify,
  TablesAndViews,
  TypeScriptTypes,
} from './types'
import {
  CheckDuplicateEmbededReference,
  GetFieldNodeResultName,
  IsRelationNullable,
  ResolveRelationship,
  SelectQueryError,
} from './utils'

/**
 * Main entry point for constructing the result type of a PostgREST query.
 *
 * @param Schema - Database schema.
 * @param Row - The type of a row in the current table.
 * @param RelationName - The name of the current table or view.
 * @param Relationships - Relationships of the current table.
 * @param Query - The select query string literal to parse.
 */
export type GetResult<
  Schema extends GenericSchema,
  Row extends Record<string, unknown>,
  RelationName,
  Relationships,
  Query extends string
> = Relationships extends null // For .rpc calls the passed relationships will be null in that case, the result will always be the function return type
  ? ParseQuery<Query> extends infer ParsedQuery extends Ast.Node[]
    ? RPCCallNodes<ParsedQuery, RelationName extends string ? RelationName : 'rpc_call', Row>
    : Row
  : ParseQuery<Query> extends infer ParsedQuery
  ? ParsedQuery extends Ast.Node[]
    ? RelationName extends string
      ? Relationships extends GenericRelationship[]
        ? ProcessNodes<Schema, Row, RelationName, Relationships, ParsedQuery>
        : SelectQueryError<'Invalid Relationships cannot infer result type'>
      : SelectQueryError<'Invalid RelationName cannot infer result type'>
    : ParsedQuery
  : never

/**
 * Processes a single Node from a select chained after a rpc call
 *
 * @param Row - The type of a row in the current table.
 * @param RelationName - The name of the current rpc function
 * @param NodeType - The Node to process.
 */
export type ProcessRPCNode<
  Row extends Record<string, unknown>,
  RelationName extends string,
  NodeType extends Ast.Node
> = NodeType extends Ast.StarNode // If the selection is *
  ? Row
  : NodeType extends Ast.FieldNode
  ? ProcessSimpleField<Row, RelationName, NodeType>
  : SelectQueryError<'Unsupported node type.'>
/**
 * Process select call that can be chained after an rpc call
 */
export type RPCCallNodes<
  Nodes extends Ast.Node[],
  RelationName extends string,
  Row extends Record<string, unknown>,
  Acc extends Record<string, unknown> = {} // Acc is now an object
> = Nodes extends [infer FirstNode extends Ast.Node, ...infer RestNodes extends Ast.Node[]]
  ? ProcessRPCNode<Row, RelationName, FirstNode> extends infer FieldResult
    ? FieldResult extends Record<string, unknown>
      ? RPCCallNodes<RestNodes, RelationName, Row, Acc & FieldResult>
      : FieldResult extends SelectQueryError<infer E>
      ? SelectQueryError<E>
      : SelectQueryError<'Could not retrieve a valid record or error value'>
    : SelectQueryError<'Processing node failed.'>
  : Prettify<Acc>

/**
 * Recursively processes an array of Nodes and accumulates the resulting TypeScript type.
 *
 * @param Schema - Database schema.
 * @param Row - The type of a row in the current table.
 * @param RelationName - The name of the current table or view.
 * @param Relationships - Relationships of the current table.
 * @param Nodes - An array of AST nodes to process.
 * @param Acc - Accumulator for the constructed type.
 */
export type ProcessNodes<
  Schema extends GenericSchema,
  Row extends Record<string, unknown>,
  RelationName extends string,
  Relationships extends GenericRelationship[],
  Nodes extends Ast.Node[],
  Acc extends Record<string, unknown> = {} // Acc is now an object
> = CheckDuplicateEmbededReference<Schema, RelationName, Relationships, Nodes> extends false
  ? Nodes extends [infer FirstNode extends Ast.Node, ...infer RestNodes extends Ast.Node[]]
    ? ProcessNode<Schema, Row, RelationName, Relationships, FirstNode> extends infer FieldResult
      ? FieldResult extends Record<string, unknown>
        ? ProcessNodes<Schema, Row, RelationName, Relationships, RestNodes, Acc & FieldResult>
        : FieldResult extends SelectQueryError<infer E>
        ? SelectQueryError<E>
        : SelectQueryError<'Could not retrieve a valid record or error value'>
      : SelectQueryError<'Processing node failed.'>
    : Prettify<Acc>
  : Prettify<CheckDuplicateEmbededReference<Schema, RelationName, Relationships, Nodes>>

/**
 * Processes a single Node and returns the resulting TypeScript type.
 *
 * @param Schema - Database schema.
 * @param Row - The type of a row in the current table.
 * @param RelationName - The name of the current table or view.
 * @param Relationships - Relationships of the current table.
 * @param NodeType - The Node to process.
 */
export type ProcessNode<
  Schema extends GenericSchema,
  Row extends Record<string, unknown>,
  RelationName extends string,
  Relationships extends GenericRelationship[],
  NodeType extends Ast.Node
> = NodeType extends Ast.StarNode // If the selection is *
  ? Row
  : NodeType extends Ast.SpreadNode // If the selection is a ...spread
  ? ProcessSpreadNode<Schema, Row, RelationName, Relationships, NodeType>
  : NodeType extends Ast.FieldNode
  ? ProcessFieldNode<Schema, Row, RelationName, Relationships, NodeType>
  : SelectQueryError<'Unsupported node type.'>

/**
 * Processes a FieldNode and returns the resulting TypeScript type.
 *
 * @param Schema - Database schema.
 * @param Row - The type of a row in the current table.
 * @param RelationName - The name of the current table or view.
 * @param Relationships - Relationships of the current table.
 * @param Field - The FieldNode to process.
 */
type ProcessFieldNode<
  Schema extends GenericSchema,
  Row extends Record<string, unknown>,
  RelationName extends string,
  Relationships extends GenericRelationship[],
  Field extends Ast.FieldNode
> = Field['children'] extends []
  ? {}
  : IsNonEmptyArray<Field['children']> extends true // Has embedded resource?
  ? ProcessEmbeddedResource<Schema, Relationships, Field, RelationName>
  : ProcessSimpleField<Row, RelationName, Field>

/**
 * Processes a simple field (without embedded resources).
 *
 * @param Row - The type of a row in the current table.
 * @param RelationName - The name of the current table or view.
 * @param Field - The FieldNode to process.
 */
type ProcessSimpleField<
  Row extends Record<string, unknown>,
  RelationName extends string,
  Field extends Ast.FieldNode
> = Field['name'] extends keyof Row | 'count'
  ? Field['aggregateFunction'] extends AggregateFunctions
    ? {
        // An aggregate function will always override the column name id.sum() will become sum
        // except if it has been aliased
        [K in GetFieldNodeResultName<Field>]: Field['castType'] extends PostgreSQLTypes
          ? TypeScriptTypes<Field['castType']>
          : number
      }
    : {
        // Aliases override the property name in the result
        [K in GetFieldNodeResultName<Field>]: Field['castType'] extends PostgreSQLTypes // We apply the detected casted as the result type
          ? TypeScriptTypes<Field['castType']>
          : Row[Field['name']]
      }
  : SelectQueryError<`column '${Field['name']}' does not exist on '${RelationName}'.`>

/**
 * Processes an embedded resource (relation).
 *
 * @param Schema - Database schema.
 * @param Row - The type of a row in the current table.
 * @param RelationName - The name of the current table or view.
 * @param Relationships - Relationships of the current table.
 * @param Field - The FieldNode to process.
 */
export type ProcessEmbeddedResource<
  Schema extends GenericSchema,
  Relationships extends GenericRelationship[],
  Field extends Ast.FieldNode,
  CurrentTableOrView extends keyof TablesAndViews<Schema> & string
> = ResolveRelationship<Schema, Relationships, Field, CurrentTableOrView> extends infer Resolved
  ? Resolved extends {
      referencedTable: Pick<GenericTable, 'Row' | 'Relationships'>
      relation: GenericRelationship & { match: 'refrel' | 'col' | 'fkname' }
      direction: string
    }
    ? ProcessEmbeddedResourceResult<Schema, Resolved, Field, CurrentTableOrView>
    : // Otherwise the Resolved is a SelectQueryError return it
      { [K in GetFieldNodeResultName<Field>]: Resolved }
  : {
      [K in GetFieldNodeResultName<Field>]: SelectQueryError<'Failed to resolve relationship.'> &
        string
    }

/**
 * Helper type to process the result of an embedded resource.
 */
type ProcessEmbeddedResourceResult<
  Schema extends GenericSchema,
  Resolved extends {
    referencedTable: Pick<GenericTable, 'Row' | 'Relationships'>
    relation: GenericRelationship & { match: 'refrel' | 'col' | 'fkname' }
    direction: string
  },
  Field extends Ast.FieldNode,
  CurrentTableOrView extends keyof TablesAndViews<Schema>
> = ProcessNodes<
  Schema,
  Resolved['referencedTable']['Row'],
  Field['name'],
  Resolved['referencedTable']['Relationships'],
  Field['children'] extends undefined
    ? []
    : Exclude<Field['children'], undefined> extends Ast.Node[]
    ? Exclude<Field['children'], undefined>
    : []
> extends infer ProcessedChildren
  ? {
      [K in GetFieldNodeResultName<Field>]: Resolved['direction'] extends 'forward'
        ? Field extends { innerJoin: true }
          ? Resolved['relation']['isOneToOne'] extends true
            ? ProcessedChildren
            : ProcessedChildren[]
          : Resolved['relation']['isOneToOne'] extends true
          ? ProcessedChildren | null
          : ProcessedChildren[]
        : // If the relation is a self-reference it'll always be considered as reverse relationship
        Resolved['relation']['referencedRelation'] extends CurrentTableOrView
        ? // It can either be a reverse reference via a column inclusion (eg: parent_id(*))
          // in such case the result will be a single object
          Resolved['relation']['match'] extends 'col'
          ? IsRelationNullable<
              TablesAndViews<Schema>[CurrentTableOrView],
              Resolved['relation']
            > extends true
            ? ProcessedChildren | null
            : ProcessedChildren
          : // Or it can be a reference via the reference relation (eg: collections(*))
            // in such case, the result will be an array of all the values (all collection with parent_id being the current id)
            ProcessedChildren[]
        : // Otherwise if it's a non self-reference reverse relationship it's a single object
        IsRelationNullable<
            TablesAndViews<Schema>[CurrentTableOrView],
            Resolved['relation']
          > extends true
        ? ProcessedChildren | null
        : ProcessedChildren
    }
  : {
      [K in GetFieldNodeResultName<Field>]: SelectQueryError<'Failed to process embedded resource nodes.'> &
        string
    }

/**
 * Processes a SpreadNode by processing its target node.
 *
 * @param Schema - Database schema.
 * @param Row - The type of a row in the current table.
 * @param RelationName - The name of the current table or view.
 * @param Relationships - Relationships of the current table.
 * @param Spread - The SpreadNode to process.
 */
type ProcessSpreadNode<
  Schema extends GenericSchema,
  Row extends Record<string, unknown>,
  RelationName extends string,
  Relationships extends GenericRelationship[],
  Spread extends Ast.SpreadNode
> = ProcessNode<Schema, Row, RelationName, Relationships, Spread['target']> extends infer Result
  ? Result extends SelectQueryError<infer E>
    ? SelectQueryError<E>
    : ExtractFirstProperty<Result> extends unknown[]
    ? {
        [K in Spread['target']['name']]: SelectQueryError<`"${RelationName}" and "${Spread['target']['name']}" do not form a many-to-one or one-to-one relationship spread not possible`>
      }
    : ProcessSpreadNodeResult<Result>
  : never

/**
 * Helper type to process the result of a spread node.
 */
type ProcessSpreadNodeResult<Result> = ExtractFirstProperty<Result> extends infer SpreadedObject
  ? ContainsNull<SpreadedObject> extends true
    ? Exclude<{ [K in keyof SpreadedObject]: SpreadedObject[K] | null }, null>
    : Exclude<{ [K in keyof SpreadedObject]: SpreadedObject[K] }, null>
  : SelectQueryError<'An error occurred spreading the object'>
