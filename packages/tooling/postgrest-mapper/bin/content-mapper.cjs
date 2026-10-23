#!/usr/bin/env node
// The TypeScript content-mapper process (see the "typescript" field of package.json). Wiring only.
const { createContentMapperServer, createStreamLogger } = require('../dist/main/content-mapper')
const { createProjectGenerator } = require('../dist/main/generate')

const logger = createStreamLogger(process.stderr, process.env)
// POSTGREST_PLANNER_WASM points the planner at another build of the wasm. It exists for the package's own tests,
// which pin the planner they were written against; the default is the wasm shipped with @supabase/postgrest-planner.
const generator = createProjectGenerator({
  logger: {
    debug: (message) => logger.debug(message),
    warn: (message) => logger.error(`warning: ${message}`),
  },
  ...(process.env.POSTGREST_PLANNER_WASM ? { wasmPath: process.env.POSTGREST_PLANNER_WASM } : {}),
})
const server = createContentMapperServer({
  input: process.stdin,
  output: process.stdout,
  logger,
  generator,
})
// The planner host's worker keeps the process alive: stop it once the server's input is closed.
server.closed.then(() => generator.close()).catch(() => generator.close())
