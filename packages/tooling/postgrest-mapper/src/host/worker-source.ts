/**
 * The worker's program, as source text for `new Worker(source, { eval: true })`. Running it from a string keeps the
 * host independent of how the package is loaded (built JavaScript, ts-jest, a bundle): the planner module is passed
 * in by resolved path.
 */
export const WORKER_SOURCE = `
const { parentPort, workerData } = require('node:worker_threads')
let planner
const startPlanner = async () => {
  const p = await require(workerData.plannerModule).loadPlanner({ wasmPath: workerData.wasmPath })
  const abi = p.info().abi
  if (abi !== workerData.abi) {
    throw new Error('the planner wasm speaks ABI ' + abi + ', expected ' + workerData.abi)
  }
  return p
}
const ensurePlanner = () => (planner ??= startPlanner())
parentPort.on('message', async (message) => {
  try {
    const p = await ensurePlanner()
    if (message.op === 'info') {
      parentPort.postMessage({ id: message.id, ok: true, result: p.info() })
    } else if (message.op === 'load') {
      parentPort.postMessage({ id: message.id, ok: true, result: p.load(message.input) })
    } else if (message.op === 'plan') {
      parentPort.postMessage({ id: message.id, ok: true, result: p.plan(message.handle, message.request) })
    } else {
      p.freeCache(message.handle)
      parentPort.postMessage({ id: message.id, ok: true, result: null })
    }
  } catch (error) {
    planner = undefined
    parentPort.postMessage({ id: message.id, ok: false, message: error instanceof Error ? error.message : String(error) })
  }
})
`
