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
    <div id="output">
        <div id="vsn"></div>
        <div id="realtime_status"></div>
        <div id="received_message"></div>
    </div>
    <script src="http://localhost:${port}/supabase.js"></script>
    <script>
        const SUPABASE_URL = 'http://127.0.0.1:54321'
        const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'

        // Get vsn from query params
        const urlParams = new URLSearchParams(window.location.search)
        const vsn = urlParams.get('vsn') || '1.0.0'

        // Display vsn immediately
        document.getElementById('vsn').textContent = vsn

        const client = window.supabase.createClient(SUPABASE_URL, ANON_KEY, {
            realtime: {
                heartbeatIntervalMs: 500,
                vsn: vsn
            }
        })

        const channelName = 'test-broadcast-channel-' + vsn
        const channel = client.channel(channelName, {
            config: { broadcast: { ack: true, self: true } }
        })

        // Listen for broadcast messages
        channel.on('broadcast', { event: 'test-event' }, (payload) => {
            document.getElementById('received_message').textContent = payload.payload.message
        })

        // Subscribe to the channel
        channel.subscribe(async (status) => {
            console.log('Channel status:', status)
            if (status === 'SUBSCRIBED') {
                document.getElementById('realtime_status').textContent = status

                // Send a test message after subscribing
                await channel.send({
                    type: 'broadcast',
                    event: 'test-event',
                    payload: { message: 'Hello from browser!' }
                })
            }
        })
    </script>
</body>
</html>
`

beforeAll(async () => {
  await new Deno.Command('supabase', { args: ['start'], stderr }).output()
  // Wait for Realtime WebSocket service to be fully ready (CI can be slow)
  await sleep(5)
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
        // Capture console logs and errors from the browser
        page.on('console', (msg) => console.log('BROWSER LOG:', msg.type(), msg.text()))
        page.on('pageerror', (err) => console.log('BROWSER ERROR:', err.message))

        await page.goto(`http://localhost:${port}?vsn=${vsn}`, {
          waitUntil: 'domcontentloaded',
          timeout: 60000,
        })

        // Debug: Check what's on the page IMMEDIATELY after load
        const html = await page.content()
        console.log('PAGE HTML (first 1000 chars):', html.substring(0, 1000))

        // Check if supabase.js loaded
        const supabaseExists = await page.evaluate(`typeof window.supabase !== 'undefined'`)
        console.log('window.supabase exists:', supabaseExists)

        // Wait for vsn to be populated (indicates supabase.js loaded and ran)
        await page.waitForFunction(`document.getElementById('vsn')?.textContent !== ''`, {
          timeout: 30000,
        })

        // Wait for realtime_status to be populated
        await page.waitForFunction(
          `document.getElementById('realtime_status')?.textContent === 'SUBSCRIBED'`,
          { timeout: 30000 }
        )
        const realtimeStatus = await page.$eval('#realtime_status', (el) => el.textContent)
        assertEquals(realtimeStatus, 'SUBSCRIBED')

        // Verify correct version is being used
        const displayedVsn = await page.$eval('#vsn', (el) => el.textContent)
        assertEquals(displayedVsn, vsn)
      })

      it('can broadcast and receive messages', async () => {
        await page.goto(`http://localhost:${port}?vsn=${vsn}`, {
          waitUntil: 'domcontentloaded',
          timeout: 60000,
        })

        // Wait for vsn to be populated
        await page.waitForFunction(`document.getElementById('vsn')?.textContent !== ''`, {
          timeout: 30000,
        })

        // Wait for subscription
        await page.waitForFunction(
          `document.getElementById('realtime_status')?.textContent === 'SUBSCRIBED'`,
          { timeout: 30000 }
        )

        // Wait for the broadcast message to be received
        await page.waitForFunction(
          `document.getElementById('received_message')?.textContent === 'Hello from browser!'`,
          { timeout: 30000 }
        )
        const receivedMessage = await page.$eval('#received_message', (el) => el.textContent)

        assertEquals(receivedMessage, 'Hello from browser!')
      })
    })
  })
})
