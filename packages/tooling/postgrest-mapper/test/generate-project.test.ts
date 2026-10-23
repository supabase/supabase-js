import { dirname, join } from 'node:path'
import { resolveProjectFiles, stripJsonc, type ProjectFs } from '../src'

/** A file system of `files` (absolute path to text) with directories implied by the paths. */
function memoryFs(files: Record<string, string>): ProjectFs {
  return {
    async readFile(path) {
      const text = files[path]
      if (text === undefined) throw Object.assign(new Error(`ENOENT ${path}`), { code: 'ENOENT' })
      return text
    },
    async readdir(path) {
      const entries = new Map<string, boolean>()
      for (const file of Object.keys(files)) {
        if (!file.startsWith(path + '/')) continue
        const rest = file.slice(path.length + 1)
        const [head, ...tail] = rest.split('/')
        entries.set(head!, tail.length > 0)
      }
      if (entries.size === 0) throw Object.assign(new Error(`ENOENT ${path}`), { code: 'ENOENT' })
      return [...entries].map(([name, isDirectory]) => ({ name, isDirectory }))
    },
  }
}

const DIR = '/work/app'
const at = (...parts: string[]) => join(DIR, ...parts)
const SOURCES = {
  [at('src/a.ts')]: '',
  [at('src/nested/b.tsx')]: '',
  [at('src/types.d.ts')]: '',
  [at('src/legacy.js')]: '',
  [at('src/skip/c.ts')]: '',
  [at('tools/d.ts')]: '',
  [at('dist/e.ts')]: '',
  [at('node_modules/pkg/index.ts')]: '',
}

const resolveWith = (tsconfig: string, scan?: string[], extra: Record<string, string> = {}) =>
  resolveProjectFiles(memoryFs({ ...SOURCES, ...extra, [at('tsconfig.json')]: tsconfig }), {
    configFileName: at('tsconfig.json'),
    projectDir: DIR,
    ...(scan ? { scan } : {}),
  })

describe('stripJsonc', () => {
  it('drops comments and trailing commas outside strings', () => {
    const text = `{
      // line
      "a": "x // not a comment", /* block */
      "b": [1, 2,],
    }`
    expect(JSON.parse(stripJsonc(text))).toEqual({ a: 'x // not a comment', b: [1, 2] })
  })
})

describe('resolveProjectFiles', () => {
  it('takes include minus exclude, never declarations, scripts or node_modules', async () => {
    const { files, warnings } = await resolveWith(
      `{ // comment\n "include": ["src", "tools"], "exclude": ["src/skip"], }`
    )
    expect(files).toEqual([at('src/a.ts'), at('src/nested/b.tsx'), at('tools/d.ts')])
    expect(warnings).toEqual([])
  })

  it('takes everything below the config without include or files, but outDir and node_modules', async () => {
    const { files } = await resolveWith(`{ "compilerOptions": { "outDir": "dist" } }`)
    expect(files).toEqual([
      at('src/a.ts'),
      at('src/nested/b.tsx'),
      at('src/skip/c.ts'),
      at('tools/d.ts'),
    ])
  })

  it('adds javascript files when the config allows them', async () => {
    const { files } = await resolveWith(
      `{ "compilerOptions": { "allowJs": true }, "include": ["src/*.*"] }`
    )
    expect(files).toEqual([at('src/a.ts'), at('src/legacy.js')])
  })

  it('lists files explicitly, with include on top', async () => {
    const { files } = await resolveWith(`{ "files": ["tools/d.ts"], "include": ["src/nested"] }`)
    expect(files).toEqual([at('src/nested/b.tsx'), at('tools/d.ts')])
  })

  it('follows a relative extends and lets the child override', async () => {
    const { files } = await resolveWith(
      `{ "extends": "./base.json", "include": ["tools"] }`,
      undefined,
      {
        [at('base.json')]: `{ "include": ["src"], "exclude": ["tools"] }`,
      }
    )
    // include of the child wins; the inherited exclude still applies
    expect(files).toEqual([])
  })

  it('replaces include and files with the scan globs, relative to the project directory', async () => {
    const { files } = await resolveWith(`{ "include": ["tools"] }`, [
      'src/**/*.ts',
      'src/legacy.js',
    ])
    expect(files).toEqual([at('src/a.ts'), at('src/legacy.js'), at('src/skip/c.ts')])
  })

  it('reads a single-star glob as one directory level', async () => {
    const { files } = await resolveWith(`{}`, ['src/*.ts'])
    expect(files).toEqual([at('src/a.ts')])
  })

  it('warns about a config it cannot read and scans nothing from it', async () => {
    const result = await resolveProjectFiles(memoryFs(SOURCES), {
      configFileName: at('missing.json'),
      projectDir: DIR,
    })
    expect(result.warnings).toHaveLength(1)
    expect(dirname(at('missing.json'))).toBe(DIR)
  })
})
