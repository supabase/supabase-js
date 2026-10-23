import { scanSource, type ScanOptions, type ScanResult } from '../src'

export function scan(source: string, options?: ScanOptions, fileName = 'a.ts'): ScanResult {
  return scanSource(fileName, source, options)
}

/** `kind|schemas|name|select` per select request, for compact assertions. */
export function selects(result: ScanResult): string[] {
  return result.selects.map((s) => {
    const t = s.target
    const schemas = t.schemas === 'exposed' ? '*' : t.schemas.join(',')
    const name =
      t.kind === 'f' ? `${t.function}(${t.keys ? t.keys.join(',') : '?'}):${t.method}` : t.relation
    return `${t.kind}|${schemas}|${name}|${s.select}`
  })
}

/** `kind|schemas|name|select|operand` per operand request. */
export function operands(result: ScanResult): string[] {
  return result.operands.map((o) => {
    const t = o.target
    const schemas = t.schemas === 'exposed' ? '*' : t.schemas.join(',')
    const name = t.kind === 'f' ? t.function : t.relation
    return `${t.kind}|${schemas}|${name}|${o.select}|${o.operand}`
  })
}
