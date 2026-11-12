import { fileURLToPath } from 'node:url'
import parser from '@typescript-eslint/parser'

/** @type {import('eslint').Rule.RuleModule} */
const requireHiddenReason = {
  meta: {
    schema: [],
    messages: {
      missingReason: 'Add a reason on the same line as @hidden.',
      hiddenMustBeLast: 'Move @hidden and its reason to the final line of the TSDoc comment.',
    },
  },
  create(context) {
    return {
      Program() {
        for (const comment of context.sourceCode.getAllComments()) {
          if (comment.type !== 'Block' || !comment.value.startsWith('*') || !comment.loc) continue

          const lines = comment.value.split(/\r?\n/u)
          for (const [index, line] of lines.entries()) {
            const tag = /^\s*\*?\s*@hidden(?=\s|$)(.*)$/u.exec(line)
            if (!tag) continue

            const column =
              line.indexOf('@hidden') + (index === 0 ? comment.loc.start.column + 2 : 0)
            const lineNumber = comment.loc.start.line + index
            const loc = {
              start: { line: lineNumber, column },
              end: { line: lineNumber, column: column + '@hidden'.length },
            }

            const reason = tag[1].trim()
            if (!reason || reason.startsWith('@')) {
              context.report({ loc, messageId: 'missingReason' })
            }

            if (lines.slice(index + 1).some((line) => !/^\s*\*?\s*$/u.test(line))) {
              context.report({ loc, messageId: 'hiddenMustBeLast' })
            }
          }
        }
      },
    }
  },
}

/** @satisfies {import('eslint').Linter.Config} */
export const docsRules = {
  basePath: fileURLToPath(new URL('./packages/core', import.meta.url)),
  files: ['*/src/**/*.{ts,tsx,mts,cts}'],
  plugins: { docs: { rules: { 'require-hidden-reason': requireHiddenReason } } },
  rules: { 'docs/require-hidden-reason': 'error' },
}

export default [
  {
    ...docsRules,
    linterOptions: { noInlineConfig: true },
    languageOptions: { parser, parserOptions: { tsconfigRootDir: import.meta.dirname } },
  },
]
