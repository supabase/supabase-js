import { watch as fsWatch } from 'node:fs'
import { stat } from 'node:fs/promises'
import { dirname, join, sep } from 'node:path'
import type { MtimeFn, WatchFn, WatchHandle } from './types'

export const nodeWatch: WatchFn = (directory, onEvent) => {
  const watcher = fsWatch(directory, (_event, filename) => onEvent(filename))
  // a directory that disappears must not crash the process
  watcher.on('error', () => {})
  return { close: () => watcher.close() }
}

export const nodeMtime: MtimeFn = (path) =>
  stat(path).then(
    (s) => s.mtimeMs,
    () => undefined
  )

/**
 * File systems stamp modification times with a clock that may lag `Date.now()` (a few milliseconds on Linux), so an
 * edit just after a run started can carry a stamp just before it. A file stamped within this margin of the start
 * counts as edited during the run, which costs at most one redundant run.
 */
const MTIME_MARGIN_MS = 100

const SOURCE = /\.(?:[cm]?[jt]s|[jt]sx)$/

export interface WatchLoopOptions {
  watch: WatchFn
  mtime: MtimeFn
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
 * up at the next run. A file edited while a run was in flight, before its directory was watched, is detected by its
 * modification time when the directory starts being watched, and runs again. Resolves when `signal` aborts, after
 * the run in flight has finished.
 */
export async function watchLoop(options: WatchLoopOptions): Promise<void> {
  const { watch, mtime, debounceMs, signal, ignore } = options
  let watched = new Set<string>()
  let handles = new Map<string, WatchHandle>()
  let timer: ReturnType<typeof setTimeout> | undefined
  let running: Promise<void> | undefined
  let dirty = false
  let stopped = false

  /** Watches the directories of `files`; `startedAt` is when the run that returned them began */
  const sync = async (files: readonly string[], startedAt: number): Promise<void> => {
    if (stopped) return // a run that outlives the abort must not leave handles behind
    watched = new Set(files)
    const directories = new Set(files.map((f) => dirname(f)))
    for (const [directory, handle] of handles) {
      if (!directories.has(directory)) {
        handle.close()
        handles.delete(directory)
      }
    }
    const added = new Set<string>()
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
        added.add(directory)
      } catch {
        // a directory that cannot be watched is skipped
      }
    }
    // Only now can an edit raise an event, and the run may have read a file before it was edited: ask the file
    // system. Directories that were already watched need no look, their events kept coming during the run.
    const stamps = await Promise.all(
      files.filter((f) => f !== ignore && added.has(dirname(f))).map((f) => mtime(f))
    )
    if (stamps.some((stamp) => stamp !== undefined && stamp >= startedAt - MTIME_MARGIN_MS)) {
      dirty = true
    }
  }

  const cycle = async (): Promise<void> => {
    do {
      dirty = false
      const startedAt = Date.now()
      await sync(await options.run(), startedAt)
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
