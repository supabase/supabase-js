# Postgrest JS

Isomorphic JavaScript client for [PostgREST](https://postgrest.org). The goal of this library is to make an "ORM-like" restful interface. 

**Contents**
- [Usage](#usage)
  - [Install](#install)
  - [Initialize](#initialize)
  - [GET](#get)
  - [POST](#post)
  - [PATCH](#patch)
  - [DELETE](#delete)
- [Usage online](#usage-online)
- [Contributing](#contributing)
- [License](#license)
- [Credits](#credits)
- [Status](#status)


## Usage

### Install

```sh
npm install --save @supabase/postgrest-js
```

### Initialize

```js
import { PostgrestClient } from ' @supabase/postgrest-js'
let client = new PostgrestClient('https://your-postgrest.com')
```

#### PostgrestClient(postgrestURL, OPTIONS)
`postgrestURL: string`

The URL from where your postgREST queries.

`OPTIONS: object?`
```js
/**
* @param {object?} headers
* List of headers as keys and their corresponding values
*
* @param {object?} query_params
* List of query parameters as keys and their corresponding values
*
* @param {string} schema
* If you are using postgREST version v7.0.0 and above,  
* you can use this to indicate your selected schema.
* This is provided that your schema is included in db-schema
*/
```
To know more about multi schema and swithching between schema, more information can be found [here](http://postgrest.org/en/v7.0.0/configuration.html#db-schema).

### GET
These filters also support our `PATCH` and `DELETE` actions as well. More information on our filters can be found [here](https://supabase.io/docs/library/get#filter_).

```js

// Basic
let { body: countries } = await client
    .from('countries')
    .select('*')

// Getting specific columns
let { body: countries } = await client
    .from('countries')
    .select('name')

// Query foreign tables
let { body: countries } = await client
    .from('countries')
    .select(`
        name,
        cities (
            name
        )
    `)

// Filter foreign tables
let { body: countries } = await client
    .from('countries')
    .select(`
        name,
        cities (
            name
        )
    `)
    .filter('name', 'eq', 'New Zealand')
    .filter('cities.name', 'eq', 'Auckland')

// Not (the reverse of .filter())
let { body: countries } = await client
    .from('countries')
    .select(`
        name,
        cities (
            name
        )
    `)
    .not('name', 'eq', 'New Zealand')
    .not('cities.name', 'eq', 'Auckland')

// Ordering
let { body: countries } = await client
    .from('countries')
    .select('name')
    .order('name')

// Ordering for foreign tables
let { body: countries } = await client
    .from('countries')
    .select(`
        name,
        cities (
            name
        )
    `)
    .order('cities.name')
    
// Limiting
let { body: countries } = await client
    .from('countries')
    .select('*')
    .limit(1)

// Limiting for foreign tables
let { body: countries } = await client
    .from('countries')
    .select(`
        name,
        cities (
            name
        )
    `)
    .limit(1, 'cities')

// Setting offsets
let { body: countries } = await client
    .from('countries')
    .select('*')
    .offset(1)

// Setting offsets for foreign tables
let { body: countries } = await client
    .from('countries')
    .select(`
        name,
        cities (
            name
        )
    `)
    .offset(1, 'cities')

// Pagination
let { body: countries } = await client
    .from('countries')
    .select('name')
    .range(0, 10)

// Match
let { body: countries } = await client
    .from('countries')
    .match({ 'continent': 'Asia' })
    .select('*')

// Equal
let { body: countries } = await client
    .from('countries')
    .eq('name', 'New Zealand')
    .select('*')

// Greater than
let { body: countries } = await client
    .from('countries')
    .gt('id', 20)
    .select('*')

// Less than
let { body: countries } = await client
    .from('countries')
    .lt('id', 20)
    .select('*')

// Greater than or equal
let { body: countries } = await client
    .from('countries')
    .gte('id', 20)
    .select('*')

// Less than or equal
let { body: countries } = await client
    .from('countries')
    .lte('id', 20)
    .select('*')

// String search - case sensitive
let { body: countries } = await client
    .from('countries')
    .like('name', '%Zeal%')
    .select('*')

// String search - case insensitive
let { body: countries } = await client
    .from('countries')
    .ilike('name', '%Zeal%')
    .select('*')

// Exact equality (null, true, false)
let { body: countries } = await client
    .from('countries')
    .is('name', null)
    .select('*')

// In list
let { body: countries } = await client
    .from('countries')
    .in('name', ['China', 'France'])
    .select('*')

// Not equal
let { body: countries } = await client
    .from('countries')
    .neq('name', 'China')
    .select('*')

// Contains
let { body: countries } = await client
    .from('countries')
    .cs('main_exports', ['oil'])
    .select('*')

// Contained in
let { body: countries } = await client
    .from('countries')
    .cd('main_exports', ['cars', 'food', 'machine'])
    .select('*')

// Overlaps (for arrays)
let { body: countries } = await client
    .from('countries')
    .ova('main_exports', ['computers', 'minerals'])
    .select('*')

// Overlaps (for ranges)
let { body: countries } = await client
    .from('countries')
    .ovr('population_range_millions', [150, 250])
    .select('*')

// Strictly left
let { body: countries } = await client
    .from('countries')
    .sl('population_range_millions', [150, 250])
    .select('*')

// Strictly right
let { body: countries } = await client
    .from('countries')
    .sr('population_range_millions', [150, 250])
    .select('*')

// Does not extend to the left
let { body: countries } = await client
    .from('countries')
    .nxl('population_range_millions', [150, 250])
    .select('*')

// Does not extend to the right
let { body: countries } = await client
    .from('countries')
    .nxr('population_range_millions', [150, 250])
    .select('*')

// Adjacent
let { body: countries } = await client
    .from('countries')
    .adj('population_range_millions', [70, 185])
    .select('*')

```


### POST

You can insert records using `insert()`. Insert accepts an array of objects so that you can batch insert.

```js
let { status } = await client
    .from('messages')
    .insert([{ message: 'Hello World 👋'])
```

### PATCH

You can update records using `update()`.

```js
let { status } = await client
    .from('messages')
    .eq('message', 'Hello World 👋')
    .update({ message: 'Goodbye World 👋' })
```

### DELETE

You can delete records using `delete()`.

```js
let { status } = await client
    .from('messages')
    .eq('message', 'Goodbye World 👋')
    .delete()
```

## Usage online 

To see details examples of usage, see the Supabase docs:

- [Reading](https://supabase.io/docs/library/get)
- [Creating](https://supabase.io/docs/library/post)
- [Creating](https://supabase.io/docs/library/post)
- [Deleting](https://supabase.io/docs/library/delete)
- [Stored Procedures](https://supabase.io/docs/library/stored-procedures)

## Contributing

- Fork the repo on GitHub
- Clone the project to your own machine
- Commit changes to your own branch
- Push your work back up to your fork
- Submit a Pull request so that we can review your changes and merge

**Release Notes**

```
gren release --override
```

This will create the changelog and the [release](https://github.com/supabase/postgrest-js/releases).

## License

This repo is liscenced under MIT.

## Credits

- https://github.com/calebmer/postgrest-client - originally forked and adapted from @calebmer's library

## Status

![Tests](https://github.com/supabase/postgrest-js/workflows/Node.js%20CI/badge.svg)

Ready for production! Watch and star this repo to keep updated on releases.

![Watch this repo](https://gitcdn.xyz/repo/supabase/monorepo/master/web/static/watch-repo.gif "Watch this repo")
