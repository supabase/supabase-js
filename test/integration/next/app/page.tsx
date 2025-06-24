'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function Home() {
  const supabase = createClient()
  const [realtimeStatus, setRealtimeStatus] = useState<string | null>(null)
  const channel = supabase.channel('realtime:public:test')

  useEffect(() => {
    channel.subscribe((status) => setRealtimeStatus(status))

    return () => {
      channel.unsubscribe()
    }
  }, [])

  return <div data-testid="realtime_status">{realtimeStatus}</div>
}
