/**
 * A small JSONC reader that keeps source offsets, so `init` can edit a tsconfig in place (comments and formatting
 * survive) and option diagnostics can be reported at a line and column of the file.
 */

export interface JsoncProperty {
  key: string
  /** Offset of the opening quote of the key */
  keyStart: number
  value: JsoncNode
}

export type JsoncNode =
  | { kind: 'object'; start: number; end: number; properties: JsoncProperty[] }
  | { kind: 'array'; start: number; end: number; items: JsoncNode[] }
  | { kind: 'value'; start: number; end: number; value: unknown }

/** Parses JSON with comments and trailing commas. Throws an `Error` that names the offset of a syntax error. */
export function parseJsonc(text: string): JsoncNode {
  let i = 0
  const fail = (what: string): never => {
    throw new Error(`invalid JSON at offset ${i}: ${what}`)
  }
  const skip = (): void => {
    for (;;) {
      const c = text[i]
      if (c === ' ' || c === '\t' || c === '\n' || c === '\r' || c === '﻿') i++
      else if (c === '/' && text[i + 1] === '/') {
        while (i < text.length && text[i] !== '\n') i++
      } else if (c === '/' && text[i + 1] === '*') {
        const end = text.indexOf('*/', i + 2)
        if (end === -1) fail('unterminated comment')
        i = end + 2
      } else return
    }
  }
  const string = (): string => {
    const start = i
    i++
    while (i < text.length && text[i] !== '"') i += text[i] === '\\' ? 2 : 1
    if (i >= text.length) fail('unterminated string')
    i++
    return JSON.parse(text.slice(start, i)) as string
  }
  const node = (): JsoncNode => {
    skip()
    const start = i
    const c = text[i]
    if (c === '{') {
      i++
      const properties: JsoncProperty[] = []
      for (;;) {
        skip()
        if (text[i] === '}') break
        if (text[i] !== '"') fail('expected a property name')
        const keyStart = i
        const key = string()
        skip()
        if (text[i] !== ':') fail("expected ':'")
        i++
        properties.push({ key, keyStart, value: node() })
        skip()
        if (text[i] === ',') i++
        else if (text[i] !== '}') fail("expected ',' or '}'")
      }
      i++
      return { kind: 'object', start, end: i, properties }
    }
    if (c === '[') {
      i++
      const items: JsoncNode[] = []
      for (;;) {
        skip()
        if (text[i] === ']') break
        items.push(node())
        skip()
        if (text[i] === ',') i++
        else if (text[i] !== ']') fail("expected ',' or ']'")
      }
      i++
      return { kind: 'array', start, end: i, items }
    }
    if (c === '"') {
      const value = string()
      return { kind: 'value', start, end: i, value }
    }
    const match = /^(?:-?\d[\d.eE+-]*|true|false|null)/.exec(text.slice(i))
    if (!match) return fail('unexpected token')
    i += match[0].length
    return { kind: 'value', start, end: i, value: JSON.parse(match[0]) }
  }
  const root = node()
  skip()
  if (i < text.length) fail('unexpected content after the value')
  return root
}

/** The node at `path` (property names and array indexes), or `undefined`. */
export function locate(root: JsoncNode, path: readonly (string | number)[]): JsoncNode | undefined {
  let current: JsoncNode | undefined = root
  for (const step of path) {
    if (current?.kind === 'object' && typeof step === 'string') {
      current = current.properties.find((p) => p.key === step)?.value
    } else if (current?.kind === 'array' && typeof step === 'number') {
      current = current.items[step]
    } else return undefined
  }
  return current
}

/** 1-based line and column of an offset. */
export function positionOf(text: string, offset: number): { line: number; column: number } {
  let line = 1
  let last = -1
  for (let i = text.indexOf('\n'); i !== -1 && i < offset; i = text.indexOf('\n', i + 1)) {
    line++
    last = i
  }
  return { line, column: offset - last }
}

function lineIndent(text: string, offset: number): string {
  const lineStart = text.lastIndexOf('\n', offset - 1) + 1
  return /^[ \t]*/.exec(text.slice(lineStart, offset))![0]
}

const hasNewline = (text: string, from: number, to: number): boolean =>
  text.slice(from, to).includes('\n')

function insertIntoObject(
  text: string,
  object: Extract<JsoncNode, { kind: 'object' }>,
  key: string,
  literal: string
): string {
  const entry = `${JSON.stringify(key)}: ${literal}`
  const last = object.properties[object.properties.length - 1]
  if (!last) {
    const indent = lineIndent(text, object.start)
    return (
      text.slice(0, object.start) + `{\n${indent}  ${entry}\n${indent}}` + text.slice(object.end)
    )
  }
  const first = object.properties[0]!
  const separator = hasNewline(text, object.start, first.keyStart)
    ? `,\n${lineIndent(text, first.keyStart)}`
    : ', '
  return text.slice(0, last.value.end) + separator + entry + text.slice(last.value.end)
}

const isObjectValue = (value: unknown): boolean => typeof value === 'object' && value !== null

/** `value` as JSON; an object is spread over lines, continuing at `indent`. */
const literalOf = (value: unknown, indent: string): string =>
  isObjectValue(value)
    ? JSON.stringify(value, null, 2).split('\n').join(`\n${indent}`)
    : JSON.stringify(value)

/**
 * Adds `value` to the array at `path` (a missing array, and the objects leading to it, are created), leaving every
 * other byte of `text` as it was. Returns `undefined` when `covered` says the array already holds it.
 */
export function addToArray(
  text: string,
  path: readonly string[],
  value: unknown,
  covered: (existing: JsoncNode[]) => boolean
): string | undefined {
  const root = parseJsonc(text)
  if (root.kind !== 'object') throw new Error('the top-level value must be an object')
  let object = root
  for (let depth = 0; depth < path.length; depth++) {
    const step = path[depth]!
    const child = object.properties.find((p) => p.key === step)?.value
    const isLast = depth === path.length - 1
    if (!child) {
      let literal: string
      if (isObjectValue(value) && depth === path.length - 1) {
        const first = object.properties[0]
        const base = first
          ? lineIndent(text, first.keyStart)
          : `${lineIndent(text, object.start)}  `
        literal = `[\n${base}  ${literalOf(value, `${base}  `)}\n${base}]`
      } else {
        literal = JSON.stringify([value])
      }
      for (let d = path.length - 1; d > depth; d--)
        literal = `{ ${JSON.stringify(path[d])}: ${literal} }`
      return insertIntoObject(text, object, step, literal)
    }
    if (isLast) {
      if (child.kind !== 'array') throw new Error(`'${path.join('.')}' must be an array`)
      if (covered(child.items)) return undefined
      const lastItem = child.items[child.items.length - 1]
      if (!lastItem) {
        if (!isObjectValue(value)) {
          return text.slice(0, child.start + 1) + literalOf(value, '') + text.slice(child.start + 1)
        }
        const base = lineIndent(text, child.start)
        return (
          text.slice(0, child.start) +
          `[\n${base}  ${literalOf(value, `${base}  `)}\n${base}]` +
          text.slice(child.end)
        )
      }
      const first = child.items[0]!
      const multiline = hasNewline(text, child.start, first.start)
      const indent = multiline ? lineIndent(text, first.start) : ''
      const separator = multiline ? `,\n${indent}` : ', '
      return (
        text.slice(0, lastItem.end) +
        separator +
        (multiline ? literalOf(value, indent) : JSON.stringify(value)) +
        text.slice(lastItem.end)
      )
    }
    if (child.kind !== 'object')
      throw new Error(`'${path.slice(0, depth + 1).join('.')}' must be an object`)
    object = child
  }
  return undefined
}

/**
 * Adds `value` to the string array at `path` (a missing array, and the objects leading to it, are created), leaving
 * every other byte of `text` as it was. Returns `undefined` when the array already holds it.
 */
export function addToStringArray(
  text: string,
  path: readonly string[],
  value: string,
  covered: (existing: string[]) => boolean = (existing) => existing.includes(value)
): string | undefined {
  return addToArray(text, path, value, (items) =>
    covered(
      items.flatMap((item) =>
        item.kind === 'value' && typeof item.value === 'string' ? [item.value] : []
      )
    )
  )
}
