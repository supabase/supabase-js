import PostgrestClient from './PostgrestClient'
import type { DefaultSchemaNameOf, PostgrestClientOptions, SchemaNameOf } from './PostgrestClient'
import PostgrestQueryBuilder from './PostgrestQueryBuilder'
import PostgrestFilterBuilder from './PostgrestFilterBuilder'
import PostgrestTransformBuilder from './PostgrestTransformBuilder'
import PostgrestBuilder from './PostgrestBuilder'
import PostgrestError from './PostgrestError'
import { normalizeSelect } from './normalizeSelect'

export {
  PostgrestClient,
  PostgrestQueryBuilder,
  PostgrestFilterBuilder,
  PostgrestTransformBuilder,
  PostgrestBuilder,
  PostgrestError,
  normalizeSelect,
}
export default {
  PostgrestClient,
  PostgrestQueryBuilder,
  PostgrestFilterBuilder,
  PostgrestTransformBuilder,
  PostgrestBuilder,
  PostgrestError,
}
export type { DefaultSchemaNameOf, PostgrestClientOptions, SchemaNameOf }
export type {
  PostgrestResponse,
  PostgrestResponseFailure,
  PostgrestResponseSuccess,
  PostgrestSingleResponse,
  PostgrestMaybeSingleResponse,
  PostgrestOpenApiSpec,
} from './types/types'
export type { PgrstJson, PgrstJsonText } from './types/planner/json'
export type {
  DefaultDatabase,
  GenericDatabase,
  PgrstFeature,
  SupabaseColumnType,
} from './types/planner/globals'
export type { RpcOptions, SelectOptions, MutOptions } from './types/planner/options'
export type { InsertOptions, UpsertOptions } from './PostgrestQueryBuilder'
export type { ExplainOptions, OrderOptions } from './PostgrestTransformBuilder'
export type { InvalidMethodError, TextSearchOptions } from './PostgrestFilterBuilder'
