import { watch as fsWatch } from 'node:fs'
import { stat } from 'node:fs/promises'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { createGenerator } from '../generate'
import { messageOf } from './config'
import { writeWith, type WriteInput, type WriteResult } from './generate'
import {
  resolveDeps,
  type Clock,
  type MtimeFn,
  type OperationDeps,
  type WatchFn,
  type WatchHandle,
} from './types'

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

export const nodeClock: Clock = {
  now: () => Date.now(),
  setTimeout: (run, ms) => setTimeout(run, ms),
  clearTimeout: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
}

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
  clock?: Clock
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
 * up at the next run. A directory that does not exist yet (the cache directory of a project that never ran, the
 * folder of a snapshot) is waited for through its nearest existing ancestor: the ancestor's first event on the way
 * to it runs again, and that run watches the directory itself once it exists. A file edited while a run was in
 * flight, before its directory was watched, is detected by its modification time when the directory starts being
 * watched, and runs again. Resolves when `signal` aborts, after the run in flight has finished.
 */
export async function watchLoop(options: WatchLoopOptions): Promise<void> {
  const { watch, mtime, debounceMs, signal, ignore } = options
  const clock = options.clock ?? nodeClock
  let watched = new Set<string>()
  /** `ancestor`: the directory does not exist, `handle` watches the nearest one that does */
  let handles = new Map<string, { handle: WatchHandle; ancestor: boolean }>()
  let timer: unknown
  let running: Promise<void> | undefined
  let dirty = false
  let stopped = false

  const listener = (directory: string) => (filename: string | null) => {
    const path = filename === null ? undefined : join(directory, filename)
    if (path === ignore) return
    // a file the run depends on counts wherever it lives (a tsconfig inherited from node_modules, the
    // refresh stamp); a new source file does not when it sits in node_modules
    if (path === undefined || watched.has(path)) return schedule()
    if (SOURCE.test(path) && !path.split(sep).includes('node_modules')) schedule()
  }

  /** The directory watched, else its nearest existing ancestor (for the entry on the way to it); else nothing */
  const open = (directory: string): { handle: WatchHandle; ancestor: boolean } | undefined => {
    const exact = (): { handle: WatchHandle; ancestor: boolean } | undefined => {
      try {
        return { handle: watch(directory, listener(directory)), ancestor: false }
      } catch {
        return undefined // does not exist (yet), or cannot be watched
      }
    }
    const watchedDirectory = exact()
    if (watchedDirectory) return watchedDirectory
    for (let parent = dirname(directory); ; parent = dirname(parent)) {
      const next = relative(parent, directory).split(sep)[0]
      let handle: WatchHandle
      try {
        handle = watch(parent, (filename) => {
          if (filename === null || filename === next) schedule()
        })
      } catch {
        if (dirname(parent) === parent) return undefined
        continue
      }
      // the directory may have appeared between the two attempts, with no event to tell
      const appeared = exact()
      if (appeared) {
        handle.close()
        return appeared
      }
      return { handle, ancestor: true }
    }
  }

  /** Watches the directories of `files`; `startedAt` is when the run that returned them began */
  const sync = async (files: readonly string[], startedAt: number): Promise<void> => {
    if (stopped) return // a run that outlives the abort must not leave handles behind
    watched = new Set(files)
    const directories = new Set(files.map((f) => dirname(f)))
    for (const [directory, { handle }] of handles) {
      if (!directories.has(directory)) {
        handle.close()
        handles.delete(directory)
      }
    }
    const added = new Set<string>()
    for (const directory of directories) {
      const current = handles.get(directory)
      if (current && !current.ancestor) continue
      // a directory that was waited for is tried again: it may exist now
      current?.handle.close()
      handles.delete(directory)
      const opened = open(directory)
      if (!opened) continue
      handles.set(directory, opened)
      if (!opened.ancestor) added.add(directory)
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
      const startedAt = clock.now()
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
    clock.clearTimeout(timer)
    timer = clock.setTimeout(trigger, debounceMs)
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
  clock.clearTimeout(timer)
  for (const { handle } of handles.values()) handle.close()
  handles = new Map()
  await running
}

/** The I/O `watch` adds to the operations': how directories are watched, files stamped and time read. */
export interface WatchDeps extends OperationDeps {
  /** Defaults to `fs.watch` */
  watch?: WatchFn
  /** Defaults to `fs.stat` */
  mtime?: MtimeFn
  /** Defaults to the system clock */
  clock?: Clock
}

/** What one pass of `watch` produced: the generation, or the failure that kept it from running. */
export type WatchEvent =
  | { kind: 'run'; result: WriteResult }
  | { kind: 'error'; configFileName: string; message: string }

export interface WatchOptions {
  /** Quiet time before regenerating. Defaults to 100 */
  debounceMs?: number
  /** Ends the watch, after the run in flight has finished */
  signal?: AbortSignal
  /** Called after every pass, the first one included */
  onEvent(event: WatchEvent): void
}

/**
 * `write`, again whenever a file the generation depends on changes (the tsconfig and its `extends` chain, the schema
 * snapshot, the refresh stamp of a live schema) or a source file appears next to one that is scanned. The planner and
 * a live schema are kept between runs. A broken tsconfig is reported as an `error` event and waited out; nothing but
 * `signal` ends the watch.
 */
export async function watch(
  deps: WatchDeps,
  input: WriteInput,
  options: WatchOptions
): Promise<void> {
  const resolved = resolveDeps(deps)
  const generator = createGenerator(resolved)
  const configFileName = resolve(resolved.cwd, input.project ?? 'tsconfig.json')
  try {
    await watchLoop({
      watch: deps.watch ?? nodeWatch,
      mtime: deps.mtime ?? nodeMtime,
      clock: deps.clock ?? nodeClock,
      debounceMs: options.debounceMs ?? 100,
      ...(options.signal ? { signal: options.signal } : {}),
      ignore: resolve(resolved.cwd, input.out),
      run: async () => {
        try {
          const result = await writeWith(resolved, input, generator)
          options.onEvent({ kind: 'run', result })
          return result.watchedFiles
        } catch (error) {
          // a broken tsconfig must not end the watch: report it and wait for the fix
          options.onEvent({ kind: 'error', configFileName, message: messageOf(error) })
          return [configFileName]
        }
      },
    })
  } finally {
    await generator.close()
  }
}
