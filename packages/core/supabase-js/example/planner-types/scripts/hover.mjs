// Prints what the editor shows when you hover the variable of each `const { data: x } = await ...` in a file:
//   pnpm hover src/select.ts [name]
// It asks the TypeScript compiler (the same one as the editor's) for the type of every destructured `data`.
import ts from 'typescript'
import path from 'node:path'

const [file, only] = process.argv.slice(2)
if (!file) {
  console.error('usage: pnpm hover <file> [variable]')
  process.exit(2)
}

const configPath = ts.findConfigFile(process.cwd(), ts.sys.fileExists, 'tsconfig.json')
const config = ts.getParsedCommandLineOfConfigFile(
  configPath,
  {},
  { ...ts.sys, onUnRecoverableConfigFileDiagnostic: () => {} }
)
const program = ts.createProgram(config.fileNames, config.options)
const checker = program.getTypeChecker()
const source = program.getSourceFile(path.resolve(file))
if (!source) {
  console.error(`${file} is not part of the project`)
  process.exit(2)
}

const flags =
  ts.TypeFormatFlags.NoTruncation |
  ts.TypeFormatFlags.MultilineObjectLiterals |
  ts.TypeFormatFlags.InTypeAlias |
  ts.TypeFormatFlags.UseSingleQuotesForStringLiteralType

function visit(node) {
  if (
    ts.isVariableDeclaration(node) &&
    node.initializer &&
    ts.isAwaitExpression(node.initializer)
  ) {
    const names = ts.isObjectBindingPattern(node.name)
      ? node.name.elements.map((element) => element.name)
      : [node.name]
    for (const name of names) {
      if (!ts.isIdentifier(name) || (only && name.text !== only)) continue
      const type = checker.getTypeAtLocation(name)
      const line = source.getLineAndCharacterOfPosition(name.getStart()).line + 1
      console.log(
        `${file}:${line}  ${name.text}: ${checker.typeToString(type, undefined, flags)}\n`
      )
    }
  }
  ts.forEachChild(node, visit)
}
visit(source)
