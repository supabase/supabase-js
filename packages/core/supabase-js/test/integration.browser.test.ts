import { serve } from 'https://deno.land/std@0.192.0/http/server.ts'
import { assertEquals } from 'https://deno.land/std@0.224.0/testing/asserts.ts'
import { describe, it, beforeAll, afterAll } from 'https://deno.land/std@0.224.0/testing/bdd.ts'
import { Browser, Page, launch } from 'npm:puppeteer@24.9.0'
import { sleep } from 'https://deno.land/x/sleep/mod.ts'

const stderr = 'inherit'
const ac = new AbortController()

let browser: Browser

const port = 8000
const content = `<html>
<body>
    <div id="output"></div>
    <script src="https://unpkg.com/react@18/umd/react.development.js"></script>
    <script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"></script>
    <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
    <script src="http://localhost:${port}/supabase.js"></script>

    <script type="text/babel" data-presets="env,react">
        const SUPABASE_URL = 'http://127.0.0.1:54321'
        const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'

        // Get vsn from query params
        const urlParams = new URLSearchParams(window.location.search)
        const vsn = urlParams.get('vsn') || '1.0.0'

        const supabase = window.supabase.createClient(SUPABASE_URL, ANON_KEY, {
            realtime: {
                heartbeatIntervalMs: 500,
                vsn: vsn
            }
        })

        const App = () => {
            const [realtimeStatus, setRealtimeStatus] = React.useState(null)
            const [receivedMessage, setReceivedMessage] = React.useState(null)
            const channelRef = React.useRef(null)

            React.useEffect(() => {
                const channelName = \`test-broadcast-channel-\${vsn}\`
                const channel = supabase.channel(channelName, {
                    config: { broadcast: { ack: true, self: true } }
                })

                channelRef.current = channel

                // Listen for broadcast messages
                channel.on('broadcast', { event: 'test-event' }, (payload) => {
                    setReceivedMessage(payload.payload)
                })

                // Subscribe to the channel
                channel.subscribe(async (status) => {
                    if (status === 'SUBSCRIBED') {
                        setRealtimeStatus(status)

                        // Send a test message after subscribing
                        await channel.send({
                            type: 'broadcast',
                            event: 'test-event',
                            payload: { message: 'Hello from browser!' }
                        })
                    }
                })

                return () => {
                    channel.unsubscribe()
                }
            }, [])

            return (
                <div>
                    <div id='vsn'>{vsn}</div>
                    {realtimeStatus && (
                        <div id='realtime_status'>{realtimeStatus}</div>
                    )}
                    {receivedMessage && (
                        <div id='received_message'>{receivedMessage.message}</div>
                    )}
                </div>
            )
        }

        ReactDOM.render(<App />, document.getElementById('output'));
    </script>
</body>
</html>
`

beforeAll(async () => {
  await new Deno.Command('supabase', { args: ['start'], stderr }).output()
  await new Deno.Command('npm', { args: ['install'], stderr }).output()
  await new Deno.Command('npm', {
    args: ['run', 'build:umd', '--', '--mode', 'production'],
    stderr,
  }).output()

  await new Deno.Command('npx', {
    args: ['puppeteer', 'browsers', 'install', 'chrome'],
    stderr,
  }).output()

  serve(
    async (req: any) => {
      if (req.url.endsWith('supabase.js')) {
        const file = await Deno.readFile('./dist/umd/supabase.js')

        return new Response(file, {
          headers: { 'content-type': 'application/javascript' },
        })
      }
      return new Response(content, {
        headers: {
          'content-type': 'text/html',
          'cache-control': 'no-cache',
        },
      })
    },
    { signal: ac.signal, port: port }
  )
})

afterAll(async () => {
  await ac.abort()
  await sleep(1)
})

describe('Realtime integration test', () => {
  beforeAll(async () => {
    browser = await launch({
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    })
  })

  afterAll(async () => {
    await browser.close()
  })

  const versions = [{ vsn: '1.0.0' }, { vsn: '2.0.0' }]

  versions.forEach(({ vsn }) => {
    describe(`Realtime with vsn: ${vsn}`, () => {
      let page: Page

      beforeAll(async () => {
        page = await browser.newPage()
      })

      afterAll(async () => {
        await page.close()
      })

      it('connects to realtime', async () => {
        await page.goto(`http://localhost:${port}?vsn=${vsn}`)
        await page.waitForSelector('#realtime_status', { timeout: 2000 })
        const realtimeStatus = await page.$eval('#realtime_status', (el) => el.innerHTML)
        assertEquals(realtimeStatus, 'SUBSCRIBED')

        // Verify correct version is being used
        const displayedVsn = await page.$eval('#vsn', (el) => el.innerHTML)
        assertEquals(displayedVsn, vsn)
      })

      it('can broadcast and receive messages', async () => {
        await page.goto(`http://localhost:${port}?vsn=${vsn}`)

        // Wait for subscription
        await page.waitForSelector('#realtime_status', { timeout: 2000 })

        // Wait for the broadcast message to be received
        await page.waitForSelector('#received_message', { timeout: 5000 })
        const receivedMessage = await page.$eval('#received_message', (el) => el.innerHTML)

        assertEquals(receivedMessage, 'Hello from browser!')
      })
    })
  })
})
