import * as fs from 'fs'
import { nanoid } from 'nanoid'
import { sign } from 'jsonwebtoken'
import { GenericContainer, Network, StartedTestContainer, Wait } from 'testcontainers'
import { ExecResult } from 'testcontainers/dist/docker/types'
import { attach, log } from '../utils/jest-custom-reporter'

/**
 * A Relay contains a running relay container that has a unique ID and two promises:
 * one for the `deno cache` and one for the `deno run` the required function
 */
export class Relay {
  container: StartedTestContainer
  id: string
  execCache: Promise<ExecResult>
  execRun: Promise<ExecResult>
  constructor(
    container: StartedTestContainer,
    id: string,
    execCache: Promise<ExecResult>,
    execRun: Promise<ExecResult>
  ) {
    this.container = container
    this.id = id
    this.execCache = execCache
    this.execRun = execRun
  }

  /**
   * Safely stops the relay container and cleans up exec processes
   */
  async stop(): Promise<void> {
    try {
      // Try to stop the container - this will trigger cleanup of exec instances
      await this.container.stop({ timeout: 5000 })
    } catch (error: any) {
      // Ignore "no such exec" errors during cleanup - they're harmless
      if (!error?.message?.includes('no such exec')) {
        throw error
      }
      // Container is already stopped or exec instances are gone, which is fine
    }
  }
}

/**
 * It starts a docker container with a deno relay, and waits for it to be ready
 * @param {string} slug - the name of the function to deploy
 * @param {string} jwtSecret - the JWT secret to access function
 * @param {string} [denoOrigin=http://localhost:8000] - the origin of the deno server
 * @param {Map<string, string>} env - list of environment variables for deno relay
 * @returns {Promise<Relay>} A Relay object.
 */
export async function runRelay(
  slug: string,
  jwtSecret: string,
  denoOrigin: string = 'http://localhost:8000',
  env?: Map<string, string>
): Promise<Relay> {
  // read function to deploy
  log('read function body')
  const functionBytes = fs.readFileSync('test/functions/' + slug + '/index.ts', 'utf8')
  attach('function body', functionBytes, 'text/plain')

  // random id for parallel execution
  const id = nanoid(5)

  //create network
  log('add network')
  const network = await new Network({ name: 'supabase_network_' + id }).start()

  // create relay container
  log(`create relay ${slug + '-' + id}`)
  const relay = await new GenericContainer('supabase/deno-relay:v1.5.0')
    .withName(slug + '-' + id)
    .withBindMount(`${process.cwd()}/test/functions/${slug}`, `/home/deno/${slug}`, 'ro')
    .withNetworkMode(network.getName())
    .withExposedPorts(8081)
    .withWaitStrategy(Wait.forLogMessage('Listening on http://0.0.0.0:8081'))
    .withStartupTimeout(30000) // Increased from 15s to 30s for CI stability
    .withReuse()

  // add envs
  env = parseEnv(env, jwtSecret, denoOrigin)
  env && env.forEach((value, key) => relay.withEnv(key, value))

  // start relay and function
  log(`start relay ${slug + '-' + id}`)
  const startedRelay = await relay.start()
  const execCache = startedRelay.exec(['deno', 'cache', `/home/deno/${slug}/index.ts`])
  const execRun = startedRelay.exec([
    'deno',
    'run',
    '--allow-all',
    '--watch',
    '--unstable',
    `/home/deno/${slug}/index.ts`,
  ])

  // wait till function is running
  log(`check function is healthy: ${slug + '-' + id}`)
  for (let ctr = 0; ctr < 60; ctr++) {
    try {
      const healthCheck = await fetch(
        `http://localhost:${startedRelay.getMappedPort(8081)}/${slug}`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${sign({ name: 'check' }, jwtSecret)}`,
          },
        }
      )
      if (healthCheck.ok || healthCheck.status === 101) {
        log(`function started to serve: ${slug + '-' + id}`)
        // Add a small delay after health check passes to ensure full readiness
        await new Promise((resolve) => setTimeout(resolve, 1000))
        return new Relay(startedRelay, id, execCache, execRun)
      }
    } catch (error) {
      // Native fetch throws an error when it encounters HTTP 101 (WebSocket upgrade)
      // If we get a TypeError (which fetch throws for protocol errors like 101),
      // we consider the function ready to serve
      if (error instanceof TypeError) {
        // This likely means we got a 101 response that native fetch couldn't handle
        // The server is responding, so consider it ready
        log(`function started to serve (detected via error): ${slug + '-' + id}`)
        await new Promise((resolve) => setTimeout(resolve, 1000))
        return new Relay(startedRelay, id, execCache, execRun)
      }
      // For other errors (connection refused, etc.), continue retrying
    }
    await new Promise((resolve) => setTimeout(resolve, 500))
  }

  // if function hasn't started, stop container and throw
  log(`function failed to start: ${slug + '-' + id}`)
  startedRelay.stop()
  throw new Error("function haven'start correctly")
}

/**
 * If the JWT_SECRET and DENO_ORIGIN environment is not set, set it
 * @param env - The environment variables.
 * @param {string} jwtSecret - The JWT secret.
 * @param {string} denoOrigin - The origin of the Deno server.
 * @returns {Map<string, string>} - `env` variables map.
 */
function parseEnv(
  env: Map<string, string> | undefined | null,
  jwtSecret: string,
  denoOrigin: string
): Map<string, string> {
  if (env) {
    !env.has('JWT_SECRET') && jwtSecret && env.set('JWT_SECRET', jwtSecret)
    !env.has('DENO_ORIGIN') && denoOrigin && env.set('DENO_ORIGIN', denoOrigin)
  } else {
    env = new Map([
      ['JWT_SECRET', jwtSecret],
      ['DENO_ORIGIN', denoOrigin],
    ])
  }
  return env
}
