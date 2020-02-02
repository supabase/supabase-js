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


## Usage

### Install

```sh
npm install --save @supabase/postgrest-js
```

### Initialize

```js
import { PostgrestClient } from ' @supabase/postgrest-js'

// Point to your own PostgREST server (or use ours, but go easy..)
const worldUrl = 'https://world.supabase.co/rest/v1'
const queryParams = { apikey: 'public-key-bOYapLADERfE' }
let client = new PostgrestClient(worldUrl, { queryParams })
```

### GET

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

// Ordering
let { body: countries } = await client
    .from('countries')
    .select('name')
    .order('name')
    
// Pagination
let { body: countries } = await client
    .from('countries')
    .select('name')
    .range(0, 10)

// Match
let { body: countries } = await client
    .from('countries')
    .match({ 'continent': 'Asia' })

// Equal
let { body: countries } = await client
    .from('countries')
    .eq('name', 'New Zealand')

// Greater than
let { body: countries } = await client
    .from('countries')
    .gt('id', 20)

// Less than
let { body: countries } = await client
    .from('countries')
    .lt('id', 20)

// Greater than or equal
let { body: countries } = await client
    .from('countries')
    .gte('id', 20)

// Less than or equal
let { body: countries } = await client
    .from('countries')
    .lte('id', 20)

// String search - case sensitive
let { body: countries } = await client
    .from('countries')
    .like('name', '%Zeal%')

// String search - case insensitive
let { body: countries } = await client
    .from('countries')
    .ilike('name', '%Zeal%')

// Exact equality (null, true, false)
let { body: countries } = await client
    .from('countries')
    .is('name', null)

// In list
let { body: countries } = await client
    .from('countries')
    .in('name', ['China', 'France'])

// Not equal
let { body: countries } = await client
    .from('countries')
    .not('name', 'China')

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

## License

This repo is liscenced under MIT.

## Credits

- https://github.com/calebmer/postgrest-client - originally forked and adapted from @calebmer's library
