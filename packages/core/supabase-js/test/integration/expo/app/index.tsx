import { Text, View } from 'react-native'
import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'http://127.0.0.1:54321'
const TEST_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'

const supabase = createClient(SUPABASE_URL, TEST_ANON_KEY)

export default function Index() {
  const [realtimeStatus, setRealtimeStatus] = useState<string | null>(null)
  const channel = supabase.channel('realtime:public:todos')

  useEffect(() => {
    if (channel.state === 'closed') {
      channel.subscribe((status) => {
        if (status === 'SUBSCRIBED') setRealtimeStatus(status)
      })
    }

    return () => {
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
