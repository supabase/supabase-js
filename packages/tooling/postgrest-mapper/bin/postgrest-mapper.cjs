#!/usr/bin/env node
// The `postgrest-mapper` command line. Wiring only: the CLI is a library function (`runCli`).
const { runCli } = require('../dist/main/cli')
const { version } = require('../package.json')

const controller = new AbortController()
process.once('SIGINT', () => controller.abort())
process.once('SIGTERM', () => controller.abort())

runCli(process.argv.slice(2), {
  stdout: process.stdout,
  stderr: process.stderr,
  signal: controller.signal,
  version,
  // POSTGREST_PLANNER_WASM points the planner at another build of the wasm (this package's own tests pin one).
  deps: process.env.POSTGREST_PLANNER_WASM ? { wasmPath: process.env.POSTGREST_PLANNER_WASM } : {},
}).then(
  (code) => {
    process.exitCode = code
  },
  (error) => {
    process.stderr.write(
      `${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`
    )
    process.exitCode = 1
  }
)
