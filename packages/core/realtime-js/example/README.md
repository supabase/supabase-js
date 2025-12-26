# Realtime Chat Example

A minimal anonymous chat app showcasing Supabase Realtime features:

- **Broadcast** - Real-time message delivery
- **Presence** - Online user indicators
- **Database** - Message persistence

## Features

- Anonymous users with random usernames (stored in localStorage)
- 4 chat rooms: General, Random, Tech, Off-Topic
- Real-time messages
- Online users per room
- Message history on join

## Setup

### 1. Create a Supabase Project

Create a new project at [database.new](https://database.new)

### 2. Run the Database Migration

Go to the [SQL Editor](https://supabase.com/dashboard/project/_/sql) in your Supabase dashboard and run the migration you find in [supabase/migrations/001_create_messages_table.sql](packages/core/realtime-js/example/supabase/migrations/001_create_messages_table.sql).

### 3. Configure Environment Variables

Copy `.env.example` to `.env` and fill in your Supabase credentials:

```bash
cp .env.example .env
```

Update the values:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
```

Find these in your [Supabase project settings](https://supabase.com/dashboard/project/_/settings/api).

### 4. Install Dependencies

```bash
npm install
```

### 5. Run the App

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to start chatting.

## How It Works

### Broadcast

Messages are instantly delivered to all connected clients via Supabase Realtime Broadcast:

```typescript
channel.send({
  type: 'broadcast',
  event: 'message',
  payload: message,
})
```

### Presence

Online users are tracked using Supabase Realtime Presence:

```typescript
channel.on('presence', { event: 'sync' }, () => {
  const users = Object.values(channel.presenceState()).flat()
  setOnlineUsers(users)
})
```

### Persistence

Messages are also stored in the database so users see history when joining:

```typescript
const { data } = await supabase
  .from('messages')
  .select('*')
  .eq('room', room)
  .order('created_at', { ascending: true })
  .limit(50)
```

## Local Development

You can run Supabase locally using the Supabase CLI and Docker.

### Prerequisites

- [Docker](https://docs.docker.com/get-docker/) installed and running
- [Supabase CLI](https://supabase.com/docs/guides/cli) (installed or used through `npx`)

### 1. Start Supabase

```bash
npx supabase start
```

This will start all Supabase services locally. Once started, you'll see output with your local credentials:

```
╭──────────────────────────────────────╮
│ 🔧 Development Tools                 │
├─────────┬────────────────────────────┤
│ Studio  │ http://127.0.0.1:54323     │
│ ...     │ ...                        │
╰─────────┴────────────────────────────╯

╭──────────────────────────────────────────────╮
│ 🌐 APIs                                      │
├────────────────┬─────────────────────────────┤
│ Project URL    │ http://127.0.0.1:54321      │
│ ...            │ ...                         │
╰────────────────┴─────────────────────────────╯
...
╭──────────────────────────────────────────────────╮
│ 🔑 Authentication Keys                           │
├─────────────┬────────────────────────────────────┤
│ Publishable │ sb_publishable_...                 │
│ Secret      │ sb_secret_...                      │
╰─────────────┴────────────────────────────────────╯
...
```

### 2. Configure Environment

Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

Update the values:

```env
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_....
```

### 3. Run Migrations

Apply the database migration:

```bash
npx supabase db reset
```

This will apply all migrations from `supabase/migrations/`.

### 5. Access Local Dashboard

Open [http://127.0.0.1:54323](http://127.0.0.1:54323) to access Supabase Studio locally. Here you can:

- View and edit data in the Table Editor
- Run SQL queries
- Monitor Realtime connections
- Check logs

### Stopping Supabase

```bash
npx supabase stop
```
