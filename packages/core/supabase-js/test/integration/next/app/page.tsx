'use client'

import { Suspense, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useSearchParams } from 'next/navigation'

function HomeContent() {
  const searchParams = useSearchParams()
  const vsn = searchParams.get('vsn') || '1.0.0'

  const supabase = createClient(vsn)
  const [realtimeStatus, setRealtimeStatus] = useState<string | null>(null)
  const [receivedMessage, setReceivedMessage] = useState<string | null>(null)

  useEffect(() => {
    const channel = supabase.channel(`realtime:public:test-${vsn}`, {
      config: { broadcast: { ack: true, self: true } }
    })

    // Listen for broadcast messages
    channel.on('broadcast', { event: 'test-event' }, (payload) => {
      setReceivedMessage(payload.payload.message)
    })

    // Subscribe to the channel
    channel.subscribe(async (status) => {
      setRealtimeStatus(status)

      // Send broadcast message after successful subscription
      if (status === 'SUBSCRIBED') {
        await channel.send({
          type: 'broadcast',
          event: 'test-event',
          payload: { message: 'Hello from Next.js!' }
        })
      }
    })

    return () => {
      channel.unsubscribe()
    }
  }, [vsn])

  return (
    <div>
      <div data-testid="vsn">{vsn}</div>
      <div data-testid="realtime_status">{realtimeStatus}</div>
      {receivedMessage && (
        <div data-testid="received_message">{receivedMessage}</div>
      )}
    </div>
  )
}

export default function Home() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <HomeContent />
    </Suspense>
  )
}
