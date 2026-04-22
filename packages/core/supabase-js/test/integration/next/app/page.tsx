'use client'

import { Suspense, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useSearchParams } from 'next/navigation'

const THROTTLE_CHANNEL_COUNT = 5

function HomeContent() {
  const searchParams = useSearchParams()
  const vsn = searchParams.get('vsn') || '1.0.0'
  const throttleTest = searchParams.get('throttle') === 'true'

  const supabase = createClient(vsn)
  const [realtimeStatus, setRealtimeStatus] = useState<string | null>(null)
  const [receivedMessage, setReceivedMessage] = useState<string | null>(null)
  const [throttleSubscribed, setThrottleSubscribed] = useState(0)

  useEffect(() => {
    if (throttleTest) {
      const throttleClient = createClient(vsn, {
        realtime: { heartbeatIntervalMs: 500, vsn, subscriptionWarnings: { joinRatePerSecond: 3, joinDelayMs: 50 } },
      })
      const channels = Array.from({ length: THROTTLE_CHANNEL_COUNT }, (_, i) =>
        throttleClient.channel(`throttle-next-${vsn}-${i}`, {
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
      }
    }

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
  }, [vsn, throttleTest])

  return (
    <div>
      <div data-testid="vsn">{vsn}</div>
      <div data-testid="realtime_status">{realtimeStatus}</div>
      {receivedMessage && (
        <div data-testid="received_message">{receivedMessage}</div>
      )}
      <div data-testid="throttle_subscribed">{throttleSubscribed}</div>
      <div data-testid="throttle_channel_count">{THROTTLE_CHANNEL_COUNT}</div>
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
