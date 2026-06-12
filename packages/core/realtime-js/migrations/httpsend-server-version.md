# `httpSend()` server version requirement

**Since:** v2.107.0
**Applies to:** anyone calling `RealtimeChannel.httpSend()` (or `RealtimeChannel.broadcast()` configured to use HTTP)

`httpSend()` sends broadcast events through a per-event REST endpoint:

```
POST /api/broadcast/:topic/events/:event
```

This endpoint was added in **Realtime server v2.97.0** ([supabase/realtime#1864](https://github.com/supabase/realtime/pull/1864)). It also enables binary broadcast payloads (`application/octet-stream`), which the older batch endpoint does not support.

## What changed

- `httpSend()` calls the new per-event endpoint and expects HTTP `202`.
- On `404`, the client now rejects with a message that names the requirement and the escape hatches (see below) instead of returning the generic `Not Found` text from the server.
- The original `RealtimeChannel.send()` (and its REST fallback) still target the older `POST /api/broadcast` batch endpoint and are unaffected.

## Who is affected

You are affected if **all** of the following are true:

1. You upgraded `@supabase/realtime-js` (or `@supabase/supabase-js`) to **v2.107.0 or later**, **and**
2. You call `httpSend()` (or `broadcast()` with `type: 'broadcast'` routed through HTTP), **and**
3. Your Realtime server is **older than v2.97.0**.

If you only use the WebSocket `send()` API, or your Realtime server is already on v2.97.0+, nothing changes for you.

## How to verify the server version

The Realtime server does not currently emit a version header, so the easiest checks are:

- **Hosted Supabase:** version is rolled forward continuously and is on v2.97.0+.
- **Local development with the Supabase CLI:** recent CLI versions bundle Realtime v2.97.0+. Update the CLI to the latest stable.
- **Self-hosted:** check the `image:` tag of the Realtime container in your `docker-compose.yml`.

## What to do

### If you are on a recent Supabase CLI

You should already be on a compatible Realtime version. If you still see the 404 error, update the CLI:

```bash
# macOS / Homebrew
brew upgrade supabase/tap/supabase

# npm
npm install -g supabase

# scoop / etc — see https://supabase.com/docs/guides/local-development
```

Then restart the local Supabase stack.

### If you need to pin a specific Realtime version locally

The CLI honors a per-project pin file. Create the file with the desired image tag:

```bash
mkdir -p supabase/.temp
echo "v2.97.3" > supabase/.temp/realtime-version
supabase stop && supabase start
```

(This is the same mechanism the `@supabase/supabase-js` test harness uses internally.)

### If you self-host

Bump the Realtime image in your deployment to `v2.97.3` or newer:

```yaml
services:
  realtime:
    image: supabase/realtime:v2.97.3
```

### If you cannot update the server right now

Downgrade `@supabase/realtime-js` (and `@supabase/supabase-js`) back to **v2.106.x**, which only uses the older `POST /api/broadcast` batch endpoint:

```bash
npm install @supabase/supabase-js@2.106.2
```

## Why the message is more specific now

Prior to this release, a 404 from the new endpoint surfaced as a plain `Not Found` error, which was hard to act on. The client now rejects with a message that points at this migration file and the escape hatches above.
