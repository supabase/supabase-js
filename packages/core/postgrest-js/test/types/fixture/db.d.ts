// Hand-written stand-in for what the mapper would emit, modelled on the postgrest-js test schema.
import type { SupabaseColumnType } from '../../../src/index'

export type Json = string | number | boolean | null | { [k: string]: Json | undefined } | Json[]
// what `const` inference makes of a literal argument: readonly arrays and objects
export type JsonIn =
  | string
  | number
  | boolean
  | null
  | { readonly [k: string]: JsonIn | undefined }
  | readonly JsonIn[]
type Status = 'ONLINE' | 'OFFLINE'
// a composite type: `address` columns return an object even when every attribute is NULL
export type Address = { street: string | null; city: string | null }
type Ident<K extends string> = { [P in K]: P }
// FactColumns: columns whose returned value is the stored value (no jsonb, no composite, no representation)
type UserFacts = 'username' | 'status' | 'age_range' | 'catchphrase'
type ChannelFacts = 'id' | 'slug'
type MessageFacts = 'id' | 'message' | 'username' | 'channel_id'

type UserRow = {
  username: string
  status: Status | null
  age_range: string | null
  catchphrase: string | null
  // the column's own nullability sits outside the wrapper: an override can't drop it
  data: SupabaseColumnType<'public.users.data', Json> | null
}
type ChannelRow = {
  id: number
  slug: string | null
  data: SupabaseColumnType<'public.channels.data', Json> | null
  address: Address | null
}
type MessageRow = {
  id: number
  message: string | null
  username: string
  channel_id: number
  data: SupabaseColumnType<'public.messages.data', Json> | null
}

declare global {
  interface SupabaseDatabase {
    public: {
      Tables: {
        users: {
          Row: UserRow
          Insert: { username: string; status?: Status | null; data?: UserRow['data'] }
          Update: { username?: string; status?: Status | null; data?: UserRow['data'] }
          FactColumns: UserFacts
          Relationships: []
        }
        channels: {
          Row: ChannelRow
          Insert: { id?: number; slug?: string | null }
          Update: { id?: number; slug?: string | null }
          FactColumns: ChannelFacts
          Relationships: []
        }
        messages: {
          Row: MessageRow
          Insert: { id?: number; message?: string | null; username: string; channel_id: number }
          Update: { id?: number; message?: string | null; username?: string; channel_id?: number }
          FactColumns: MessageFacts
          Relationships: []
        }
      }
      Views: {}
      Functions: {
        // zero-arg functions are generated as `Args: Record<string, never>`
        get_online_users: { Args: Record<string, never>; Returns: UserRow[] }
        // a union of argument objects: each member is dispatched on its own
        poly:
          | { Args: { a: string }; Returns: { a_id: number }[] }
          | { Args: { b: number }; Returns: { b_name: string }[] }
          | { Args: Record<string, never>; Returns: number }
        poly_mixed:
          | { Args: { a: string }; Returns: { a_id: number }[] }
          | { Args: { b: number }; Returns: string }
        poly_err:
          | { Args: { a: string }; Returns: { a_id: number }[] }
          | { Args: { b: number }; Returns: { b_name: string }[] }
        // an optional argument: the runtime drops it when undefined, so both key sets are possible
        find_messages: { Args: { cid: number; search?: string }; Returns: MessageRow[] }
        find_partial: { Args: { cid: number; search?: string }; Returns: MessageRow[] }
        // seven optional arguments: 128 key sets, past the planner's cap of 64
        many_optional: {
          Args: {
            a?: number
            b?: number
            c?: number
            d?: number
            e?: number
            f?: number
            g?: number
          }
          Returns: MessageRow[]
        }
        ping: { Args: { n: number }; Returns: undefined }
        get_status: { Args: { name_param: string }; Returns: Status | null }
        get_user_messages: { Args: { user_name: string }; Returns: MessageRow[] }
        // a composite return (single) and RETURNS TABLE (setof)
        get_address: { Args: { id: number }; Returns: Address }
        rank_users: { Args: { n: number }; Returns: { username: string; msg_count: number }[] }
        // argument unions whose calls return different relations
        poly_src:
          | { Args: { a: string }; Returns: { shared: number; only_a: string }[] }
          | { Args: { b: number }; Returns: { shared: string }[] }
        // GET / HEAD refuse object values, operator-looking strings and reserved keys (JSON values, reserved keys)
        probe: { Args: { v: JsonIn }; Returns: string }
        probe_opt: { Args: { a: number; v?: JsonIn }; Returns: string }
        polymorphic_function_with_unnamed_jsonb: { Args: { '': JsonIn }; Returns: string }
        paged: { Args: { limit: number }; Returns: string }
        dotted: { Args: { 'x.order': number }; Returns: string }
        selector: { Args: { select: number }; Returns: string }
        sorted: { Args: { sort_order: number }; Returns: string }
        colors: { Args: { color: number; ordered: number }; Returns: string }
        post_only: { Args: { n: number }; Returns: string }
        postgrest_unresolvable_function:
          | { Args: { a: string }; Returns: undefined }
          | { Args: { a: number }; Returns: undefined }
      }
      Enums: { user_status: Status }
    }
  }

  interface SupabaseSelects {
    // ---- users, plain projections (every field has a source)
    'r|public|users|username': {
      row: { username: string }
      sources: { username: 'username' }
      embeds: {}
    }
    'r|public|users|username, status': {
      row: { username: string; status: Status | null }
      sources: { username: 'username'; status: 'status' }
      embeds: {}
    }
    'r|public|users|status': {
      row: { status: Status | null }
      sources: { status: 'status' }
      embeds: {}
    }
    'r|public|users|username, age_range': {
      row: { username: string; age_range: string | null }
      sources: { username: 'username'; age_range: 'age_range' }
      embeds: {}
    }
    'r|public|users|username, catchphrase': {
      row: { username: string; catchphrase: string | null }
      sources: { username: 'username'; catchphrase: 'catchphrase' }
      embeds: {}
    }
    // alias: the field is `s`, its source is `status`
    'r|public|users|s:status': {
      row: { s: Status | null }
      sources: { s: 'status' }
      embeds: {}
    }
    // aggregate: no source
    'r|public|users|username, status.max()': {
      row: { username: string; max: Status | null }
      sources: { username: 'username' }
      embeds: {}
    }
    // planner rejected
    'r|public|users|username, nope(id)': {
      error: "PGRST200 at `nope`: Could not find a relationship between 'users' and 'nope' in the schema cache. Hint: Perhaps you meant 'messages' instead of 'nope'."
    }
    // overrides (§5.3 ordering)
    'r|public|users|username, data': {
      row: { username: string; data: SupabaseColumnType<'public.users.data', Json> | null }
      sources: { username: 'username' }
      embeds: {}
    }
    'r|public|users|username, data::text': {
      row: { username: string; data: string | null }
      sources: { username: 'username' }
      embeds: {}
    }
    // spread through a left join: the null is outside the wrapper
    'r|public|messages|id, ...users(data)': {
      row: { id: number; data: SupabaseColumnType<'public.users.data', Json> | null }
      sources: { id: 'id' }
      embeds: {}
    }

    // ---- the same select string on two relations (union of relations)
    'r|public|messages|username, data': {
      row: { username: string; data: SupabaseColumnType<'public.messages.data', Json> | null }
      sources: { username: 'username' }
      embeds: {}
    }
    'r|public|messages|username': {
      row: { username: string }
      sources: { username: 'username' }
      embeds: {}
    }
    // users has no channels
    'r|public|users|id, channels(id)': {
      error: "PGRST200 at `channels`: Could not find a relationship between 'users' and 'channels' in the schema cache."
    }

    // ---- spreads: the embed's nullability lands on the flattened fields (`outputs`)
    'r|public|messages|id, ...channels(channel_key:id)': {
      row: { id: number; channel_key: number }
      sources: { id: 'id' }
      embeds: {
        channels: {
          path: ['channels']
          outputs: [['channel_key']]
          join: 'left'
          cardinality: 'one'
        }
      }
    }
    // a spread field that is nullable on its own
    'r|public|messages|id, ...channels(slug)': {
      row: { id: number; slug: string | null }
      sources: { id: 'id' }
      embeds: {
        channels: { path: ['channels']; outputs: [['slug']]; join: 'left'; cardinality: 'one' }
      }
    }

    // ---- messages with embeds
    'r|public|messages|id': {
      row: { id: number }
      sources: { id: 'id' }
      embeds: {}
    }
    'r|public|messages|id, channels(id)': {
      row: { id: number; channels: { id: number } }
      sources: { id: 'id' }
      embeds: {
        channels: { path: ['channels']; outputs: [['channels']]; join: 'left'; cardinality: 'one' }
      }
    }
    'r|public|messages|id, channels!inner(id)': {
      row: { id: number; channels: { id: number } }
      sources: { id: 'id' }
      embeds: {
        channels: { path: ['channels']; outputs: [['channels']]; join: 'inner'; cardinality: 'one' }
      }
    }
    'r|public|messages|id, users(username)': {
      // nullable FK would be `| null` already; here a to-many embed for the cardinality check
      row: { id: number; users: { username: string }[] }
      sources: { id: 'id' }
      embeds: {
        users: { path: ['users']; outputs: [['users']]; join: 'left'; cardinality: 'many' }
      }
    }
    // alias on an embed: the result key (and the operand's embed path) is the alias
    'r|public|messages|id, chan:channels(id)': {
      row: { id: number; chan: { id: number } }
      sources: { id: 'id' }
      embeds: { chan: { path: ['chan']; outputs: [['chan']]; join: 'left'; cardinality: 'one' } }
    }
    // nested: to-many messages, each with a to-one channel; embeds keyed by the joined path
    'r|public|users|username, messages(id, channels(id))': {
      row: { username: string; messages: { id: number; channels: { id: number } }[] }
      sources: { username: 'username' }
      embeds: {
        messages: { path: ['messages']; outputs: [['messages']]; join: 'left'; cardinality: 'many' }
        'messages.channels': {
          path: ['messages', 'channels']
          outputs: [['messages', 'channels']]
          join: 'left'
          cardinality: 'one'
        }
      }
    }
    'r|public|channels|id, messages(id)': {
      row: { id: number; messages: { id: number }[] }
      sources: { id: 'id' }
      embeds: {
        messages: { path: ['messages']; outputs: [['messages']]; join: 'left'; cardinality: 'many' }
      }
    }

    // ---- mutation representations (`w` keys)
    'w|public|users|status': {
      row: { status: Status | null }
      sources: { status: 'status' }
      embeds: {}
    }
    'w|public|users|username, status': {
      row: { username: string; status: Status | null }
      sources: { username: 'username'; status: 'status' }
      embeds: {}
    }
    'w|public|messages|id, channels(id)': {
      row: { id: number; channels: { id: number } }
      sources: { id: 'id' }
      embeds: {
        channels: { path: ['channels']; outputs: [['channels']]; join: 'left'; cardinality: 'one' }
      }
    }
    'w|public|users|username, nope(id)': {
      error: "PGRST200 at `nope`: Could not find a relationship between 'users' and 'nope' in the schema cache."
    }

    // ---- rpc
    'f|public|get_status|*': {
      calls: [
        {
          keys: 'name_param'
          method: 'POST'
          form: 'single-scalar'
          row: Status | null
          source: never
        },
        // fixture-only: a distinguishable GET call, to prove `{ get: true }` selects it
        { keys: 'name_param'; method: 'GET'; form: 'single-scalar'; row: Status; source: never },
      ]
    }
    'f|public|get_user_messages|*': {
      calls: [
        {
          keys: 'user_name'
          method: 'POST'
          form: 'rows'
          row: MessageRow
          source: { row: MessageRow; sources: Ident<MessageFacts> }
        },
      ]
    }
    'f|public|get_user_messages|id': {
      calls: [
        {
          keys: 'user_name'
          method: 'POST'
          form: 'rows'
          row: { id: number }
          source: { row: MessageRow; sources: Ident<MessageFacts> }
        },
      ]
    }
    'f|public|get_online_users|*': {
      calls: [
        {
          keys: never
          method: 'POST'
          form: 'rows'
          row: UserRow
          source: { row: UserRow; sources: Ident<UserFacts> }
        },
        // fixture-only: facts apply on every method
        {
          keys: never
          method: 'GET'
          form: 'rows'
          row: UserRow
          source: { row: UserRow; sources: Ident<UserFacts> }
        },
      ]
    }
    'f|public|poly|*': {
      calls: [
        { keys: 'a'; method: 'POST'; form: 'rows'; row: { a_id: number }; source: never },
        { keys: 'b'; method: 'POST'; form: 'rows'; row: { b_name: string }; source: never },
        { keys: never; method: 'POST'; form: 'single-scalar'; row: number; source: never },
      ]
    }
    'f|public|poly_mixed|*': {
      calls: [
        { keys: 'a'; method: 'POST'; form: 'rows'; row: { a_id: number }; source: never },
        { keys: 'b'; method: 'POST'; form: 'single-scalar'; row: string; source: never },
      ]
    }
    'f|public|poly_err|*': {
      calls: [
        { keys: 'a'; method: 'POST'; form: 'rows'; row: { a_id: number }; source: never },
        {
          keys: 'b'
          method: 'POST'
          error: 'PGRST202 Could not find the function public.poly_err(b) in the schema cache'
        },
      ]
    }
    // `search` is optional: a call per possible key set
    'f|public|find_messages|*': {
      calls: [
        {
          keys: 'cid'
          method: 'POST'
          form: 'rows'
          row: { id: number }
          source: { row: MessageRow; sources: Ident<MessageFacts> }
        },
        {
          keys: 'cid' | 'search'
          method: 'POST'
          form: 'rows'
          row: { id: number; rank: number }
          source: { row: MessageRow; sources: Ident<MessageFacts> }
        },
      ]
    }
    // the `cid | search` key set was never planned
    'f|public|find_partial|*': {
      calls: [
        {
          keys: 'cid'
          method: 'POST'
          form: 'rows'
          row: { id: number }
          source: { row: MessageRow; sources: Ident<MessageFacts> }
        },
      ]
    }
    // HEAD and POST both planned: `{ head: boolean }` sends either
    'f|public|ping|*': {
      calls: [
        { keys: 'n'; method: 'HEAD'; form: 'single-scalar'; row: null; source: never },
        { keys: 'n'; method: 'POST'; form: 'single-scalar'; row: null; source: never },
      ]
    }
    // a composite return: one row, its attributes are fact columns
    'f|public|get_address|*': {
      calls: [
        {
          keys: 'id'
          method: 'POST'
          form: 'single-row'
          row: Address
          source: { row: Address; sources: Ident<'street' | 'city'> }
        },
      ]
    }
    // RETURNS TABLE: rows
    'f|public|rank_users|*': {
      calls: [
        {
          keys: 'n'
          method: 'POST'
          form: 'rows'
          row: { username: string; msg_count: number }
          source: {
            row: { username: string; msg_count: number }
            sources: Ident<'username' | 'msg_count'>
          }
        },
      ]
    }
    // each call has its own source
    'f|public|poly_src|*': {
      calls: [
        {
          keys: 'a'
          method: 'POST'
          form: 'rows'
          row: { shared: number; only_a: string }
          source: { row: { shared: number; only_a: string }; sources: Ident<'shared' | 'only_a'> }
        },
        {
          keys: 'b'
          method: 'POST'
          form: 'rows'
          row: { shared: string }
          source: { row: { shared: string }; sources: Ident<'shared'> }
        },
      ]
    }
    // distinguishable rows per method; HEAD is a planner error, so a call that can send HEAD is rejected
    'f|public|probe|*': {
      calls: [
        { keys: 'v'; method: 'GET'; form: 'single-scalar'; row: 'get'; source: never },
        { keys: 'v'; method: 'POST'; form: 'single-scalar'; row: 'post'; source: never },
        {
          keys: 'v'
          method: 'HEAD'
          error: 'PGRST202 Could not find the function public.probe(v) in the schema cache (HEAD)'
        },
      ]
    }
    // an optional argument: a call per key set and method
    'f|public|probe_opt|*': {
      calls: [
        { keys: 'a'; method: 'GET'; form: 'single-scalar'; row: 'get-a'; source: never },
        { keys: 'a'; method: 'POST'; form: 'single-scalar'; row: 'post-a'; source: never },
        { keys: 'a' | 'v'; method: 'GET'; form: 'single-scalar'; row: 'get-av'; source: never },
        { keys: 'a' | 'v'; method: 'POST'; form: 'single-scalar'; row: 'post-av'; source: never },
      ]
    }
    // the unnamed jsonb parameter: every method planned, so only the argument check can refuse an object under HEAD
    'f|public|polymorphic_function_with_unnamed_jsonb|*': {
      calls: [
        { keys: ''; method: 'GET'; form: 'single-scalar'; row: 'get'; source: never },
        { keys: ''; method: 'POST'; form: 'single-scalar'; row: 'post'; source: never },
        { keys: ''; method: 'HEAD'; form: 'single-scalar'; row: 'head'; source: never },
      ]
    }
    // reserved keys: planned for every method, the argument check refuses them under GET and HEAD
    'f|public|paged|*': {
      calls: [
        { keys: 'limit'; method: 'GET'; form: 'single-scalar'; row: 'get'; source: never },
        { keys: 'limit'; method: 'POST'; form: 'single-scalar'; row: 'post'; source: never },
      ]
    }
    'f|public|dotted|*': {
      calls: [
        { keys: 'x.order'; method: 'GET'; form: 'single-scalar'; row: 'get'; source: never },
        { keys: 'x.order'; method: 'POST'; form: 'single-scalar'; row: 'post'; source: never },
      ]
    }
    'f|public|selector|*': {
      calls: [
        { keys: 'select'; method: 'GET'; form: 'single-scalar'; row: 'get'; source: never },
        { keys: 'select'; method: 'POST'; form: 'single-scalar'; row: 'post'; source: never },
      ]
    }
    // not reserved: only the last `.`-separated segment counts, and it must be exact
    'f|public|sorted|*': {
      calls: [
        { keys: 'sort_order'; method: 'GET'; form: 'single-scalar'; row: 'get'; source: never },
        { keys: 'sort_order'; method: 'POST'; form: 'single-scalar'; row: 'post'; source: never },
      ]
    }
    'f|public|colors|*': {
      calls: [
        {
          keys: 'color' | 'ordered'
          method: 'GET'
          form: 'single-scalar'
          row: 'get'
          source: never
        },
        {
          keys: 'color' | 'ordered'
          method: 'POST'
          form: 'single-scalar'
          row: 'post'
          source: never
        },
      ]
    }
    // planned for POST only: the exact method decides, so `{ get: true }` is unplanned
    'f|public|post_only|*': {
      calls: [{ keys: 'n'; method: 'POST'; form: 'single-scalar'; row: 'post'; source: never }]
    }
    // overloads with the same argument names: PostgREST can't choose
    'f|public|postgrest_unresolvable_function|*': {
      calls: [
        {
          keys: 'a'
          method: 'POST'
          error: 'PGRST203 Could not choose the best candidate function between: public.postgrest_unresolvable_function(a => integer), public.postgrest_unresolvable_function(a => text). Hint: Try renaming the parameters or the function itself in the database so function overloading can be resolved'
        },
      ]
    }
  }

  interface SupabaseOperands {
    // spreads: the operand's embed path is the embed's identity path, not the flattened field
    'r|public|messages|id, ...channels(channel_key:id)|channels.id': {
      type: number
      embed: ['channels']
    }
    'r|public|messages|id, ...channels(channel_key:id)|channels': {
      type: unknown
      embed: ['channels']
    }
    'r|public|messages|id, ...channels(slug)|channels.id': { type: number; embed: ['channels'] }
    'r|public|messages|id, ...channels(slug)|channels': { type: unknown; embed: ['channels'] }
    // rpc operands: matched by the same dispatch as the call, value type = union over the possible calls
    'f|public|find_messages|*|channels.id': {
      calls: [
        { keys: 'cid'; method: 'POST'; type: number; embed: ['channels'] },
        { keys: 'cid' | 'search'; method: 'POST'; type: string; embed: ['channels'] },
      ]
    }
    'f|public|find_messages|*|channels.slug': {
      calls: [
        { keys: 'cid'; method: 'POST'; type: string; embed: ['channels'] },
        {
          keys: 'cid' | 'search'
          method: 'POST'
          error: "PGRST108 at `channels`: 'channels' is not an embedded resource in this request."
        },
      ]
    }
    'f|public|find_partial|*|channels.id': {
      calls: [{ keys: 'cid'; method: 'POST'; type: number; embed: ['channels'] }]
    }
    'r|public|messages|id, channels(id)|channels.id': {
      type: SupabaseColumnType<'public.channels.id', number>
      embed: ['channels']
    }
    'w|public|messages|id, channels(id)|channels.id': { type: number; embed: ['channels'] }
    'r|public|messages|id, chan:channels(id)|chan': { type: unknown; embed: ['chan'] }
    'r|public|messages|id, chan:channels(id)|chan.id': { type: number; embed: ['chan'] }
    'r|public|users|username, messages(id, channels(id))|messages.channels.id': {
      type: number
      embed: ['messages', 'channels']
    }
    'r|public|users|username, messages(id, channels(id))|messages.id': {
      type: number
      embed: ['messages']
    }
    // the embed itself (`.not('channels', 'is', null)`)
    'r|public|messages|id, channels(id)|channels': { type: unknown; embed: ['channels'] }
    'r|public|messages|id, channels!inner(id)|channels.id': {
      type: SupabaseColumnType<'public.channels.id', number>
      embed: ['channels']
    }
    // the embed isn't in the select
    'r|public|messages|id|channels.id': {
      error: "PGRST108 at `channels`: 'channels' is not an embedded resource in this request. Hint: add channels(...) to the select."
    }
    // same JSON path operand on a root column
    'r|public|users|username, data|data->theme': { type: string }
  }

  interface SupabaseColumnTypes {
    'public.users.data': { theme: 'light' | 'dark' }
  }
}

export {}
