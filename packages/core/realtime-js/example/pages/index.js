import { useEffect, useState } from 'react'
import { RealtimeClient } from '@supabase/realtime-js'
import { NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_KEY } from '../lib/constants'

var socket = new RealtimeClient(NEXT_PUBLIC_SUPABASE_URL, {
  params: { apikey: NEXT_PUBLIC_SUPABASE_KEY },
})

var publicSchema = null

export default function IndexPage() {
  let [inserts, setInserts] = useState([])
  let [updates, setUpdates] = useState([])
  let [deletes, setDeletes] = useState([])
  let [socketStatus, setSocketStatus] = useState('')
  let [channelStatus, setChannelStatus] = useState('')

  useEffect(() => {
    // Subscribe
    createSubscription()

    socket.connect()
  }, [])

  const createSubscription = () => {
    publicSchema = socket.channel('realtime:public')
    publicSchema.on('INSERT', (e) => setInserts([...inserts, e]))
    publicSchema.on('UPDATE', (e) => setUpdates([...updates, e]))
    publicSchema.on('DELETE', (e) => setDeletes([...deletes, e]))

    // Channel events
    publicSchema._onError(() => setChannelStatus('ERROR'))
    publicSchema._onClose(() => setChannelStatus('Closed gracefully.'))
    publicSchema
      .subscribe()
      .receive('ok', () => setChannelStatus('SUBSCRIBED'))
      .receive('error', () => setChannelStatus('FAILED'))
      .receive('timeout', () => setChannelStatus('Timed out, retrying.'))
  }

  const toggleSubscription = () => {
    if (channelStatus == 'SUBSCRIBED') {
      publicSchema.unsubscribe()
    } else {
      createSubscription()
    }
  }

  return (
    <div className="p-2 font-mono">
      <div className="border-b py-8">
        <h4>SOCKET STATUS: {socketStatus}</h4>
        <h4>CHANNEL STATUS: {channelStatus}</h4>
        <button
          className="rounded border border-black p-2 text-sm my-2"
          onClick={() => toggleSubscription()}
        >
          {channelStatus == 'SUBSCRIBED' ? 'Unsubscribe' : 'Subscribe'}
        </button>
      </div>
      <div className="w-full h-full grid grid-cols-3 py-8 gap-2">
        <div className="">
          <div>
            <h3 className="">INSERTS</h3>
            {inserts.map((x) => (
              <pre
                key={x.commit_timestamp}
                className="text-xs overflow-scroll border border-black rounded-md my-2 p-2"
                style={{ maxHeight: 200 }}
              >
                {JSON.stringify(x, null, 2)}
              </pre>
            ))}
          </div>
        </div>
        <div className="">
          <div>
            <h3 className="">UPDATES</h3>
            {updates.map((x) => (
              <pre
                key={x.commit_timestamp}
                className="text-xs overflow-scroll border border-black rounded-md my-2 p-2"
                style={{ maxHeight: 200 }}
              >
                {JSON.stringify(x, null, 2)}
              </pre>
            ))}
          </div>
        </div>
        <div className="">
          <div>
            <h3 className="">DELETES</h3>
            {deletes.map((x) => (
              <pre
                key={x.commit_timestamp}
                className="text-xs overflow-scroll border border-black rounded-md my-2 p-2"
                style={{ maxHeight: 200 }}
              >
                {JSON.stringify(x, null, 2)}
              </pre>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
