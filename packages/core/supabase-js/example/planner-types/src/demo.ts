import { filters } from './filters'
import { mutations } from './mutations'
import { overrides } from './overrides'
import { rpcs } from './rpc'
import { selects } from './select'

// Runs every query of src/ against the PostgREST of `pnpm db:up` and prints the results. The runtime shapes are the
// ones the types promise: compare a printed result with what you saw when hovering.
for (const [name, run] of Object.entries({ selects, filters, mutations, rpcs, overrides })) {
  const results = await run()
  console.log(`\n=== ${name} ===`)
  for (const [key, value] of Object.entries(results)) {
    console.log(`\n${key}:`)
    console.dir(value, { depth: 4 })
  }
}
