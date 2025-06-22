import { Text, View } from 'react-native'
import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'

// Use environment variables with fallbacks for local development
const SUPABASE_URL = process.env.SUPABASE_URL || 'http://127.0.0.1:54321'
const ANON_KEY =
  process.env.SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'

console.log('Using Supabase URL:', SUPABASE_URL)
console.log('Using Supabase Key:', ANON_KEY.substring(0, 20) + '...')

const supabase = createClient(SUPABASE_URL, ANON_KEY, {
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
})

export default function Index() {
  const [realtimeStatus, setRealtimeStatus] = useState<string | null>(null)

  useEffect(() => {
    console.log('Setting up realtime connection...')
    console.log('Realtime URL:', supabase.realtime.endPoint)
    console.log('Realtime client:', supabase.realtime)

    // Check if we can access the WebSocket connection
    try {
      console.log('Realtime client properties:', Object.keys(supabase.realtime))
      console.log(
        'Realtime client methods:',
        Object.getOwnPropertyNames(Object.getPrototypeOf(supabase.realtime))
      )
    } catch (error) {
      console.log('Error accessing realtime client properties:', error)
    }

    // Use a simpler channel name for testing
    const channel = supabase.channel('test-channel')

    console.log('Created channel:', channel)
    console.log('Channel state:', channel.state)

    const subscription = channel.subscribe((status) => {
      console.log('Realtime status callback received:', status)
      console.log('Channel state after status:', channel.state)
      console.log('Channel topic:', channel.topic)

      // Add more detailed debugging for WebSocket state
      if (supabase.realtime.conn) {
        console.log('WebSocket readyState:', supabase.realtime.conn.readyState)
        console.log('WebSocket URL:', supabase.realtime.conn.url)
      }

      // Show all statuses, not just SUBSCRIBED
      setRealtimeStatus(status)
    })

    console.log('Subscription result:', subscription)

    // Add a timeout to check if we're stuck
    const timeoutId = setTimeout(() => {
      console.log('Timeout check - Current realtime status:', realtimeStatus)
      console.log('Timeout check - Channel state:', channel.state)
      console.log('Timeout check - Channel topic:', channel.topic)

      // Check WebSocket connection state
      if (supabase.realtime.conn) {
        console.log('Timeout check - WebSocket readyState:', supabase.realtime.conn.readyState)
        console.log('Timeout check - WebSocket URL:', supabase.realtime.conn.url)
      }

      // Check if join push was sent
      if (channel.joinPush) {
        console.log('Timeout check - Join push sent:', channel.joinPush.sent)
        console.log('Timeout check - Join push ref:', channel.joinPush.ref)
        console.log('Timeout check - Join push receivedResp:', channel.joinPush.receivedResp)
      }

      // Try to manually check the connection
      try {
        console.log('Attempting to check realtime connection manually...')
        // This might help us understand what's happening
        console.log('All channels:', supabase.getChannels())

        // Check connection state
        console.log('Realtime connection state:', supabase.realtime.connectionState())
        console.log('Realtime is connected:', supabase.realtime.isConnected())
      } catch (error) {
        console.log('Error checking channels:', error)
      }
    }, 10000) // Increased timeout to 10 seconds

    return () => {
      console.log('Cleaning up realtime connection...')
      clearTimeout(timeoutId)
      channel.unsubscribe()
      supabase.realtime.disconnect()
    }
  }, [])

  return (
    <View
      style={{
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#fff',
      }}
    >
      <Text testID="realtime_status">{realtimeStatus || ''}</Text>
    </View>
  )
}
