#!/usr/bin/env node
// The TypeScript content-mapper process (see the "typescript" field of package.json). Wiring only.
const {
  createContentMapperServer,
  createStreamLogger,
  stubGenerator,
} = require('../dist/main/content-mapper')

const logger = createStreamLogger(process.stderr, process.env)
createContentMapperServer({
  input: process.stdin,
  output: process.stdout,
  logger,
  generator: stubGenerator,
})
