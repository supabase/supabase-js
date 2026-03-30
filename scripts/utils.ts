import { execSync } from 'child_process'

export function getLastStableTag(): string {
  try {
    return execSync(
      `git tag --list --sort=-version:refname | grep -E '^v?[0-9]+\\.[0-9]+\\.[0-9]+$' | head -n1`
    )
      .toString()
      .trim()
  } catch {
    return ''
  }
}

export function getArg(name: string): string | undefined {
  // supports --name=value and --name value
  const idx = process.argv.findIndex((a) => a === `--${name}` || a.startsWith(`--${name}=`))
  if (idx === -1) return undefined
  const token = process.argv[idx]
  if (token.includes('=')) return token.split('=')[1]
  return process.argv[idx + 1]
}
