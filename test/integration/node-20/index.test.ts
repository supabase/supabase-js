import { describe, test, expect, beforeAll } from 'vitest'
import { createClient, REALTIME_CHANNEL_STATES, SupabaseClient } from '@supabase/supabase-js'
import type { RealtimeChannel, WebSocketLikeConstructor } from '@supabase/realtime-js'
import ws from 'ws'

const SUPABASE_URL = 'http://127.0.0.1:54321'
const ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'

const supabase: SupabaseClient = createClient(SUPABASE_URL, ANON_KEY, {
  realtime: { transport: ws as WebSocketLikeConstructor },
})

describe('realtime connection', () => {
  let channel: RealtimeChannel
  beforeAll(() => (channel = supabase.channel('realtime:server')))

  test('should connect to the server', async () => {
    let currentState
    channel.subscribe((state) => {
      console.log('state', state)
      currentState = state
    })
    await new Promise((resolve) => setTimeout(resolve, 4000))
    expect(currentState).toBe('SUBSCRIBED')
    expect(channel.state).toBe(REALTIME_CHANNEL_STATES.joined)
  })
})
