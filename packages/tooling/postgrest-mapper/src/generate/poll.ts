import { dirname } from 'node:path'
import { createScrubber, schemaFingerprint } from '../schema'
import { createDeadline } from '../schema/deadline'
import { messageOf } from '../schema/errors'
import { urlPassword } from '../schema/scrub'
import type { ConnectOptions, DbConnection, SchemaFs } from '../schema'

/** What one probe may take (connection and statement included), in ms. */
export const DEFAULT_POLL_TIMEOUT_MS = 10_000

const MAX_TIMER_MS = 2 ** 31 - 1

export interface SchemaPollerOptions {
  /** The database the live schema was read from. It carries credentials: it is never logged or put in a message */
  url: string
  /** Quiet time between two probes, in ms */
  intervalMs: number
  /** The refresh stamp of the project: written with the fingerprint when the database changed */
  stampPath: string
  connect: (url: string, options?: ConnectOptions) => Promise<DbConnection>
  fs: Pick<SchemaFs, 'readFile' | 'writeFile' | 'mkdir'>
  logger: { debug(message: string): void; warn(message: string): void }
  /** Whether a generation from this schema is running: a probe that would write the stamp waits for it */
  busy(): boolean
  /** Bound of one probe. Defaults to `DEFAULT_POLL_TIMEOUT_MS` */
  timeoutMs?: number
  /** The fingerprint taken before the schema was acquired: the baseline, so a change since is seen by the first probe */
  baseline?: string
}

export interface SchemaPoller {
  /**
   * The database to probe from now on (a later acquisition resolved another one): reconnects, and takes `baseline`, else
   * the first probe's fingerprint, as the new baseline
   */
  setUrl(url: string, baseline?: string): void
  setInterval(intervalMs: number): void
  /** No probe starts and no stamp is written after it; the connection is closed. Never rejects */
  stop(): Promise<void>
}

/**
 * Watches the database a live schema came from for DDL. Every interval it takes `schemaFingerprint` over a connection
 * it keeps open; the baseline is the fingerprint taken before the schema was acquired, else the first probe's. When it
 * differs from the baseline, the fingerprint becomes the content of the refresh stamp (written only when the file holds
 * something else, so two processes polling one project leave it alone once either has written it) and the new
 * baseline: every generator of the project that lists the stamp acquires the schema again. Probes never overlap (each
 * one schedules the next), and a probe that fails or runs out of time closes the connection, keeps the baseline, warns
 * once until a probe succeeds, and is retried at the next interval. It never rejects and never keeps the process alive.
 */
export function createSchemaPoller(options: SchemaPollerOptions): SchemaPoller {
  const { connect, fs, logger, stampPath } = options
  const timeoutMs = options.timeoutMs ?? DEFAULT_POLL_TIMEOUT_MS
  let url = options.url
  let scrub = scrubberOf(url)
  let intervalMs = options.intervalMs
  let connection: DbConnection | undefined
  let baseline = options.baseline
  let warned = false
  let stopped = false
  /** Moves with the URL: what a probe of an earlier database found is dropped */
  let epoch = 0
  let timer: ReturnType<typeof setTimeout> | undefined
  let probing = false
  let soon = false

  const dropConnection = async (): Promise<void> => {
    const closing = connection
    connection = undefined
    await closing?.close().catch(() => undefined)
  }

  const warnOnce = (what: string, error: unknown): void => {
    if (warned) return
    warned = true
    logger.warn(`${what}: ${scrub(messageOf(error))}`)
  }

  /** The stamp write under way: `stop` lets it settle, so nothing is written once it resolves */
  let writing: Promise<unknown> = Promise.resolve()
  const writeStamp = async (fingerprint: string, current: () => boolean): Promise<void> => {
    const content = `${fingerprint}\n`
    if ((await fs.readFile(stampPath).catch(() => undefined)) === content) return
    await fs.mkdir(dirname(stampPath))
    if (current()) await fs.writeFile(stampPath, content)
  }

  const probe = async (): Promise<void> => {
    const mine = epoch
    const deadline = createDeadline(timeoutMs, 'the schema change check')
    let abandoned = false
    const read = async (): Promise<string> => {
      if (!connection) {
        const opened = await connect(url, { timeoutMs })
        if (abandoned || stopped || mine !== epoch) {
          await opened.close().catch(() => undefined)
          throw new Error('the probe was abandoned')
        }
        connection = opened
      }
      return schemaFingerprint(connection)
    }
    deadline.onExpire(() => {
      abandoned = true
      void dropConnection()
    })
    let fingerprint: string
    try {
      const reading = read()
      reading.catch(() => undefined)
      fingerprint = await Promise.race([reading, deadline.expired])
    } catch (error) {
      await dropConnection()
      if (!stopped && mine === epoch)
        warnOnce('could not check the database for schema changes', error)
      return
    } finally {
      deadline.stop()
    }
    if (stopped || mine !== epoch) return
    if (baseline === undefined) {
      baseline = fingerprint
    } else if (fingerprint !== baseline) {
      try {
        const write = writeStamp(fingerprint, () => !stopped && mine === epoch)
        writing = write.catch(() => undefined)
        await write
      } catch (error) {
        // the baseline stays: the next probe sees the change again
        warnOnce('could not write the refresh stamp', error)
        return
      }
      if (stopped || mine !== epoch) return
      logger.debug('the database changed: the refresh stamp was updated')
      baseline = fingerprint
    }
    warned = false
  }

  const schedule = (delay: number): void => {
    if (stopped) return
    clearTimeout(timer)
    timer = setTimeout(tick, Math.min(Math.max(0, delay), MAX_TIMER_MS))
    timer.unref()
  }

  function tick(): void {
    timer = undefined
    if (stopped) return
    probing = true
    // a generation of the schema is running: nothing is written under it (the first probe only reads)
    const run = baseline === undefined || !options.busy() ? probe() : Promise.resolve()
    void run
      .catch(() => undefined)
      .finally(() => {
        probing = false
        const delay = soon ? 0 : intervalMs
        soon = false
        schedule(delay)
      })
  }

  schedule(0)
  return {
    setUrl(next, nextBaseline) {
      if (next === url) return
      url = next
      scrub = scrubberOf(next)
      epoch++
      baseline = nextBaseline
      warned = false
      void dropConnection()
      if (probing) soon = true
      else schedule(0)
    },
    setInterval(next) {
      intervalMs = next
    },
    async stop() {
      stopped = true
      clearTimeout(timer)
      timer = undefined
      await writing
      await dropConnection()
    },
  }
}

/** One fingerprint over a connection of its own, bounded; `undefined` when it cannot be taken. Never rejects */
export async function takeFingerprint(
  url: string,
  connect: SchemaPollerOptions['connect'],
  timeoutMs = DEFAULT_POLL_TIMEOUT_MS
): Promise<string | undefined> {
  const deadline = createDeadline(timeoutMs, 'the schema change check')
  let connection: DbConnection | undefined
  let abandoned = false
  const close = async (): Promise<void> => {
    const closing = connection
    connection = undefined
    await closing?.close().catch(() => undefined)
  }
  deadline.onExpire(() => {
    abandoned = true
    void close()
  })
  const read = async (): Promise<string> => {
    const opened = await connect(url, { timeoutMs })
    if (abandoned) {
      await opened.close().catch(() => undefined)
      throw new Error('the probe was abandoned')
    }
    connection = opened
    return schemaFingerprint(opened)
  }
  try {
    const reading = read()
    reading.catch(() => undefined)
    return await Promise.race([reading, deadline.expired])
  } catch {
    return undefined
  } finally {
    deadline.stop()
    await close()
  }
}

const scrubberOf = (url: string): ((text: string) => string) =>
  createScrubber([url, urlPassword(url)])
