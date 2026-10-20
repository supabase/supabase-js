import * as fs from 'fs'
import { nanoid } from 'nanoid'
import { sign } from 'jsonwebtoken'
import {
  GenericContainer,
  Network,
  StartedNetwork,
  StartedTestContainer,
  Wait,
} from 'testcontainers'
import { attach, log } from '../utils/jest-custom-reporter'

export class Relay {
  container: StartedTestContainer
  network: StartedNetwork
  id: string
  constructor(container: StartedTestContainer, network: StartedNetwork, id: string) {
    this.container = container
    this.network = network
    this.id = id
  }

  async stop(): Promise<void> {
    try {
      await this.container.stop({ timeout: 5000 })
    } finally {
      await this.network.stop()
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
  const startedRelay = await relay.start().catch(async (error) => {
    await network.stop().catch((stopError) => log(`failed to stop network ${id}: ${stopError}`))
    throw error
  })
  const started = new Relay(startedRelay, network, id)
  const functionPath = `/home/deno/${slug}/index.ts`
  try {
    for (const command of [
      ['deno', 'cache', functionPath],
      [
        'sh',
        '-c',
        'deno run --allow-all --watch --unstable "$1" > /tmp/function.log 2>&1 < /dev/null &',
        'sh',
        functionPath,
      ],
    ]) {
      const { exitCode, output } = await startedRelay.exec(command)
      if (exitCode !== 0) {
        throw new Error(`Failed to start function ${slug}: ${output}`)
      }
    }

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
        if (healthCheck.ok) {
          log(`function started to serve: ${slug + '-' + id}`)
          // Add a small delay after health check passes to ensure full readiness
          await new Promise((resolve) => setTimeout(resolve, 1000))
          return started
        }
      } catch {
        // relay not reachable yet (connection refused/reset), retry
      }
      await new Promise((resolve) => setTimeout(resolve, 500))
    }

    // if function hasn't started, throw with its log
    log(`function failed to start: ${slug + '-' + id}`)
    const { output } = await startedRelay.exec(['cat', '/tmp/function.log'])
    throw new Error(`function hasn't started correctly: ${output}`)
  } catch (error) {
    await started
      .stop()
      .catch((stopError) => log(`failed to stop relay ${slug + '-' + id}: ${stopError}`))
    throw error
  }
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
