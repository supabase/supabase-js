# Realtime Client

Listens to changes in a PostgreSQL Database and via websockets.

This is for usage with Supabase [Realtime](https://github.com/supabase/realtime) server.

## Usage

### Creating a Socket connection

You can set up one connection to be used across the whole app.

```js
import { RealtimeClient } from '@supabase/realtime-js'

var client = new RealtimeClient(process.env.REALTIME_URL)
client.connect()
```

REALTIME_URL is `'ws://localhost:4000/socket'` when developing locally and `'wss://<project_ref>.supabase.co/realtime/v1'` when connecting to your Supabase project.

You can pass in your JWT If you have enabled JWT authorization in Supabase [Realtime](https://github.com/supabase/realtime) server.

```js
import { RealtimeClient } from '@supabase/realtime-js'

var client = new RealtimeClient(process.env.REALTIME_URL, {
  params: { apikey: 'token123' },
})
client.connect()
```

See [Realtime: Websocket Connection Authorization](https://github.com/supabase/realtime#websocket-connection-authorization) for more information.

### Subscribing to events

You can listen to `INSERT`, `UPDATE`, `DELETE`, or all `*` events.

You can subscribe to events on the whole database, schema, table, or individual columns using `channel()`. Channels are multiplexed over the Socket connection.

To join a channel, you must provide the `topic`, where a topic is either:

- `realtime` - entire database
- `realtime:{schema}` - where `{schema}` is the Postgres Schema
- `realtime:{schema}:{table}` - where `{table}` is the Postgres table name
- `realtime:{schema}:{table}:{col}=eq.{val}` - where `{col}` is the column name, and `{val}` is the value which you want to match

**Examples**

```js
// Listen to events on the entire database.
var databaseChanges = client.channel('realtime:*')
databaseChanges.on('*', (e) => console.log(e))
databaseChanges.on('INSERT', (e) => console.log(e))
databaseChanges.on('UPDATE', (e) => console.log(e))
databaseChanges.on('DELETE', (e) => console.log(e))
databaseChanges.subscribe()

// Listen to events on a schema, using the format `realtime:{SCHEMA}`
var publicSchema = client.channel('realtime:public')
publicSchema.on('*', (e) => console.log(e))
publicSchema.on('INSERT', (e) => console.log(e))
publicSchema.on('UPDATE', (e) => console.log(e))
publicSchema.on('DELETE', (e) => console.log(e))
publicSchema.subscribe()

// Listen to events on a table, using the format `realtime:{SCHEMA}:{TABLE}`
var usersTable = client.channel('realtime:public:users')
usersTable.on('*', (e) => console.log(e))
usersTable.on('INSERT', (e) => console.log(e))
usersTable.on('UPDATE', (e) => console.log(e))
usersTable.on('DELETE', (e) => console.log(e))
usersTable.subscribe()

// Listen to events on a row, using the format `realtime:{SCHEMA}:{TABLE}:{COL}=eq.{VAL}`
var rowChanges = client.channel('realtime:public:users:id=eq.1')
rowChanges.on('*', (e) => console.log(e))
rowChanges.on('INSERT', (e) => console.log(e))
rowChanges.on('UPDATE', (e) => console.log(e))
rowChanges.on('DELETE', (e) => console.log(e))
rowChanges.subscribe()
```

**Removing a subscription**

You can unsubscribe from a topic using `channel.unsubscribe()`.

**Disconnect the socket**

Call `disconnect()` on the socket:

```js
let { error, data } = await client.disconnect()
```

**Duplicate Join Subscriptions**

While the client may join any number of topics on any number of channels, the client may only hold a single subscription for each unique topic at any given time. When attempting to create a duplicate subscription, the server will close the existing channel, log a warning, and spawn a new channel for the topic. The client will have their `channel.onClose` callbacks fired for the existing channel, and the new
channel join will have its receive hooks processed as normal.

**Channel Hooks**

```js
channel._onError(() => console.log('there was an error!'))
channel._onClose(() => console.log('the channel has gone away gracefully'))
```

- `onError` hooks are invoked if the socket connection drops, or the channel crashes on the server. In either case, a channel rejoin is attempted automatically in an exponential backoff manner.
- `onClose` hooks are invoked only in two cases. 1) the channel explicitly closed on the server, or 2). The client explicitly closed, by calling `channel.unsubscribe()`

**Subscription Hooks**

```js
publicSchema
  .subscribe()
  .receive('ok', () => console.log('Connected.'))
  .receive('error', () => console.log('Failed.'))
  .receive('timeout', () => console.log('Timed out, retrying.'))
```

## Credits

- Original Node.js client was made by Mario Campa of [phoenix-channels](github.com/mcampa/phoenix-client).
- API was made by authors of the [Phoenix Framework](http://www.phoenixframework.org/). See their website for complete list of authors.

## License

MIT. License is the same as [phoenix-channels](https://github.com/mcampa/phoenix-client) and [Phoenix Framework](https://phoenixframework.org/).
