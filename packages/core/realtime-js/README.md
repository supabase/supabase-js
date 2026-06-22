<br />
<p align="center">
  <a href="https://supabase.io">
        <picture>
      <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/supabase/supabase/master/packages/common/assets/images/supabase-logo-wordmark--dark.svg">
      <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/supabase/supabase/master/packages/common/assets/images/supabase-logo-wordmark--light.svg">
      <img alt="Supabase Logo" width="300" src="https://raw.githubusercontent.com/supabase/supabase/master/packages/common/assets/images/logo-preview.jpg">
    </picture>
  </a>

  <h1 align="center">Supabase Realtime JS SDK</h1>

  <h3 align="center">Send ephemeral messages with <b>Broadcast</b>, track and synchronize state with <b>Presence</b>, and listen to database changes with <b>Postgres Change Data Capture (CDC)</b>.</h3>

  <p align="center">
    <a href="https://supabase.com/docs/guides/realtime">Guides</a>
    ·
    <a href="https://supabase.com/docs/reference/javascript">Reference Docs</a>
    ·
    <a href="https://multiplayer.dev">Multiplayer Demo</a>
  </p>
</p>

<div align="center">

[![Build](https://github.com/supabase/supabase-js/workflows/CI/badge.svg)](https://github.com/supabase/supabase-js/actions?query=branch%3Amaster)
[![Package](https://img.shields.io/npm/v/@supabase/realtime-js)](https://www.npmjs.com/package/@supabase/realtime-js)
[![License: MIT](https://img.shields.io/npm/l/@supabase/supabase-js)](#license)
[![pkg.pr.new](https://pkg.pr.new/badge/supabase/realtime-js)](https://pkg.pr.new/~/supabase/realtime-js)

</div>

# Overview

This SDK enables you to use the following Supabase Realtime's features:

- **Broadcast**: send ephemeral messages from client to clients with minimal latency. Use cases include sharing cursor positions between users.
- **Presence**: track and synchronize shared state across clients with the help of CRDTs. Use cases include tracking which users are currently viewing a specific webpage.
- **Postgres Change Data Capture (CDC)**: listen for changes in your PostgreSQL database and send them to clients.

# Usage

## Installing the Package

```bash
npm install @supabase/realtime-js
```

## Creating a Channel

```js
import { RealtimeClient } from '@supabase/realtime-js'

const client = new RealtimeClient(REALTIME_URL, {
  params: {
    apikey: API_KEY,
  },
})

const channel = client.channel('test-channel', {})

channel.subscribe((status, err) => {
  if (status === 'SUBSCRIBED') {
    console.log('Connected!')
  }

  if (status === 'CHANNEL_ERROR') {
    console.log(`There was an error subscribing to channel: ${err.message}`)
  }

  if (status === 'TIMED_OUT') {
    console.log('Realtime server did not respond in time.')
  }

  if (status === 'CLOSED') {
    console.log('Realtime channel was unexpectedly closed.')
  }
})
```

### Notes:

- `REALTIME_URL` is `'ws://localhost:4000/socket'` when developing locally and `'wss://<project_ref>.supabase.co/realtime/v1'` when connecting to your Supabase project.
- `API_KEY` is a JWT whose claims must contain `exp` and `role` (existing database role).
- Channel name can be any `string`.
- Setting `private` to `true` means that the client will use RLS to determine if the user can connect or not to a given channel.

## Broadcast

Your client can send and receive messages based on the `event`.

```js
// Setup...

const channel = client.channel('broadcast-test', { broadcast: { ack: false, self: false } })

channel.on('broadcast', { event: 'some-event' }, (payload) => console.log(payload))

channel.subscribe(async (status) => {
  if (status === 'SUBSCRIBED') {
    // Send message to other clients listening to 'broadcast-test' channel
    await channel.send({
      type: 'broadcast',
      event: 'some-event',
      payload: { hello: 'world' },
    })
  }
})
```

### Notes:

- Setting `ack` to `true` means that the `channel.send` promise will resolve once server replies with acknowledgment that it received the broadcast message request.
- Setting `self` to `true` means that the client will receive the broadcast message it sent out.

### Broadcast Replay

Broadcast Replay enables **private** channels to access messages that were sent earlier. Only messages published via [Broadcast From the Database](https://supabase.com/docs/guides/realtime/broadcast#trigger-broadcast-messages-from-your-database) are available for replay.

You can configure replay with the following options:

- **`since`** (Required): The epoch timestamp in milliseconds, specifying the earliest point from which messages should be retrieved.
- **`limit`** (Optional): The number of messages to return. This must be a positive integer, with a maximum value of 25.

Example:

```typescript
const twelveHours = 12 * 60 * 60 * 1000
const twelveHoursAgo = Date.now() - twelveHours

const config = { private: true, broadcast: { replay: { since: twelveHoursAgo, limit: 10 } } }

supabase
  .channel('main:room', { config })
  .on('broadcast', { event: 'my_event' }, (payload) => {
    if (payload?.meta?.replayed) {
      console.log('This message was sent earlier:', payload)
    } else {
      console.log('This is a new message', payload)
    }
    // ...
  })
  .subscribe()
```

## Presence

Your client can track and sync state that's stored in the channel.

```js
// Setup...

const channel = client.channel('presence-test', {
  config: {
    presence: {
      key: '',
    },
  },
})

channel.on('presence', { event: 'sync' }, () => {
  console.log('Online users: ', channel.presenceState())
})

channel.on('presence', { event: 'join' }, ({ newPresences }) => {
  console.log('New users have joined: ', newPresences)
})

channel.on('presence', { event: 'leave' }, ({ leftPresences }) => {
  console.log('Users have left: ', leftPresences)
})

channel.subscribe(async (status) => {
  if (status === 'SUBSCRIBED') {
    const status = await channel.track({ user_id: 1 })
    console.log(status)
  }
})
```

## Postgres CDC

Receive database changes on the client.

```js
// Setup...

const channel = client.channel('db-changes')

channel.on('postgres_changes', { event: '*', schema: 'public' }, (payload) => {
  console.log('All changes in public schema: ', payload)
})

channel.on(
  'postgres_changes',
  { event: 'INSERT', schema: 'public', table: 'messages' },
  (payload) => {
    console.log('All inserts in messages table: ', payload)
  }
)

channel.on(
  'postgres_changes',
  { event: 'UPDATE', schema: 'public', table: 'users', filter: 'username=eq.Realtime' },
  (payload) => {
    console.log('All updates on users table when username is Realtime: ', payload)
  }
)

channel.subscribe(async (status) => {
  if (status === 'SUBSCRIBED') {
    console.log('Ready to receive database changes!')
  }
})
```

### Filters

The `filter` option accepts **either** a raw string **or** a
`postgresChangesFilter()` builder — both produce the exact same wire format, so
you can mix and match and existing string filters keep working unchanged:

```js
// Raw string — always supported, fully backward compatible
{ event: 'UPDATE', schema: 'public', table: 'users', filter: 'id=eq.1' }

// Builder — type-checked, ergonomic; the SDK serializes it for you
{ event: 'UPDATE', schema: 'public', table: 'users', filter: postgresChangesFilter().eq('id', 1) }
```

A filter is a `column=operator.value` expression evaluated server-side. The
following operators are supported:

| Operator              | String form                  | Builder                                | Meaning                           |
| --------------------- | ---------------------------- | -------------------------------------- | --------------------------------- |
| `eq`                  | `id=eq.1`                    | `.eq('id', 1)`                         | equal                             |
| `neq`                 | `id=neq.1`                   | `.neq('id', 1)`                        | not equal                         |
| `lt` `lte` `gt` `gte` | `age=gte.18`                 | `.gte('age', 18)`                      | comparison                        |
| `in`                  | `status=in.(active,pending)` | `.in('status', ['active', 'pending'])` | in list                           |
| `like` `ilike`        | `title=like.%foo%`           | `.like('title', '%foo%')`              | pattern match (case in/sensitive) |
| `is`                  | `deleted_at=is.null`         | `.is('deleted_at', null)`              | `IS null/true/false/unknown`      |
| `match` `imatch`      | `title=match.^foo`           | `.match('title', '^foo')`              | POSIX regex match (`~` / `~*`)    |
| `isdistinct`          | `value=isdistinct.1`         | `.isDistinct('value', 1)`              | NULL-safe inequality              |

**Negation** — prefix any operator with `not.` (string) or use
`.not(column, operator, value)` (builder):

```js
// String
{ event: '*', schema: 'public', table: 'posts', filter: 'status=not.in.(draft,archived)' }

// Builder
{
  event: '*',
  schema: 'public',
  table: 'posts',
  filter: postgresChangesFilter().not('status', 'in', ['draft', 'archived']),
}
```

**AND composition** — multiple conditions are combined with commas and applied
as an `AND`. With the builder you just chain calls:

```js
// String
{ event: 'UPDATE', schema: 'public', table: 'orders', filter: 'amount=gt.100,status=in.(open,pending)' }

// Builder — equivalent, chained
{
  event: 'UPDATE',
  schema: 'public',
  table: 'orders',
  filter: postgresChangesFilter().gt('amount', 100).in('status', ['open', 'pending']),
}
```

#### Building filters with `postgresChangesFilter()`

The builder (modeled on the `postgrest-js` filter methods) is the recommended,
type-checked way to compose filters — but it is entirely optional; raw strings
remain fully supported.

```js
import { postgresChangesFilter } from '@supabase/realtime-js'

channel.on(
  'postgres_changes',
  {
    event: 'UPDATE',
    schema: 'public',
    table: 'orders',
    // → 'amount=gt.100,status=not.in.(draft,archived)'
    filter: postgresChangesFilter().gt('amount', 100).not('status', 'in', ['draft', 'archived']),
  },
  (payload) => console.log(payload)
)
```

The builder exposes `eq`, `neq`, `gt`, `gte`, `lt`, `lte`, `in`, `like`,
`ilike`, `match`, `imatch`, `is`, `isDistinct` and `not`. Call `.build()` if you
need the raw string yourself (e.g. to log it or store it).

**Values are sent verbatim** — the server has no quoting/escaping, so spaces and
quotes are preserved as-is. The server separates conditions by commas outside
parentheses, so a literal comma in a scalar value can't be expressed (commas
inside `in.(…)` are fine); the builder throws on such values rather than
silently producing a broken filter.

> **Note for PostgREST users:** Realtime evaluates filters server-side over a
> single table's WAL — there is no resource embedding (`!inner`, embedded
> filters) and no `or()` grouping. Use `%` (not `*`) for `like`/`ilike`
> wildcards, since filters travel in the WebSocket payload rather than a URL.

### Selecting columns

Use `select` to receive only a subset of columns instead of the full row. This
reduces payload size (helpful for large `bytea`/`jsonb` columns). The selected
columns must be selectable by the subscribing role:

```js
channel.on(
  'postgres_changes',
  { event: '*', schema: 'public', table: 'users', select: ['id', 'first_name'] },
  (payload) => {
    // payload.new only contains { id, first_name }
    console.log(payload)
  }
)
```

## Get All Channels

You can see all the channels that your client has instantiatied.

```js
// Setup...

client.getChannels()
```

## Cleanup

It is highly recommended that you clean up your channels after you're done with them.

- Remove a single channel

```js
// Setup...

const channel = client.channel('some-channel-to-remove')

channel.unsubscribe()
client.removeChannel(channel)
```

- Remove all channels and close the connection

```js
// Setup...

client.removeAllChannels()
client.disconnect()
```

## Development

This package is part of the [Supabase JavaScript monorepo](https://github.com/supabase/supabase-js). To work on this package:

### Building

```bash
# Complete build (from monorepo root)
pnpm nx build realtime-js

# Build with watch mode for development
pnpm nx build realtime-js --watch

# Individual build targets
pnpm nx build:main realtime-js    # CommonJS build (dist/main/)
pnpm nx build:module realtime-js  # ES Modules build (dist/module/)

# Other useful commands
pnpm nx clean realtime-js         # Clean build artifacts
pnpm nx lint realtime-js          # Run ESLint
pnpm nx typecheck realtime-js     # TypeScript type checking
```

#### Build Outputs

- **CommonJS (`dist/main/`)** - For Node.js environments
- **ES Modules (`dist/module/`)** - For modern bundlers (Webpack, Vite, Rollup)
- **TypeScript definitions (`dist/module/index.d.ts`)** - Type definitions for TypeScript projects

Note: Unlike some other packages, realtime-js doesn't include a UMD build since it's primarily used in Node.js or bundled applications.

#### Validating Package Exports

```bash
# Check if package exports are correctly configured
pnpm nx check-exports realtime-js
```

This command uses ["Are the types wrong?"](https://github.com/arethetypeswrong/arethetypeswrong.github.io) to verify that the package exports work correctly in different environments. Run this before publishing to ensure your package can be imported correctly by all consumers.

### Testing

**No Docker or Supabase instance required!** The realtime-js tests use mocked WebSocket connections, so they're completely self-contained.

```bash
# Run unit tests (from monorepo root)
pnpm nx test realtime-js

# Run tests with coverage report
pnpm nx test:coverage realtime-js

# Run tests in watch mode during development
pnpm nx test:watch realtime-js
```

#### Test Scripts Explained

- **test** - Runs all unit tests once using Vitest
- **test:coverage** - Runs tests and generates coverage report with terminal output
- **test:watch** - Runs tests in interactive watch mode for development

The tests mock WebSocket connections using `mock-socket`, so you can run them anytime without any external dependencies.

### Contributing

We welcome contributions! Please see our [Contributing Guide](../../../CONTRIBUTING.md) for details on how to get started.

For major changes or if you're unsure about something, please open an issue first to discuss your proposed changes.

## Credits

This repo draws heavily from [phoenix-js](https://github.com/phoenixframework/phoenix/tree/master/assets/js/phoenix).

## License

MIT.
