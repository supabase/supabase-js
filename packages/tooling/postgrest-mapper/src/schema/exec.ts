import { execFile } from 'node:child_process'
import { ExecTimeoutError } from './errors'
import type { ExecFn } from './types'

const MAX_BUFFER = 512 * 1024 * 1024

/**
 * `ExecFn` over `child_process.execFile`. A non-zero exit resolves; a failure to start rejects, and so does the
 * child still running after `timeoutMs` (it is sent SIGTERM, which `docker run` forwards to its container).
 */
export const nodeExec: ExecFn = (command, args, options) =>
  new Promise((resolve, reject) => {
    execFile(
      command,
      args,
      {
        cwd: options?.cwd,
        env: { ...process.env, ...options?.env },
        encoding: 'utf8',
        maxBuffer: MAX_BUFFER,
        timeout: options?.timeoutMs,
        killSignal: 'SIGTERM',
      },
      (error, stdout, stderr) => {
        if (error?.killed && error.signal === 'SIGTERM' && options?.timeoutMs !== undefined) {
          reject(new ExecTimeoutError(options.timeoutMs))
          return
        }
        if (error && typeof error.code !== 'number' && !error.killed) {
          reject(error)
          return
        }
        const exitCode = !error ? 0 : typeof error.code === 'number' ? error.code : 1
        resolve({ stdout, stderr, exitCode })
      }
    )
  })
