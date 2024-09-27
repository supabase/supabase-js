import { expectType } from 'tsd'
import type { ParseQuery } from '../../src/select-query-parser/parser/parser'
import type { ParserError } from '../../src/select-query-parser/parser/utils'
import { selectParams } from '../relationships'

// This test file is here to ensure some of our perser behave as expected
// it's useful to track down if the result type of a query is invalid becase of bad parsing
// or because of invalid matching against the final database type
// Basic select with multiple fields
{
  expectType<ParseQuery<'username, email, created_at'>>([
    { type: 'Field', name: 'username' },
    { type: 'Field', name: 'email' },
    { type: 'Field', name: 'created_at' },
  ])
}

// Select with star
{
  expectType<ParseQuery<'*'>>([{ type: 'Star' }])
}

{
  expectType<ParseQuery<'username, *'>>([{ type: 'Field', name: 'username' }, { type: 'Star' }])
}

// Select with renamed field
{
  expectType<ParseQuery<'display_name:username'>>([
    { type: 'Field', name: 'username', alias: 'display_name' },
  ])
}

// Select with embedded resource
{
  expectType<ParseQuery<'posts(id, title, content)'>>([
    {
      type: 'Field',
      name: 'posts',
      children: [
        { type: 'Field', name: 'id' },
        { type: 'Field', name: 'title' },
        { type: 'Field', name: 'content' },
      ],
    },
  ])
}

// Select with nested embedded resources
{
  expectType<ParseQuery<'posts(id, title, author(name, email))'>>([
    {
      type: 'Field',
      name: 'posts',
      children: [
        { type: 'Field', name: 'id' },
        { type: 'Field', name: 'title' },
        {
          type: 'Field',
          name: 'author',
          children: [
            { type: 'Field', name: 'name' },
            { type: 'Field', name: 'email' },
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
      type: 'Field',
      name: 'posts',
      children: [{ type: 'Field', name: 'count', aggregateFunction: 'count' }],
    },
  ])
}

// Select with JSON accessor
{
  expectType<ParseQuery<'data->preferences->theme'>>([
    { type: 'Field', name: 'data', alias: 'theme', castType: 'json' },
  ])
}

// Select with JSON accessor and text conversion
{
  expectType<ParseQuery<'data->preferences->>theme'>>([
    { type: 'Field', name: 'data', alias: 'theme', castType: 'text' },
  ])
}

// Select with spread
{
  expectType<ParseQuery<'username, ...posts(id, title)'>>([
    {
      type: 'Field',
      name: 'username',
    },
    {
      type: 'Spread',
      target: {
        type: 'Field',
        name: 'posts',
        children: [
          { type: 'Field', name: 'id' },
          { type: 'Field', name: 'title' },
        ],
      },
    },
  ])
}
{
  expectType<ParseQuery<'...users (first_name, last_name)'>>([
    {
      type: 'Spread',
      target: {
        type: 'Field',
        name: 'users',
        children: [
          { type: 'Field', name: 'first_name' },
          { type: 'Field', name: 'last_name' },
        ],
      },
    },
  ])
}

// Select with inner join
{
  expectType<ParseQuery<'posts!inner(id, title)'>>([
    {
      type: 'Field',
      name: 'posts',
      children: [
        { type: 'Field', name: 'id' },
        { type: 'Field', name: 'title' },
      ],
      inner: true,
    },
  ])
}

// Select with left join
{
  expectType<ParseQuery<'posts!left(id, title)'>>([
    {
      type: 'Field',
      name: 'posts',
      children: [
        { type: 'Field', name: 'id' },
        { type: 'Field', name: 'title' },
      ],
      left: true,
    },
  ])
}

// Select with rename and hint
{
  expectType<ParseQuery<'author:users!user_id(id, name)'>>([
    {
      type: 'Field',
      name: 'users',
      alias: 'author',
      hint: 'user_id',
      children: [
        { type: 'Field', name: 'id' },
        { type: 'Field', name: 'name' },
      ],
    },
  ])
}

// Complex select combining multiple features
{
  expectType<
    ParseQuery<'id, username, posts!left(id, title, comments(id, content)), profile->settings->>theme::text'>
  >([
    { type: 'Field', name: 'id' },
    { type: 'Field', name: 'username' },
    {
      type: 'Field',
      name: 'posts',
      children: [
        { type: 'Field', name: 'id' },
        { type: 'Field', name: 'title' },
        {
          type: 'Field',
          name: 'comments',
          children: [
            { type: 'Field', name: 'id' },
            { type: 'Field', name: 'content' },
          ],
        },
      ],
      left: true,
    },
    { type: 'Field', name: 'profile', alias: 'theme', castType: 'text' },
  ])
}
{
  type t = ParseQuery<'id, posts(count), comments(sum:id.sum())'>
  type aggFunction = t[1]['children'][0]['aggregateFunction']
  type isCount = aggFunction extends 'count' ? true : false
  expectType<isCount>(true)
  expectType<ParseQuery<'id, posts(count), comments(sum:id.sum())'>>([
    { type: 'Field', name: 'id' },
    {
      type: 'Field',
      name: 'posts',
      children: [{ type: 'Field', name: 'count', aggregateFunction: 'count' }],
    },
    {
      type: 'Field',
      name: 'comments',
      children: [{ type: 'Field', alias: 'sum', name: 'id', aggregateFunction: 'sum' }],
    },
  ])
}
{
  expectType<ParseQuery<'id, posts(count), comments(id.sum())'>>([
    { type: 'Field', name: 'id' },
    {
      type: 'Field',
      name: 'posts',
      children: [{ type: 'Field', name: 'count', aggregateFunction: 'count' }],
    },
    {
      type: 'Field',
      name: 'comments',
      children: [{ type: 'Field', name: 'id', aggregateFunction: 'sum' }],
    },
  ])
}
{
  expectType<ParseQuery<'id, posts(id.count())'>>([
    { type: 'Field', name: 'id' },
    {
      type: 'Field',
      name: 'posts',
      children: [{ type: 'Field', name: 'id', aggregateFunction: 'count' }],
    },
  ])
}
{
  expectType<ParseQuery<'id, posts(aliased:id.count())'>>([
    { type: 'Field', name: 'id' },
    {
      type: 'Field',
      name: 'posts',
      children: [{ type: 'Field', name: 'id', alias: 'aliased', aggregateFunction: 'count' }],
    },
  ])
}
{
  expectType<ParseQuery<'id, posts(count())'>>([
    { type: 'Field', name: 'id' },
    {
      type: 'Field',
      name: 'posts',
      children: [{ type: 'Field', name: 'count', aggregateFunction: 'count' }],
    },
  ])
}
{
  type t = ParseQuery<'id, posts(renamed_count:count())'>
  type aggFunction = t[1]['children'][0]['aggregateFunction']
  type isCount = aggFunction extends 'count' ? true : false
  expectType<isCount>(true)
  expectType<ParseQuery<'id, posts(renamed_count:count())'>>([
    { type: 'Field', name: 'id' },
    {
      type: 'Field',
      name: 'posts',
      children: [
        { type: 'Field', alias: 'renamed_count', name: 'count', aggregateFunction: 'count' },
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
    { type: 'Field', name: 'username' },
    {
      type: 'Field',
      name: 'messages',
      children: [
        {
          type: 'Field',
          name: 'channels',
          children: [
            {
              type: 'Field',
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
    { type: 'Field', name: 'posts', children: [{ type: 'Field', name: 'sum' }] },
  ])
}
// Should be considered embeded with parenthesis
{
  expectType<ParseQuery<'posts(sum())'>>([
    { type: 'Field', name: 'posts', children: [{ type: 'Field', name: 'sum', children: [] }] },
  ])
}

// Select with nested JSON accessors
{
  expectType<ParseQuery<'data->preferences->theme->color'>>([
    { type: 'Field', name: 'data', alias: 'color', castType: 'json' },
  ])
}

// Select with multiple spreads
{
  expectType<ParseQuery<'id, ...profile(name, email), ...settings(theme, language)'>>([
    { type: 'Field', name: 'id' },
    {
      type: 'Spread',
      target: {
        type: 'Field',
        name: 'profile',
        children: [
          { type: 'Field', name: 'name' },
          { type: 'Field', name: 'email' },
        ],
      },
    },
    {
      type: 'Spread',
      target: {
        type: 'Field',
        name: 'settings',
        children: [
          { type: 'Field', name: 'theme' },
          { type: 'Field', name: 'language' },
        ],
      },
    },
  ])
}

// Select with multiple hints
{
  expectType<ParseQuery<'author:users!user_id(id, name), posts!post_id(title, content)'>>([
    {
      type: 'Field',
      alias: 'author',
      name: 'users',
      hint: 'user_id',
      children: [
        { type: 'Field', name: 'id' },
        { type: 'Field', name: 'name' },
      ],
    },
    {
      type: 'Field',
      name: 'posts',
      hint: 'post_id',
      children: [
        { type: 'Field', name: 'title' },
        { type: 'Field', name: 'content' },
      ],
    },
  ])
}

// Select with combination of inner and left joins
{
  expectType<ParseQuery<'users!inner(id, name), posts!left(title, content)'>>([
    {
      type: 'Field',
      name: 'users',
      children: [
        { type: 'Field', name: 'id' },
        { type: 'Field', name: 'name' },
      ],
      inner: true,
    },
    {
      type: 'Field',
      name: 'posts',
      children: [
        { type: 'Field', name: 'title' },
        { type: 'Field', name: 'content' },
      ],
      left: true,
    },
  ])
}

// Select with quoted identifiers
{
  expectType<ParseQuery<'"user name":"complex name", "post-title":posts("content-body")'>>([
    { type: 'Field', name: 'complex name', alias: 'user name' },
    {
      type: 'Field',
      alias: 'post-title',
      name: 'posts',
      children: [{ type: 'Field', name: 'content-body' }],
    },
  ])
}

// Select with nested aggregations and type castings
{
  expectType<ParseQuery<'users(id, posts(count::int, avg_likes:likes.avg()::float))'>>([
    {
      type: 'Field',
      name: 'users',
      children: [
        { type: 'Field', name: 'id' },
        {
          type: 'Field',
          name: 'posts',
          children: [
            { type: 'Field', name: 'count', castType: 'int', aggregateFunction: 'count' },
            {
              type: 'Field',
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
      type: 'Field',
      name: 'id',
      castType: 'invalid_type',
    },
  ])
}

// Select with multiple type castings
{
  expectType<ParseQuery<'id::text, created_at::date, data->age::int'>>([
    { type: 'Field', name: 'id', castType: 'text' },
    { type: 'Field', name: 'created_at', castType: 'date' },
    { type: 'Field', name: 'data', alias: 'age', castType: 'int' },
  ])
}

// Select with type casting
{
  expectType<ParseQuery<'id::text, created_at::date, other::int'>>([
    { type: 'Field', name: 'id', castType: 'text' },
    { type: 'Field', name: 'created_at', castType: 'date' },
    { type: 'Field', name: 'other', castType: 'int' },
  ])
}

// select JSON accessor
{
  expect<ParseQuery<typeof selectParams.selectJsonAccessor.select>>([
    { type: 'Field', name: 'data', alias: 'bar', castType: 'json' },
    { type: 'Field', name: 'data', alias: 'baz', castType: 'text' },
  ])
}

// embed resource with no fields
{
  expect<ParseQuery<typeof selectParams.selectEmbedRessourceWithNoFields.select>>([
    { type: 'Field', name: 'message' },
    { type: 'Field', name: 'users', children: [] },
  ])
}

// ParserError test cases
// Empty string
{
  const r: ParserError<'Empty string'> = 'Empty string' as ParserError<'Empty string'>
  expectType<ParseQuery<''>>(r)
}

// Unexpected input at the end
{
  const r: ParserError<'Unexpected input: unexpected_input'> =
    'Unexpected input: unexpected_input' as ParserError<'Unexpected input: unexpected_input'>
  expectType<ParseQuery<'id, name unexpected_input'>>(r)
}

// Missing closing parenthesis
{
  const r: ParserError<"Expected ')' at "> = "Expected ')' at " as ParserError<"Expected ')' at ">
  expectType<ParseQuery<'users(id, name'>>(r)
}

// Incomplete JSON accessor
{
  const r: ParserError<'Unexpected input: ->'> =
    'Unexpected input: ->' as ParserError<'Unexpected input: ->'>
  expectType<ParseQuery<'data->'>>(r)
}

// Invalid hint (missing identifier after !)
{
  const r: ParserError<"Expected identifier after '!' at (id, name)"> =
    "Expected identifier after '!' at (id, name)" as ParserError<"Expected identifier after '!' at (id, name)">
  expectType<ParseQuery<'users!(id, name)'>>(r)
}

// Invalid spread (missing field after ...)
{
  const r: ParserError<'Unable to parse spread resource at ...::'> =
    'Unable to parse spread resource at ...::' as ParserError<'Unable to parse spread resource at ...::'>
  expectType<ParseQuery<'...::'>>(r)
}

// Invalid rename (missing field after :)
{
  const r: ParserError<'Unable to parse renamed field at new_name:'> =
    'Unable to parse renamed field at new_name:' as ParserError<'Unable to parse renamed field at new_name:'>
  expectType<ParseQuery<'new_name:'>>(r)
}

// Incomplete quoted identifier
{
  const r: ParserError<'Expected identifier at `"incomplete`'> =
    'Expected identifier at `"incomplete`' as ParserError<'Expected identifier at `"incomplete`'>
  expectType<ParseQuery<'"incomplete'>>(r)
}

// Invalid combination of inner and left join
{
  const r: ParserError<'Expected embedded resource after `!inner`'> =
    'Expected embedded resource after `!inner`' as ParserError<'Expected embedded resource after `!inner`'>
  expectType<ParseQuery<'users!inner!left(id, name)'>>(r)
}

// Missing opening parenthesis after aggregate function
{
  const r: ParserError<'Expected `()` after `.` operator `avg`'> =
    'Expected `()` after `.` operator `avg`' as ParserError<'Expected `()` after `.` operator `avg`'>
  expectType<ParseQuery<'posts(likes.avg'>>(r)
}

// Invalid nested JSON accessor
{
  const r: ParserError<'Unexpected input: ->->theme'> =
    'Unexpected input: ->->theme' as ParserError<'Unexpected input: ->->theme'>
  expectType<ParseQuery<'data->preferences->->theme'>>(r)
}
