import { AggregateFunctions, PostgreSQLTypes } from '../types'

export interface IdentifierNode {
  type: 'Identifier'
  name: string
}

export interface FieldNode {
  type: 'Field'
  name: string
  alias?: string
  hint?: unknown
  inner?: boolean
  left?: boolean
  children?: unknown
  aggregateFunction?: AggregateFunctions
  castType?: PostgreSQLTypes
}

export interface StarNode {
  type: 'Star'
}

export interface SpreadNode {
  type: 'Spread'
  target: FieldNode
}

export type Node = IdentifierNode | FieldNode | StarNode | SpreadNode
