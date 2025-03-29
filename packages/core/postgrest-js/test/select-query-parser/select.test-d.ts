import { expectType } from 'tsd'
import { TypeEqual } from 'ts-expect'
import { Json } from '../../src/select-query-parser/types'
import { SelectQueryError } from '../../src/select-query-parser/utils'
import { Prettify } from '../../src/types'
import { CustomUserDataType, Database } from '../types'
import { selectQueries } from '../relationships'

// This test file is here to ensure that for a query against a specfic datatabase
// our type inference for the result is correct and matching postgrest behavior at runtime
// it'll test the actual type inference AND query chaining (limit(), single(), ...)
// IMPORTANT: It shoudl be kept in sync with "test/relationships.ts" which test the actual runtime
// behavior of those queries using the same parameters

type Schema = Database['public']

// nested query with selective fields
{
  const { data } = await selectQueries.nestedQueryWithSelectiveFields.limit(1).single()
  let result: Exclude<typeof data, null>
  let expected: {
    username: string
    messages: {
      id: number
      message: string | null
    }[]
  }
  expectType<TypeEqual<typeof result, typeof expected>>(true)
}

// nested query with multiple levels and selective fields
{
  const { data } = await selectQueries.nestedQueryWithMultipleLevelsAndSelectiveFields
    .limit(1)
    .single()
  let result: Exclude<typeof data, null>
  let expected: {
    messages: Array<{
      id: number
      message: string | null
      channels: {
        id: number
        slug: string | null
      }
    }>
    username: string
  }
  expectType<TypeEqual<typeof result, typeof expected>>(true)
}

// query with multiple one-to-many relationships
{
  const { data } = await selectQueries.queryWithMultipleOneToManySelectives.limit(1).single()
  let result: Exclude<typeof data, null>
  let expected: {
    username: string
    messages: Array<Pick<Database['public']['Tables']['messages']['Row'], 'id'>>
    user_profiles: Array<Pick<Database['public']['Tables']['user_profiles']['Row'], 'id'>>
  }
  expectType<TypeEqual<typeof result, typeof expected>>(true)
}

// many-to-one relationship
{
  const { data } = await selectQueries.manyToOne.limit(1).single()
  let result: Exclude<typeof data, null>
  let expected: {
    user: Database['public']['Tables']['users']['Row']
  }
  expectType<TypeEqual<typeof result, typeof expected>>(true)
}

// !inner relationship
{
  const { data } = await selectQueries.inner.limit(1).single()
  let result: Exclude<typeof data, null>
  type ExpectedType = Prettify<
    Database['public']['Tables']['channels']['Row'] & {
      channel_details: Database['public']['Tables']['channel_details']['Row']
    }
  >
  let expected: {
    channels: ExpectedType
  }
  expectType<TypeEqual<typeof result, typeof expected>>(true)
}

// !inner relationship on nullable relation
{
  const { data } = await selectQueries.innerJoinOnNullableRelationship
  let result: Exclude<typeof data, null>
  let expected: Array<{
    id: number
    hotel: {
      id: number
      name: string | null
    }
  }>
  expectType<TypeEqual<typeof result, typeof expected>>(true)
}

// one-to-many relationship
{
  const { data } = await selectQueries.oneToMany.limit(1).single()
  let result: Exclude<typeof data, null>
  let expected: {
    messages: Database['public']['Tables']['messages']['Row'][]
  }
  expectType<TypeEqual<typeof result, typeof expected>>(true)
}

// one-to-many relationship with selective columns
{
  const { data } = await selectQueries.oneToManySelective.limit(1).single()
  let result: Exclude<typeof data, null>
  let expected: {
    messages: Array<Pick<Database['public']['Tables']['messages']['Row'], 'data'>>
  }
  expectType<TypeEqual<typeof result, typeof expected>>(true)
}

// one-to-one relationship
{
  const { data } = await selectQueries.oneToOne.limit(1).single()
  let result: Exclude<typeof data, null>
  let expected: {
    channel_details: Database['public']['Tables']['channel_details']['Row'] | null
  }
  expectType<TypeEqual<typeof result, typeof expected>>(true)
}

// !left oneToOne
{
  const { data } = await selectQueries.leftOneToOne.limit(1).single()
  let result: Exclude<typeof data, null>
  let expected: {
    channels: Database['public']['Tables']['channels']['Row']
  }
  expectType<TypeEqual<typeof result, typeof expected>>(true)
}

// !left oneToMany
{
  const { data } = await selectQueries.leftOneToMany.limit(1).single()
  let result: Exclude<typeof data, null>
  let expected: {
    messages: Array<Database['public']['Tables']['messages']['Row']>
  }
  expectType<TypeEqual<typeof result, typeof expected>>(true)
}

// !left zeroToOne
{
  const { data } = await selectQueries.leftZeroToOne.limit(1).single()
  let result: Exclude<typeof data, null>
  let expected: {
    users: Database['public']['Tables']['users']['Row'] | null
  }
  expectType<TypeEqual<typeof result, typeof expected>>(true)
}

// join over a 1-1 relation with both nullables and non-nullables fields using foreign key name for hinting
{
  const { data } = await selectQueries.joinOneToOneWithFkHint.limit(1).single()
  let result: Exclude<typeof data, null>
  let expected: {
    first_user: Database['public']['Tables']['users']['Row']
    second_user: Database['public']['Tables']['users']['Row']
    third_wheel: Database['public']['Tables']['users']['Row'] | null
  }
  expectType<TypeEqual<typeof result, typeof expected>>(true)
}

// join over a 1-M relation with both nullables and non-nullables fields using foreign key name for hinting
{
  const { data } = await selectQueries.joinOneToManyWithFkHint.limit(1).single()
  let result: Exclude<typeof data, null>
  let expected: {
    first_friend_of: Array<Database['public']['Tables']['best_friends']['Row']>
    second_friend_of: Array<Database['public']['Tables']['best_friends']['Row']>
    third_wheel_of: Array<Database['public']['Tables']['best_friends']['Row']>
  }
  expectType<TypeEqual<typeof result, typeof expected>>(true)
}

// join on 1-M relation
{
  const { data } = await selectQueries.joinOneToManyUsersWithFkHint.limit(1).single()
  let result: Exclude<typeof data, null>
  let expected: {
    first_friend_of: Array<Database['public']['Tables']['best_friends']['Row']>
    second_friend_of: Array<Database['public']['Tables']['best_friends']['Row']>
    third_wheel_of: Array<Database['public']['Tables']['best_friends']['Row']>
  }
  expectType<TypeEqual<typeof result, typeof expected>>(true)
}

// join on 1-1 relation with nullables
{
  const { data } = await selectQueries.joinOneToOneWithNullablesFkHint.limit(1).single()
  let result: Exclude<typeof data, null>
  let expected: {
    first_user: Database['public']['Tables']['users']['Row']
    second_user: Database['public']['Tables']['users']['Row']
    third_wheel: Database['public']['Tables']['users']['Row'] | null
  }
  expectType<TypeEqual<typeof result, typeof expected>>(true)
}

// join over a 1-1 relation with both nullables and non-nullables fields with no hinting
{
  const { data } = await selectQueries.joinOneToOneWithNullablesNoHint.limit(1).single()
  let result: Exclude<typeof data, null>
  let expected: {
    first_user: SelectQueryError<"Could not embed because more than one relationship was found for 'users' and 'best_friends' you need to hint the column with users!<columnName> ?">
    second_user: SelectQueryError<"Could not embed because more than one relationship was found for 'users' and 'best_friends' you need to hint the column with users!<columnName> ?">
    third_wheel: SelectQueryError<"Could not embed because more than one relationship was found for 'users' and 'best_friends' you need to hint the column with users!<columnName> ?">
  }
  expectType<TypeEqual<typeof result, typeof expected>>(true)
}

// join over a 1-1 relation with both nullablesand non-nullables fields with column name hinting
{
  const { data } = await selectQueries.joinOneToOneWithNullablesColumnHint.limit(1).single()
  let result: Exclude<typeof data, null>
  let expected: {
    first_user: Database['public']['Tables']['users']['Row']
    second_user: Database['public']['Tables']['users']['Row']
    third_wheel: Database['public']['Tables']['users']['Row'] | null
  }
  expectType<TypeEqual<typeof result, typeof expected>>(true)
}

// join over a 1-M relation with both nullables and non-nullables fields with no hinting
{
  const { data } = await selectQueries.joinOneToManyWithNullablesNoHint.limit(1).single()
  let result: Exclude<typeof data, null>
  let expected: {
    first_friend_of: SelectQueryError<"Could not embed because more than one relationship was found for 'best_friends' and 'users' you need to hint the column with best_friends!<columnName> ?">
    second_friend_of: SelectQueryError<"Could not embed because more than one relationship was found for 'best_friends' and 'users' you need to hint the column with best_friends!<columnName> ?">
    third_wheel_of: SelectQueryError<"Could not embed because more than one relationship was found for 'best_friends' and 'users' you need to hint the column with best_friends!<columnName> ?">
  }
  expectType<TypeEqual<typeof result, typeof expected>>(true)
}

// join over a 1-M relation with both nullables and non-nullables fields using column name for hinting
{
  const { data } = await selectQueries.joinOneToManyWithNullablesColumnHint.limit(1).single()
  let result: Exclude<typeof data, null>
  let expected: {
    first_friend_of: Array<Database['public']['Tables']['best_friends']['Row']>
    second_friend_of: Array<Database['public']['Tables']['best_friends']['Row']>
    third_wheel_of: Array<Database['public']['Tables']['best_friends']['Row']>
  }
  expectType<TypeEqual<typeof result, typeof expected>>(true)
}

// join over a 1-M relation with both nullables and non-nullables fields using column name hinting on nested relation
{
  const { data } = await selectQueries.joinOneToManyWithNullablesColumnHintOnNestedRelation
    .limit(1)
    .single()
  let result: Exclude<typeof data, null>
  type ExpectedType = Prettify<
    Database['public']['Tables']['best_friends']['Row'] & {
      first_user: string & Database['public']['Tables']['users']['Row']
    }
  >
  let expected: {
    first_friend_of: ExpectedType[]
    second_friend_of: Array<Database['public']['Tables']['best_friends']['Row']>
    third_wheel_of: Array<Database['public']['Tables']['best_friends']['Row']>
  }
  expectType<TypeEqual<typeof result, typeof expected>>(true)
}

// join over a 1-M relation with both nullables and non-nullables fields using no hinting on nested relation
{
  const { data } = await selectQueries.joinOneToManyWithNullablesNoHintOnNestedRelation
    .limit(1)
    .single()
  let result: Exclude<typeof data, null>
  let expected: {
    first_friend_of: Array<{
      id: number
      second_user: string
      third_wheel: string | null
      first_user: SelectQueryError<"Could not embed because more than one relationship was found for 'users' and 'best_friends' you need to hint the column with users!<columnName> ?">
    }>
    second_friend_of: Array<Database['public']['Tables']['best_friends']['Row']>
    third_wheel_of: Array<Database['public']['Tables']['best_friends']['Row']>
  }
  expectType<TypeEqual<typeof result, typeof expected>>(true)
}

// !left join on one to 0-1 non-empty relation
{
  const { data } = await selectQueries.leftOneToOneUsers.limit(1).single()
  let result: Exclude<typeof data, null>
  let expected: {
    user_profiles: Array<Pick<Database['public']['Tables']['user_profiles']['Row'], 'username'>>
  }
  expectType<TypeEqual<typeof result, typeof expected>>(true)
}

// join on one to 0-1 non-empty relation via column name
{
  const { data } = await selectQueries.oneToOneUsersColumnName.limit(1).single()
  let result: Exclude<typeof data, null>
  let expected: {
    user_profiles: Array<Pick<Database['public']['Tables']['user_profiles']['Row'], 'username'>>
  }
  expectType<TypeEqual<typeof result, typeof expected>>(true)
}

// !left join on zero to one with null relation
{
  const { data } = await selectQueries.leftZeroToOneUserProfiles.limit(1).single()
  let result: Exclude<typeof data, null>
  let expected: {
    id: number
    username: string | null
    users: Database['public']['Tables']['users']['Row'] | null
  }
  expectType<TypeEqual<typeof result, typeof expected>>(true)
}

// !left join on zero to one with valid relation
{
  const { data } = await selectQueries.leftZeroToOneUserProfilesWithNullables.limit(1).single()
  let result: Exclude<typeof data, null>
  let expected: {
    id: number
    username: string | null
    users: Pick<Database['public']['Tables']['users']['Row'], 'status'> | null
  }
  expectType<TypeEqual<typeof result, typeof expected>>(true)
}

// !left join on zero to one empty relation
{
  const { data } = await selectQueries.leftOneToOneUsers.limit(1).single()
  let result: Exclude<typeof data, null>
  let expected: {
    user_profiles: Array<Pick<Database['public']['Tables']['user_profiles']['Row'], 'username'>>
  }
  expectType<TypeEqual<typeof result, typeof expected>>(true)
}

// join on 1-M relation with selective fk hinting
{
  const { data } = await selectQueries.joinOneToManyUsersWithFkHintSelective.limit(1).single()
  let result: Exclude<typeof data, null>
  let expected: {
    first_friend_of: Array<Pick<Database['public']['Tables']['best_friends']['Row'], 'id'>>
    second_friend_of: Array<Database['public']['Tables']['best_friends']['Row']>
    third_wheel_of: Array<Database['public']['Tables']['best_friends']['Row']>
  }
  expectType<TypeEqual<typeof result, typeof expected>>(true)
}

// join select via column
{
  const { data } = await selectQueries.joinSelectViaColumn.limit(1).single()
  let result: Exclude<typeof data, null>
  let expected: {
    username: Database['public']['Tables']['users']['Row'] | null
  }
  expectType<TypeEqual<typeof result, typeof expected>>(true)
}

// join select via column selective
{
  const { data } = await selectQueries.joinSelectViaColumnSelective.limit(1).single()
  let result: Exclude<typeof data, null>
  let expected: {
    username: {
      status: Schema['Enums']['user_status'] | null
    } | null
  }
  expectType<TypeEqual<typeof result, typeof expected>>(true)
}

// join select via column and alias
{
  const { data } = await selectQueries.joinSelectViaColumnAndAlias.limit(1).single()
  let result: Exclude<typeof data, null>
  let expected: {
    user: Database['public']['Tables']['users']['Row'] | null
  }
  expectType<TypeEqual<typeof result, typeof expected>>(true)
}

// join select via unique table relationship
{
  const { data } = await selectQueries.joinSelectViaUniqueTableRelationship.limit(1).single()
  let result: Exclude<typeof data, null>
  let expected: {
    users: Database['public']['Tables']['users']['Row'] | null
  }
  expectType<TypeEqual<typeof result, typeof expected>>(true)
}

// join select via view name relationship
{
  const { data } = await selectQueries.joinSelectViaViewNameRelationship.limit(1).single()
  let result: Exclude<typeof data, null>
  let expected: {
    updatable_view: Database['public']['Views']['updatable_view']['Row'] | null
  }
  expectType<TypeEqual<typeof result, typeof expected>>(true)
}

// join select via column with string templating
{
  const { data } = await selectQueries.selectionWithStringTemplating.limit(1).single()
  let result: Exclude<typeof data, null>
  let expected: {
    status: Schema['Enums']['user_status'] | null
    username: string
  }
  expectType<TypeEqual<typeof result, typeof expected>>(true)
}

// select with aggregate count function
{
  const { data } = await selectQueries.selectWithAggregateCountFunction.limit(1).single()
  let result: Exclude<typeof data, null>
  let expected: {
    username: string
    messages: Array<{
      count: number
    }>
  }
  expectType<TypeEqual<typeof result, typeof expected>>(true)
}

// select with aggregate count on a column function
{
  const { data } = await selectQueries.selectWithAggregateCountOnAColumnFunction.limit(1).single()
  let result: Exclude<typeof data, null>
  let expected: {
    username: string
    messages: Array<{
      count: number
    }>
  }
  expectType<TypeEqual<typeof result, typeof expected>>(true)
}

// select with aggregate sum function without column should error
{
  const { data } = await selectQueries.selectWithAggregateSumFunctionWithoutColumn.limit(1).single()
  let result: Exclude<typeof data, null>
  let expected: {
    username: string
    messages: SelectQueryError<"column 'sum' does not exist on 'messages'.">[]
  }
  expectType<TypeEqual<typeof result, typeof expected>>(true)
}

// select with aggregate count function and alias
{
  const { data } = await selectQueries.selectWithAggregateCountFunctionAndAlias.limit(1).single()
  let result: Exclude<typeof data, null>
  let expected: {
    username: string
    messages: Array<{
      message_count: number
    }>
  }
  expectType<TypeEqual<typeof result, typeof expected>>(true)
}

// select with aggregate nested count function
{
  const { data } = await selectQueries.selectWithAggregateNestedCountFunction.limit(1).single()
  let result: Exclude<typeof data, null>
  let expected: {
    username: string
    messages: Array<{
      channels: {
        count: number
      }
    }>
  }
  expectType<TypeEqual<typeof result, typeof expected>>(true)
}

// select with aggregate nested count function and alias
{
  const { data } = await selectQueries.selectWithAggregateNestedCountFunctionAndAlias
    .limit(1)
    .single()
  let result: Exclude<typeof data, null>
  let expected: {
    username: string
    messages: Array<{
      channels: {
        channel_count: number
      }
    }>
  }
  expectType<TypeEqual<typeof result, typeof expected>>(true)
}

// select with aggregate count and spread
{
  const { data } = await selectQueries.selectWithAggregateCountAndSpread.limit(1).single()
  let result: Exclude<typeof data, null>
  let expected: {
    username: string
    messages: Array<{
      channels: {
        count: number
        details: string | null
      }
    }>
  }
  expectType<TypeEqual<typeof result, typeof expected>>(true)
}

// select with aggregate sum function
{
  const { data } = await selectQueries.selectWithAggregateSumFunction.limit(1).single()
  let result: Exclude<typeof data, null>
  let expected: {
    username: string
    messages: Array<{
      sum: number
    }>
  }
  expectType<TypeEqual<typeof result, typeof expected>>(true)
}

// select with aggregate aliased sum function
{
  const { data } = await selectQueries.selectWithAggregateAliasedSumFunction.limit(1).single()
  let result: Exclude<typeof data, null>
  let expected: {
    username: string
    messages: Array<{
      sum_id: number
    }>
  }
  expectType<TypeEqual<typeof result, typeof expected>>(true)
}

// select with aggregate sum function on nested relation
{
  const { data } = await selectQueries.selectWithAggregateSumFunctionOnNestedRelation
    .limit(1)
    .single()
  let result: Exclude<typeof data, null>
  let expected: {
    username: string
    messages: Array<{
      channels: {
        sum: number
      }
    }>
  }
  expectType<TypeEqual<typeof result, typeof expected>>(true)
}

// select with aggregate sum and spread
{
  const { data } = await selectQueries.selectWithAggregateSumAndSpread.limit(1).single()
  let result: Exclude<typeof data, null>
  let expected: {
    username: string
    messages: Array<{
      channels: {
        sum: number
        details: string | null
      }
    }>
  }
  expectType<TypeEqual<typeof result, typeof expected>>(true)
}

// select with aggregate sum and spread on nested relation
{
  const { data } = await selectQueries.selectWithAggregateSumAndSpreadOnNestedRelation
    .limit(1)
    .single()
  let result: Exclude<typeof data, null>
  let expected: {
    username: string
    messages: Array<{
      channels: {
        sum: number
        details_sum: number | null
        details: string | null
      }
    }>
  }
  expectType<TypeEqual<typeof result, typeof expected>>(true)
}

// select with spread on nested relation
{
  const { data } = await selectQueries.selectWithSpreadOnNestedRelation.limit(1).single()
  let result: Exclude<typeof data, null>
  let expected: {
    id: number
    channels: {
      id: number
      details_id: number | null
      details: string | null
    }
  }
  expectType<TypeEqual<typeof result, typeof expected>>(true)
}

// select with type casting query
{
  const { data } = await selectQueries.typeCastingQuery.limit(1).single()
  let result: Exclude<typeof data, null>
  let expected: {
    id: string
  }
  expectType<TypeEqual<typeof result, typeof expected>>(true)
}

// join with column hinting
{
  const { data } = await selectQueries.joinSelectViaColumnHint.limit(1).single()
  let result: Exclude<typeof data, null>
  let expected: {
    users: {
      age_range: unknown | null
      catchphrase: unknown | null
      data: CustomUserDataType | null
      status: Database['public']['Enums']['user_status'] | null
      username: string
    }
  }
  expectType<TypeEqual<typeof result, typeof expected>>(true)
}

// join with same dest twice column hinting
{
  const { data } = await selectQueries.joinSelectViaColumnHintTwice.limit(1).single()
  let result: Exclude<typeof data, null>
  let expected: {
    users: SelectQueryError<'table "best_friends" specified more than once use hinting for desambiguation'>
  }
  expectType<TypeEqual<typeof result, typeof expected>>(true)
}

// join with same dest twice column hinting
{
  const { data } = await selectQueries.selectSpreadOnManyRelation.limit(1).single()
  let result: Exclude<typeof data, null>
  let expected: {
    id: number
    messages: SelectQueryError<'"channels" and "messages" do not form a many-to-one or one-to-one relationship spread not possible'>
  }
  expectType<TypeEqual<typeof result, typeof expected>>(true)
}

// multiple times the same column in selection
{
  const { data } = await selectQueries.selectWithDuplicatesFields.limit(1).single()
  let result: Exclude<typeof data, null>
  let expected: {
    id: number
  }
  expectType<TypeEqual<typeof result, typeof expected>>(true)
}

// embed resource with no fields
{
  const { data } = await selectQueries.selectEmbedRessourceWithNoFields.limit(1).single()
  let result: Exclude<typeof data, null>
  let expected: {
    message: string | null
  }
  expectType<TypeEqual<typeof result, typeof expected>>(true)
}

// select JSON accessor
{
  const { data } = await selectQueries.selectJsonAccessor
    .limit(1)
    .filter('username', 'eq', 'jsonuser')
    .single()
  let result: Exclude<typeof data, null>
  let expected: {
    bar: Json
    baz: string
  }
  expectType<TypeEqual<typeof result, typeof expected>>(true)
}

// typecasting and aggregate
{
  const { data } = await selectQueries.typecastingAndAggregate.limit(1).single()
  let result: Exclude<typeof data, null>
  let expected: SelectQueryError<`column 'users' does not exist on 'messages'.`>
  expectType<TypeEqual<typeof result, typeof expected>>(true)
}

// inner join on many relation
{
  const { data } = await selectQueries.innerJoinOnManyRelation.limit(1).single()
  let result: Exclude<typeof data, null>
  let expected: {
    id: number
    messages: {
      id: number
      username: string
    }[]
  }
  expectType<TypeEqual<typeof result, typeof expected>>(true)
}

// self reference relation
{
  const { data } = await selectQueries.selfReferenceRelation.limit(1).single()
  let result: Exclude<typeof data, null>
  let expected: {
    id: number
    description: string | null
    parent_id: number | null
    collections: {
      id: number
      description: string | null
      parent_id: number | null
    }[]
  }
  expectType<TypeEqual<typeof result, typeof expected>>(true)
}

// self reference relation via column
{
  const { data } = await selectQueries.selfReferenceRelationViaColumn.limit(1).single()
  let result: Exclude<typeof data, null>
  let expected: {
    description: string | null
    id: number
    parent_id:
      | (number & {
          description: string | null
          id: number
          parent_id: number | null
        })
      | null
  }
  expectType<TypeEqual<typeof result, typeof expected>>(true)
}

// aggregate on missing column with alias
{
  const { data, error } = await selectQueries.aggregateOnMissingColumnWithAlias.limit(1).single()
  if (error) throw error
  expectType<SelectQueryError<`column 'missing_column' does not exist on 'users'.`>>(data!)
}

// many-to-many with join table
{
  const { data } = await selectQueries.manyToManyWithJoinTable.limit(1).single()
  let result: Exclude<typeof data, null>
  let expected: {
    id: number
    name: string
    description: string | null
    price: number
    categories: {
      id: number
      name: string
      description: string | null
    }[]
  }
  expectType<TypeEqual<typeof result, typeof expected>>(true)
}
