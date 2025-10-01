import { serve } from 'https://deno.land/std@0.192.0/http/server.ts'
import { assertEquals } from 'https://deno.land/std@0.224.0/testing/asserts.ts'
import { describe, it, beforeAll, afterAll } from 'https://deno.land/std@0.224.0/testing/bdd.ts'
import { Browser, Page, launch } from 'npm:puppeteer@24.9.0'
import { sleep } from 'https://deno.land/x/sleep/mod.ts'
// Run the UMD build before serving the page
const stderr = 'inherit'
const ac = new AbortController()

let browser: Browser
let page: Page

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
        const supabase = supabase.createClient(SUPABASE_URL, ANON_KEY)
        const App = (props) => {
            const [realtimeStatus, setRealtimeStatus] = React.useState(null)
            const channel = supabase.channel('realtime:public:todos')
            React.useEffect(() => {
                channel.subscribe((status) => { if (status === 'SUBSCRIBED') setRealtimeStatus(status) })

                return () => {
                    channel.unsubscribe()
                }
            }, [])
            if (realtimeStatus) {
                return <div id='realtime_status'>{realtimeStatus}</div>
            } else {
                return <div></div>
            }
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
  await page.close()
  await browser.close()
  await sleep(1)
})

describe('Realtime integration test', () => {
  beforeAll(async () => {
    browser = await launch({
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    })
    page = await browser.newPage()
  })

  it('connects to realtime', async () => {
    await page.goto('http://localhost:8000')
    await page.waitForSelector('#realtime_status', { timeout: 2000 })
    const realtimeStatus = await page.$eval('#realtime_status', (el) => el.innerHTML)
    assertEquals(realtimeStatus, 'SUBSCRIBED')
  })
})
