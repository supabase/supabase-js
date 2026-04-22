import { Text, View } from 'react-native'
import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'http://127.0.0.1:54321'
const TEST_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'

interface IndexProps {
  vsn?: string
  throttleTest?: boolean
}

export default function Index({ vsn = '1.0.0', throttleTest = false }: IndexProps) {
  const [realtimeStatus, setRealtimeStatus] = useState<string | null>(null)
  const [receivedMessage, setReceivedMessage] = useState<string | null>(null)
  const [throttleSubscribed, setThrottleSubscribed] = useState(0)
  const throttleChannelCount = 5

  useEffect(() => {
    const supabase = createClient(SUPABASE_URL, TEST_ANON_KEY, {
      realtime: {
        heartbeatIntervalMs: 500,
        vsn: vsn,
        ...(throttleTest ? { subscriptionWarnings: { joinRatePerSecond: 3, joinDelayMs: 50 } } : {}),
      }
    })

    if (throttleTest) {
      const channels = Array.from({ length: throttleChannelCount }, (_, i) =>
        supabase.channel(`throttle-expo-${vsn}-${i}`, {
          config: { broadcast: { ack: true, self: true } }
        })
      )

      let count = 0
      channels.forEach((channel) => {
        channel.subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            count++
            setThrottleSubscribed(count)
          }
        })
      })

      return () => {
        channels.forEach((ch) => ch.unsubscribe())
        supabase.realtime.disconnect()
      }
    }

    const channel = supabase.channel(`realtime:public:todos-${vsn}`, {
      config: { broadcast: { ack: true, self: true } }
    })

    // Listen for broadcast messages
    channel.on('broadcast', { event: 'test-event' }, (payload) => {
      setReceivedMessage(payload.payload.message)
    })

    // Subscribe to the channel
    if (channel.state === 'closed') {
      channel.subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          setRealtimeStatus(status)

          await channel.send({
            type: 'broadcast',
            event: 'test-event',
            payload: { message: 'Hello from Expo!' }
          })
        }
      })
    }

    return () => {
      channel.unsubscribe()
      supabase.realtime.disconnect()
    }
  }, [vsn, throttleTest])

  return (
    <View
      style={{
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#fff',
      }}
    >
      <Text testID="vsn">{vsn}</Text>
      <Text testID="realtime_status">{realtimeStatus || ''}</Text>
      <Text testID="received_message">{receivedMessage || ''}</Text>
      <Text testID="throttle_subscribed">{String(throttleSubscribed)}</Text>
      <Text testID="throttle_channel_count">{String(throttleChannelCount)}</Text>
    </View>
  )
}
