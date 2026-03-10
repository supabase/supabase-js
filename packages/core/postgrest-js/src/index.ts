import PostgrestClient from './PostgrestClient'
import PostgrestQueryBuilder from './PostgrestQueryBuilder'
import PostgrestFilterBuilder from './PostgrestFilterBuilder'
import PostgrestTransformBuilder from './PostgrestTransformBuilder'
import PostgrestBuilder from './PostgrestBuilder'
import PostgrestError from './PostgrestError'

export {
  PostgrestClient,
  PostgrestQueryBuilder,
  PostgrestFilterBuilder,
  PostgrestTransformBuilder,
  PostgrestBuilder,
  PostgrestError,
}
export default {
  PostgrestClient,
  PostgrestQueryBuilder,
  PostgrestFilterBuilder,
  PostgrestTransformBuilder,
  PostgrestBuilder,
  PostgrestError,
}
export type {
  PostgrestResponse,
  PostgrestResponseFailure,
  PostgrestResponseSuccess,
  PostgrestSingleResponse,
  PostgrestMaybeSingleResponse,
} from './types/types'
export type { ClientServerOptions as PostgrestClientOptions } from './types/common/common'
// https://github.com/supabase/postgrest-js/issues/551
// To be replaced with a helper type that only uses public types
export type { GetResult as UnstableGetResult } from './select-query-parser/result'
// Array-based select builder types
export type {
  SelectSpec,
  SelectItem,
  FieldSpec,
  RelationSpec,
  SpreadSpec,
  CountSpec,
  AggregateFunction,
} from './select-query-parser/select-builder'
export { serializeSelectSpec } from './select-query-parser/select-builder'
