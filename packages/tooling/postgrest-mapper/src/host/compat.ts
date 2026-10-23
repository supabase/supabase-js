/** The planner ABI this package was written against (`planner_info().abi`); a wasm that speaks another one is refused. */
export const PLANNER_ABI = 2

/**
 * How two PostgREST releases relate (design v3 §4.4): the same, another patch of the same line (`16.4` and `16.4.1`;
 * a missing patch is `.0`), or another line, which includes a release that is not `<major>.<minor>[.<patch>]`.
 */
export type ReleaseRelation = { kind: 'same' } | { kind: 'patch' } | { kind: 'line' }

const RELEASE = /^(\d+)\.(\d+)(?:\.(\d+))?$/

export function compareReleases(a: string, b: string): ReleaseRelation {
  const left = RELEASE.exec(a)
  const right = RELEASE.exec(b)
  if (!left || !right || left[1] !== right[1] || left[2] !== right[2]) return { kind: 'line' }
  return Number(left[3] ?? 0) === Number(right[3] ?? 0) ? { kind: 'same' } : { kind: 'patch' }
}

/** A release somebody states (the configuration, the server the schema came from) to hold against the planner's. */
export interface ReleaseClaim {
  /** How the message names it, for example `option 'postgrest'` */
  what: string
  release: string
}

export interface ReleaseVerdict {
  /** Another line than the planner's: the planner's answers say nothing about that server */
  failures: string[]
  /** Another patch of the planner's line */
  warnings: string[]
}

/** Holds each claimed release against the one the planner models. Pure. */
export function judgeReleases(plannerRelease: string, claims: ReleaseClaim[]): ReleaseVerdict {
  const verdict: ReleaseVerdict = { failures: [], warnings: [] }
  for (const { what, release } of claims) {
    const relation = compareReleases(release, plannerRelease)
    if (relation.kind === 'line')
      verdict.failures.push(
        `${what} '${release}' is not the PostgREST line the planner models (${plannerRelease})`
      )
    else if (relation.kind === 'patch')
      verdict.warnings.push(
        `${what} '${release}' differs by patch from the PostgREST release the planner models (${plannerRelease})`
      )
  }
  return verdict
}
