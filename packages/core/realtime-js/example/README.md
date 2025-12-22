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

Go to the [SQL Editor](https://supabase.com/dashboard/project/_/sql) in your Supabase dashboard and run the migration:

```sql
-- Copy contents from: supabase/migrations/001_create_messages_table.sql

CREATE TABLE public.messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  room TEXT NOT NULL,
  username TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read messages" ON public.messages
  FOR SELECT USING (true);

CREATE POLICY "Anyone can insert messages" ON public.messages
  FOR INSERT WITH CHECK (true);

CREATE INDEX idx_messages_room ON public.messages(room, created_at DESC);

-- Enable Realtime on the messages table
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
```

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

## Local Development (Optional)

You can run Supabase locally using the Supabase CLI and Docker.

### Prerequisites

- [Docker](https://docs.docker.com/get-docker/) installed and running
- [Supabase CLI](https://supabase.com/docs/guides/cli) installed

```bash
npm install -g supabase
```

### 1. Start Supabase

```bash
supabase start
```

This will start all Supabase services locally. Once started, you'll see output with your local credentials:

```
         API URL: http://127.0.0.1:54321
     GraphQL URL: http://127.0.0.1:54321/graphql/v1
  S3 Storage URL: http://127.0.0.1:54321/storage/v1/s3
         MCP URL: http://127.0.0.1:54321/mcp
    Database URL: postgresql://postgres:postgres@127.0.0.1:54322/postgres
      Studio URL: http://127.0.0.1:54323
     Mailpit URL: http://127.0.0.1:54324
 Publishable key: sb_publishable_..........
      Secret key: sb_secret_.........
   S3 Access Key: .....
   S3 Secret Key: .....
       S3 Region: local
```

### 2. Configure Environment

Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

Update the values:

````env
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<your-local-publishable-key>

### 3. Run Migrations

Apply the database migration:

```bash
supabase db reset
````

This will apply all migrations from `supabase/migrations/`.

````

### 5. Access Local Dashboard

Open [http://127.0.0.1:54323](http://127.0.0.1:54323) to access Supabase Studio locally. Here you can:

- View and edit data in the Table Editor
- Run SQL queries
- Monitor Realtime connections
- Check logs

### Stopping Supabase

```bash
supabase stop
````
