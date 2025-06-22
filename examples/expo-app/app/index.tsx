import { Text, View } from 'react-native'
import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'http://127.0.0.1:54321'
const ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'

const supabase = createClient(SUPABASE_URL, ANON_KEY)

export default function Index() {
  const [realtimeStatus, setRealtimeStatus] = useState<string | null>(null)

  useEffect(() => {
    console.log('Setting up realtime connection...')
    const channel = supabase.channel('realtime:public:todos')

    channel.subscribe((status) => {
      console.log('Realtime status:', status)
      // Show all statuses, not just SUBSCRIBED
      setRealtimeStatus(status)
    })

    return () => {
      console.log('Cleaning up realtime connection...')
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
