import { Text, View } from 'react-native'
import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'http://127.0.0.1:54321'
const TEST_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'

interface IndexProps {
  vsn?: string
}

export default function Index({ vsn = '1.0.0' }: IndexProps) {
  const [realtimeStatus, setRealtimeStatus] = useState<string | null>(null)
  const [receivedMessage, setReceivedMessage] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient(SUPABASE_URL, TEST_ANON_KEY, {
      realtime: {
        heartbeatIntervalMs: 500,
        vsn: vsn,
      }
    })

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
  }, [vsn])

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
    </View>
  )
}
