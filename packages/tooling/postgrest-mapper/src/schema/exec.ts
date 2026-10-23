import { execFile } from 'node:child_process'
import type { ExecFn } from './types'

const MAX_BUFFER = 512 * 1024 * 1024

/** `ExecFn` over `child_process.execFile`. A non-zero exit resolves; only a failure to start rejects. */
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
      },
      (error, stdout, stderr) => {
        if (error && typeof error.code !== 'number' && !error.killed) {
          reject(error)
          return
        }
        const exitCode = !error ? 0 : typeof error.code === 'number' ? error.code : 1
        resolve({ stdout, stderr, exitCode })
      }
    )
  })
