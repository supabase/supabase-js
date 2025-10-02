import { expectType, TypeEqual } from '../types'
import type { ParseQuery, ParserError } from '../../src/select-query-parser/parser'

// This test file is here to ensure some of our perser behave as expected
// it's useful to track down if the result type of a query is invalid becase of bad parsing
// or because of invalid matching against the final database type
// Basic select with multiple fields
{
  expectType<ParseQuery<'username, email, created_at'>>([
    { type: 'field', name: 'username' },
    { type: 'field', name: 'email' },
    { type: 'field', name: 'created_at' },
  ])
}

// Select with star
{
  expectType<ParseQuery<'*'>>([{ type: 'star' }])
}

{
  expectType<ParseQuery<'username, *'>>([{ type: 'field', name: 'username' }, { type: 'star' }])
}

// Select with renamed field
{
  expectType<ParseQuery<'display_name:username'>>([
    { type: 'field', name: 'username', alias: 'display_name' },
  ])
}

// Select with embedded resource
{
  expectType<ParseQuery<'posts(id, title, content)'>>([
    {
      type: 'field',
      name: 'posts',
      children: [
        { type: 'field', name: 'id' },
        { type: 'field', name: 'title' },
        { type: 'field', name: 'content' },
      ],
    },
  ])
}

// Select with nested embedded resources
{
  expectType<ParseQuery<'posts(id, title, author(name, email))'>>([
    {
      type: 'field',
      name: 'posts',
      children: [
        { type: 'field', name: 'id' },
        { type: 'field', name: 'title' },
        {
          type: 'field',
          name: 'author',
          children: [
            { type: 'field', name: 'name' },
            { type: 'field', name: 'email' },
          ],
        },
      ],
    },
  ])
}

// Select with aggregation
{
  expectType<ParseQuery<'posts(count)'>>([
    {
      type: 'field',
      name: 'posts',
      children: [{ type: 'field', name: 'count', aggregateFunction: 'count' }],
    },
  ])
}

// Select with JSON accessor
{
  expectType<ParseQuery<'data->preferences->theme'>>([
    {
      type: 'field',
      name: 'data',
      alias: 'theme',
      castType: 'json',
      jsonPath: 'preferences.theme',
    },
  ])
}

// Select with JSON accessor and text conversion
{
  expectType<ParseQuery<'data->preferences->>theme'>>([
    {
      type: 'field',
      name: 'data',
      alias: 'theme',
      castType: 'text',
      jsonPath: 'preferences.theme',
    },
  ])
}
{
  expectType<ParseQuery<'data->preferences->>theme, data->>some, data->foo->bar->>biz'>>([
    {
      type: 'field',
      name: 'data',
      alias: 'theme',
      castType: 'text',
      jsonPath: 'preferences.theme',
    },
    {
      type: 'field',
      name: 'data',
      alias: 'some',
      castType: 'text',
      jsonPath: 'some',
    },
    {
      type: 'field',
      name: 'data',
      alias: 'biz',
      castType: 'text',
      jsonPath: 'foo.bar.biz',
    },
  ])
}
// Select with spread
{
  expectType<ParseQuery<'username, ...posts(id, title)'>>([
    {
      type: 'field',
      name: 'username',
    },
    {
      type: 'spread',
      target: {
        type: 'field',
        name: 'posts',
        children: [
          { type: 'field', name: 'id' },
          { type: 'field', name: 'title' },
        ],
      },
    },
  ])
}
{
  expectType<ParseQuery<'...users (first_name, last_name)'>>([
    {
      type: 'spread',
      target: {
        type: 'field',
        name: 'users',
        children: [
          { type: 'field', name: 'first_name' },
          { type: 'field', name: 'last_name' },
        ],
      },
    },
  ])
}

// Select with inner join
{
  expectType<ParseQuery<'posts!inner(id, title)'>>([
    {
      type: 'field',
      name: 'posts',
      innerJoin: true,
      children: [
        { type: 'field', name: 'id' },
        { type: 'field', name: 'title' },
      ],
    },
  ])
}

// Select with left join
{
  expectType<ParseQuery<'posts!left(id, title)'>>([
    {
      type: 'field',
      name: 'posts',
      children: [
        { type: 'field', name: 'id' },
        { type: 'field', name: 'title' },
      ],
    },
  ])
}

// Select with rename and hint
{
  expectType<ParseQuery<'author:users!user_id(id, name)'>>([
    {
      type: 'field',
      name: 'users',
      alias: 'author',
      hint: 'user_id',
      children: [
        { type: 'field', name: 'id' },
        { type: 'field', name: 'name' },
      ],
    },
  ])
}

// Complex select combining multiple features
{
  expectType<
    ParseQuery<'id, username, posts!left(id, title, comments(id, content)), profile->settings->>theme::text'>
  >([
    { type: 'field', name: 'id' },
    { type: 'field', name: 'username' },
    {
      type: 'field',
      name: 'posts',
      children: [
        { type: 'field', name: 'id' },
        { type: 'field', name: 'title' },
        {
          type: 'field',
          name: 'comments',
          children: [
            { type: 'field', name: 'id' },
            { type: 'field', name: 'content' },
          ],
        },
      ],
    },
    {
      type: 'field',
      name: 'profile',
      alias: 'theme',
      castType: 'text',
      jsonPath: 'settings.theme',
    },
  ])
}
{
  type t = ParseQuery<'id, posts(count), comments(sum:id.sum())'>
  type aggFunction = t[1]['children'][0]['aggregateFunction']
  type isCount = aggFunction extends 'count' ? true : false
  expectType<isCount>(true)
  expectType<ParseQuery<'id, posts(count), comments(sum:id.sum())'>>([
    { type: 'field', name: 'id' },
    {
      type: 'field',
      name: 'posts',
      children: [{ type: 'field', name: 'count', aggregateFunction: 'count' }],
    },
    {
      type: 'field',
      name: 'comments',
      children: [{ type: 'field', alias: 'sum', name: 'id', aggregateFunction: 'sum' }],
    },
  ])
}
{
  expectType<ParseQuery<'id, posts(count), comments(id.sum())'>>([
    { type: 'field', name: 'id' },
    {
      type: 'field',
      name: 'posts',
      children: [{ type: 'field', name: 'count', aggregateFunction: 'count' }],
    },
    {
      type: 'field',
      name: 'comments',
      children: [{ type: 'field', name: 'id', aggregateFunction: 'sum' }],
    },
  ])
}
{
  expectType<ParseQuery<'id, posts(id.count())'>>([
    { type: 'field', name: 'id' },
    {
      type: 'field',
      name: 'posts',
      children: [{ type: 'field', name: 'id', aggregateFunction: 'count' }],
    },
  ])
}
{
  expectType<ParseQuery<'id, posts(aliased:id.count())'>>([
    { type: 'field', name: 'id' },
    {
      type: 'field',
      name: 'posts',
      children: [{ type: 'field', name: 'id', alias: 'aliased', aggregateFunction: 'count' }],
    },
  ])
}
{
  expectType<ParseQuery<'id, posts(count())'>>([
    { type: 'field', name: 'id' },
    {
      type: 'field',
      name: 'posts',
      children: [{ type: 'field', name: 'count', aggregateFunction: 'count' }],
    },
  ])
}
{
  type t = ParseQuery<'id, posts(renamed_count:count())'>
  type aggFunction = t[1]['children'][0]['aggregateFunction']
  type isCount = aggFunction extends 'count' ? true : false
  expectType<isCount>(true)
  expectType<ParseQuery<'id, posts(renamed_count:count())'>>([
    { type: 'field', name: 'id' },
    {
      type: 'field',
      name: 'posts',
      children: [
        { type: 'field', alias: 'renamed_count', name: 'count', aggregateFunction: 'count' },
      ],
    },
  ])
}
{
  type t = ParseQuery<'username, messages(channels(channel_count:count()))'>
  type aggFunction = t[1]['children'][0]['children'][0]['aggregateFunction']
  type isCount = aggFunction extends 'count' ? true : false
  expectType<isCount>(true)
  expectType<ParseQuery<'username, messages(channels(channel_count:count()))'>>([
    { type: 'field', name: 'username' },
    {
      type: 'field',
      name: 'messages',
      children: [
        {
          type: 'field',
          name: 'channels',
          children: [
            {
              type: 'field',
              alias: 'channel_count',
              name: 'count',
              aggregateFunction: 'count',
            },
          ],
        },
      ],
    },
  ])
}
// Other than count aggregation function without column name
// should be a field like any other
{
  expectType<ParseQuery<'posts(sum)'>>([
    { type: 'field', name: 'posts', children: [{ type: 'field', name: 'sum' }] },
  ])
}
// Should be considered embeded with parenthesis
{
  expectType<ParseQuery<'posts(sum())'>>([
    {
      type: 'field',
      name: 'posts',
      children: [{ type: 'field', name: 'sum', children: [] as [] }],
    },
  ])
}

// Select with nested JSON accessors
{
  expectType<ParseQuery<'data->preferences->theme->color'>>([
    {
      type: 'field',
      name: 'data',
      alias: 'color',
      castType: 'json',
      jsonPath: 'preferences.theme.color',
    },
  ])
}

// Select with multiple spreads
{
  expectType<ParseQuery<'id, ...profile(name, email), ...settings(theme, language)'>>([
    { type: 'field', name: 'id' },
    {
      type: 'spread',
      target: {
        type: 'field',
        name: 'profile',
        children: [
          { type: 'field', name: 'name' },
          { type: 'field', name: 'email' },
        ],
      },
    },
    {
      type: 'spread',
      target: {
        type: 'field',
        name: 'settings',
        children: [
          { type: 'field', name: 'theme' },
          { type: 'field', name: 'language' },
        ],
      },
    },
  ])
}

// Select with multiple hints
{
  expectType<ParseQuery<'author:users!user_id(id, name), posts!post_id(title, content)'>>([
    {
      type: 'field',
      alias: 'author',
      name: 'users',
      hint: 'user_id',
      children: [
        { type: 'field', name: 'id' },
        { type: 'field', name: 'name' },
      ],
    },
    {
      type: 'field',
      name: 'posts',
      hint: 'post_id',
      children: [
        { type: 'field', name: 'title' },
        { type: 'field', name: 'content' },
      ],
    },
  ])
}

// Select with combination of inner and left joins
{
  expectType<ParseQuery<'users!inner(id, name), posts!left(title, content)'>>([
    {
      type: 'field',
      name: 'users',
      innerJoin: true,
      children: [
        { type: 'field', name: 'id' },
        { type: 'field', name: 'name' },
      ],
    },
    {
      type: 'field',
      name: 'posts',
      children: [
        { type: 'field', name: 'title' },
        { type: 'field', name: 'content' },
      ],
    },
  ])
}

// Select with quoted identifiers
{
  expectType<ParseQuery<'"user name":"complex name", "post-title":posts("content-body")'>>([
    { type: 'field', name: 'complex name', alias: 'user name' },
    {
      type: 'field',
      alias: 'post-title',
      name: 'posts',
      children: [{ type: 'field', name: 'content-body' }],
    },
  ])
}

// Select with nested aggregations and type castings
{
  expectType<ParseQuery<'users(id, posts(count::int, avg_likes:likes.avg()::float))'>>([
    {
      type: 'field',
      name: 'users',
      children: [
        { type: 'field', name: 'id' },
        {
          type: 'field',
          name: 'posts',
          children: [
            { type: 'field', name: 'count', castType: 'int', aggregateFunction: 'count' },
            {
              type: 'field',
              alias: 'avg_likes',
              name: 'likes',
              castType: 'float',
              aggregateFunction: 'avg',
            },
          ],
        },
      ],
    },
  ])
}

// Invalid type cast
{
  expectType<ParseQuery<'id::invalid_type'>>([
    {
      type: 'field',
      name: 'id',
      castType: 'invalid_type',
    },
  ])
}

// Select with multiple type castings
{
  expectType<ParseQuery<'id::text, created_at::date, data->age::int'>>([
    { type: 'field', name: 'id', castType: 'text' },
    { type: 'field', name: 'created_at', castType: 'date' },
    { type: 'field', name: 'data', alias: 'age', castType: 'int', jsonPath: 'age' },
  ])
}

// Select with type casting
{
  expectType<ParseQuery<'id::text, created_at::date, other::int'>>([
    { type: 'field', name: 'id', castType: 'text' },
    { type: 'field', name: 'created_at', castType: 'date' },
    { type: 'field', name: 'other', castType: 'int' },
  ])
}

// select JSON accessor
{
  expectType<ParseQuery<'data->foo->bar, data->foo->>baz'>>([
    { type: 'field', name: 'data', alias: 'bar', castType: 'json', jsonPath: 'foo.bar' },
    { type: 'field', name: 'data', alias: 'baz', castType: 'text', jsonPath: 'foo.baz' },
  ])
}

// embed resource with no fields
{
  expectType<ParseQuery<'message, users()'>>([
    { type: 'field', name: 'message' },
    { type: 'field', name: 'users', children: [] },
  ])
}

// many-to-one join
{
  expectType<ParseQuery<'message, channels (slug)'>>([
    { type: 'field', name: 'message' },
    {
      type: 'field',
      name: 'channels',
      children: [{ type: 'field', name: 'slug' }],
    },
  ])
}

// many-to-one join with inner
{
  expectType<ParseQuery<'message, channels!inner (slug)'>>([
    { type: 'field', name: 'message' },
    {
      type: 'field',
      name: 'channels',
      innerJoin: true,
      children: [{ type: 'field', name: 'slug' }],
    },
  ])
}

// many-to-one join with not null
{
  expectType<ParseQuery<'message, channels (slug)'>>([
    { type: 'field', name: 'message' },
    {
      type: 'field',
      name: 'channels',
      children: [{ type: 'field', name: 'slug' }],
    },
  ])
}

// many-to-one join with inner and not null
{
  expectType<ParseQuery<'message, channels!inner (slug)'>>([
    { type: 'field', name: 'message' },
    {
      type: 'field',
      name: 'channels',
      innerJoin: true,
      children: [{ type: 'field', name: 'slug' }],
    },
  ])
}

// ParserError test cases
// Empty string
{
  expectType<ParseQuery<''>>(0 as any as ParserError<'Empty string'>)
}

// Unexpected input at the end
{
  expectType<ParseQuery<'id, name unexpected_input'>>(
    0 as any as ParserError<'Unexpected input: unexpected_input'>
  )
}

// Missing closing parenthesis
{
  expectType<ParseQuery<'users(id, name'>>(0 as any as ParserError<'Expected ")" at ``'>)
}

// Incomplete JSON accessor
{
  expectType<ParseQuery<'data->'>>(0 as any as ParserError<'Expected property name after `->`'>)
}

// Invalid hint (missing identifier after !)
{
  expectType<ParseQuery<'users!(id, name)'>>(
    0 as any as ParserError<'Expected identifier after "!" at `(id, name)`'>
  )
}

// Invalid spread (missing field after ...)
{
  expectType<ParseQuery<'...::'>>(
    0 as any as ParserError<'Unable to parse spread resource at `...::`'>
  )
}

// Invalid rename (missing field after :)
{
  expectType<ParseQuery<'new_name:'>>(
    0 as any as ParserError<'Unable to parse renamed field at `new_name:`'>
  )
}

// Incomplete quoted identifier
{
  expectType<ParseQuery<'"incomplete'>>(
    0 as any as ParserError<'Expected identifier at `"incomplete`'>
  )
}

// Invalid combination of inner and left join
{
  expectType<ParseQuery<'users!inner!left(id, name)'>>(
    0 as any as ParserError<'Expected "(" at `!left(id, name)`'>
  )
}

// Missing opening parenthesis after aggregate function
{
  expectType<ParseQuery<'posts(likes.avg'>>(
    0 as any as ParserError<'Expected `()` after `.` operator `avg`'>
  )
}

// Invalid nested JSON accessor
{
  expectType<ParseQuery<'data->preferences->->theme'>>(
    0 as any as ParserError<'Unexpected input: ->->theme'>
  )
}

// JSON accessor within embedded tables
{
  expectType<ParseQuery<'users(data->bar->>baz, data->>en, data->bar)'>>([
    {
      type: 'field',
      name: 'users',
      children: [
        {
          type: 'field',
          name: 'data',
          alias: 'baz',
          castType: 'text',
          jsonPath: 'bar.baz',
        },
        {
          type: 'field',
          name: 'data',
          alias: 'en',
          castType: 'text',
          jsonPath: 'en',
        },
        {
          type: 'field',
          name: 'data',
          alias: 'bar',
          castType: 'json',
          jsonPath: 'bar',
        },
      ],
    },
  ])
}
