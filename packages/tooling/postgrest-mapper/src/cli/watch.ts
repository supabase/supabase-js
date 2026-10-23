import { watch as fsWatch } from 'node:fs'
import { dirname, join, sep } from 'node:path'
import type { WatchFn, WatchHandle } from './types'

export const nodeWatch: WatchFn = (directory, onEvent) => {
  const watcher = fsWatch(directory, (_event, filename) => onEvent(filename))
  // a directory that disappears must not crash the process
  watcher.on('error', () => {})
  return { close: () => watcher.close() }
}

const SOURCE = /\.(?:[cm]?[jt]s|[jt]sx)$/

export interface WatchLoopOptions {
  watch: WatchFn
  debounceMs: number
  signal?: AbortSignal
  /** Runs one generation and returns the files it depends on (absolute paths) */
  run(): Promise<readonly string[]>
  /** A file the loop itself writes: its events never retrigger */
  ignore: string
}

/**
 * Runs `run` once, then again (debounced, never concurrently) whenever a file it depended on changes or a source
 * file appears in a directory that holds one. Directories are watched, not recursively: a new directory is picked
 * up at the next run. Resolves when `signal` aborts, after the run in flight has finished.
 */
export async function watchLoop(options: WatchLoopOptions): Promise<void> {
  const { watch, debounceMs, signal, ignore } = options
  let watched = new Set<string>()
  let handles = new Map<string, WatchHandle>()
  let timer: ReturnType<typeof setTimeout> | undefined
  let running: Promise<void> | undefined
  let dirty = false
  let stopped = false

  const sync = (files: readonly string[]): void => {
    watched = new Set(files)
    const directories = new Set(files.map((f) => dirname(f)))
    for (const [directory, handle] of handles) {
      if (!directories.has(directory)) {
        handle.close()
        handles.delete(directory)
      }
    }
    for (const directory of directories) {
      if (handles.has(directory)) continue
      try {
        handles.set(
          directory,
          watch(directory, (filename) => {
            const path = filename === null ? undefined : join(directory, filename)
            if (path === ignore || path?.split(sep).includes('node_modules')) return
            if (path === undefined || watched.has(path) || SOURCE.test(path)) schedule()
          })
        )
      } catch {
        // a directory that cannot be watched is skipped
      }
    }
  }

  const cycle = async (): Promise<void> => {
    do {
      dirty = false
      sync(await options.run())
    } while (dirty && !stopped)
  }
  const trigger = (): void => {
    if (stopped) return
    if (running) {
      dirty = true
      return
    }
    running = cycle().finally(() => {
      running = undefined
    })
  }
  function schedule(): void {
    clearTimeout(timer)
    timer = setTimeout(trigger, debounceMs)
  }

  if (signal?.aborted) return
  running = cycle().finally(() => {
    running = undefined
  })
  await new Promise<void>((resolve) => {
    if (!signal) return // nothing ends the loop
    signal.addEventListener('abort', () => resolve(), { once: true })
  })
  stopped = true
  clearTimeout(timer)
  for (const handle of handles.values()) handle.close()
  handles = new Map()
  await running
}
