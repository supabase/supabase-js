import { watch as fsWatch } from 'node:fs'
import { stat } from 'node:fs/promises'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { createGenerator, type ProjectFs } from '../generate'
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
  watcher.on('error', () => undefined)
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
  /** Lists a directory; rejects for anything that is not one */
  readdir: ProjectFs['readdir']
  clock?: Clock
  debounceMs: number
  signal?: AbortSignal
  /**
   * Runs one generation and returns what it depends on (absolute paths): the files, and the directories it scanned
   * for sources, where a created file or directory changes the result, and the entries the scan met in them (the
   * ones it left out too): what a source file or directory is compared with to tell that it appeared after the scan
   */
  run(): Promise<{
    files: readonly string[]
    directories: readonly string[]
    entries: readonly string[]
  }>
  /** A file the loop itself writes: its events never retrigger */
  ignore: string
}

/**
 * Runs `run` once, then again (debounced, never concurrently) whenever a file it depended on changes or a source
 * file appears in a directory that holds one. Directories are watched one by one, not recursively: the directories
 * the run scanned are watched, and a directory created or replaced in one of them is watched with everything below
 * it as soon as the event arrives, and runs again, which scans its files. A directory that does not exist yet (the
 * cache directory of a project that never ran, the folder of a snapshot) is waited for through its nearest existing
 * ancestor: the ancestor's first event on the way to it runs again, and that run watches the directory itself once
 * it exists. A file edited while a run was in flight, before its directory was watched, is detected by its
 * modification time when the directory starts being watched, and runs again; so is a source file or directory that
 * appeared in a scanned directory after the run listed it, whatever its modification time (a file moved in keeps
 * the old one): it is told by being absent from what the run met. Resolves when `signal` aborts, after
 * the run in flight has finished.
 */
export async function watchLoop(options: WatchLoopOptions): Promise<void> {
  const { watch, mtime, readdir, debounceMs, signal, ignore } = options
  const clock = options.clock ?? nodeClock
  let watched = new Set<string>()
  /** The directories whose new entries may be directories to watch */
  let scanned = new Set<string>()
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
    if (path.split(sep).includes('node_modules')) return
    if (SOURCE.test(path)) schedule()
    if (scanned.has(directory)) void adopt(path)
  }

  /** Watches `directory` and every directory below it, replacing the handle of one that was replaced */
  const adoptTree = async (directory: string): Promise<void> => {
    let entries: Awaited<ReturnType<typeof readdir>>
    try {
      entries = await readdir(directory)
    } catch {
      return // a file, or gone again
    }
    if (stopped) return
    handles.get(directory)?.handle.close()
    handles.delete(directory)
    try {
      handles.set(directory, { handle: watch(directory, listener(directory)), ancestor: false })
    } catch {
      return
    }
    scanned.add(directory)
    await Promise.all(
      entries
        .filter((e) => e.isDirectory && e.name !== 'node_modules')
        .map((e) => adoptTree(join(directory, e.name)))
    )
  }

  /** An entry appeared in a scanned directory: when it is a directory, watch it and run again to scan it */
  const adopt = async (path: string): Promise<void> => {
    await adoptTree(path)
    if (!stopped && handles.has(path)) schedule()
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
  const sync = async (
    files: readonly string[],
    scannedDirectories: readonly string[],
    scannedEntries: readonly string[],
    startedAt: number
  ): Promise<void> => {
    if (stopped) return // a run that outlives the abort must not leave handles behind
    watched = new Set(files)
    scanned = new Set(scannedDirectories)
    const directories = new Set([...files.map((f) => dirname(f)), ...scannedDirectories])
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
    // The same goes for what appeared in a scanned directory after the scan listed it: no event told, and neither
    // is in `files`. A source file or a directory the run did not meet is new, by membership: its modification
    // time says nothing (a file renamed into place keeps the old one).
    if (
      !dirty &&
      (await appeared(
        [...added].filter((d) => scanned.has(d)),
        new Set([...watched, ...scannedEntries])
      ))
    ) {
      dirty = true
    }
  }

  /** Whether `directories` hold a source file or directory that the run neither depended on nor met */
  const appeared = async (
    directories: readonly string[],
    known: ReadonlySet<string>
  ): Promise<boolean> => {
    const listed = await Promise.all(
      directories.map(async (directory) => {
        try {
          return (await readdir(directory)).map((e) => ({ path: join(directory, e.name), ...e }))
        } catch {
          return [] // gone again
        }
      })
    )
    return listed.flat().some(
      (e) =>
        !known.has(e.path) &&
        e.name !== 'node_modules' &&
        // the output of the run lives in the directory the loop itself writes to
        e.path !== ignore &&
        !ignore.startsWith(e.path + sep) &&
        (e.isDirectory || SOURCE.test(e.name))
    )
  }

  const cycle = async (): Promise<void> => {
    do {
      dirty = false
      const startedAt = clock.now()
      const ran = await options.run()
      await sync(ran.files, ran.directories, ran.entries, startedAt)
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

/** `watch` is the one holder of its generator: a live schema is polled for as long as it runs. */
const WATCH_HOLDER = 'watch'

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
 * snapshot, the refresh stamp of a live schema: while it runs, a live schema is polled for DDL and the poller writes
 * the stamp when the database changed, unless `pollIntervalMs` turns that off), a source file appears next to one that is scanned, or a directory
 * is created (or replaced) below a scanned one, so that the files in it are scanned. The planner and
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
      readdir: resolved.fs.readdir,
      clock: deps.clock ?? nodeClock,
      debounceMs: options.debounceMs ?? 100,
      ...(options.signal ? { signal: options.signal } : {}),
      ignore: resolve(resolved.cwd, input.out),
      run: async () => {
        try {
          const result = await writeWith(resolved, input, generator, WATCH_HOLDER)
          options.onEvent({ kind: 'run', result })
          return {
            files: result.watchedFiles,
            directories: result.scannedDirectories,
            entries: result.scannedEntries,
          }
        } catch (error) {
          // a broken tsconfig must not end the watch: report it and wait for the fix
          options.onEvent({ kind: 'error', configFileName, message: messageOf(error) })
          return { files: [configFileName], directories: [], entries: [] }
        }
      },
    })
  } finally {
    await generator.close()
  }
}
