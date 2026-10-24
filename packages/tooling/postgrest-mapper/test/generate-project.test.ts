import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { resolveProjectFiles, stripJsonc, type ProjectFs } from '../src'
import { nodeProjectFs } from '../src/generate/project'

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
        const prefix = path.endsWith('/') ? path : path + '/'
        if (!file.startsWith(prefix)) continue
        const rest = file.slice(prefix.length)
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

  it('walks from the root of an absolute include, and applies an absolute exclude', async () => {
    const { files, warnings } = await resolveWith(
      `{ "include": ["/work/app/src/**/*.ts", "/work/app/tools"], "exclude": ["/work/app/src/skip"] }`
    )
    expect(files).toEqual([at('src/a.ts'), at('tools/d.ts')])
    expect(warnings).toEqual([])
  })

  it('walks from the filesystem root for an absolute pattern that starts with a wildcard', async () => {
    const { files } = await resolveWith(`{ "include": ["/**/nested/*.tsx"] }`, undefined, {
      '/elsewhere/nested/z.tsx': '',
    })
    expect(files).toEqual(['/elsewhere/nested/z.tsx', at('src/nested/b.tsx')])
  })

  it('reads a single-star glob as one directory level', async () => {
    const { files } = await resolveWith(`{}`, ['src/*.ts'])
    expect(files).toEqual([at('src/a.ts')])
  })

  it('expands brace alternatives in scan globs, not in tsconfig include', async () => {
    const extra = {
      [at('src/m.mts')]: '',
      [at('src/n.cts')]: '',
      [at('src/b/x.tsx')]: '',
      [at('src/c/y.ts')]: '',
    }
    const scanned = await resolveWith(`{}`, ['src/**/*.{ts,tsx,mts,cts}'], extra)
    expect(scanned.files).toEqual([
      at('src/a.ts'),
      at('src/b/x.tsx'),
      at('src/c/y.ts'),
      at('src/m.mts'),
      at('src/n.cts'),
      at('src/nested/b.tsx'),
      at('src/skip/c.ts'),
    ])
    const grouped = await resolveWith(`{}`, ['src/{b,c}/**/*.{ts,{tsx,js}}'], extra)
    expect(grouped.files).toEqual([at('src/b/x.tsx'), at('src/c/y.ts')])
    const included = await resolveWith(`{ "include": ["src/*.{ts,tsx}"] }`)
    expect(included.files).toEqual([])
  })

  it('warns about a scan glob with an unbalanced brace and ignores it', async () => {
    const { files, warnings } = await resolveWith(`{}`, ['src/*.{ts,tsx', 'tools/*.ts'])
    expect(files).toEqual([at('tools/d.ts')])
    expect(warnings).toEqual([`scan pattern 'src/*.{ts,tsx' has an unbalanced brace: ignored`])
  })

  it('warns about a config it cannot read and scans nothing from it', async () => {
    const result = await resolveProjectFiles(memoryFs(SOURCES), {
      configFileName: at('missing.json'),
      projectDir: DIR,
    })
    expect(result.warnings).toHaveLength(1)
    expect(dirname(at('missing.json'))).toBe(DIR)
  })

  describe('the configs it read', () => {
    it('is the config itself when it extends nothing', async () => {
      const { configFiles } = await resolveWith(`{ "include": ["src"] }`)
      expect(configFiles).toEqual([at('tsconfig.json')])
    })

    it('is the whole extends chain: relative, nested, an array and a package', async () => {
      const { configFiles, files } = await resolveWith(
        `{ "extends": ["./base.json", "@acme/tsconfig/lib.json", "@acme/preset"] }`,
        undefined,
        {
          [at('base.json')]: `{ "extends": "./configs/root" }`,
          [at('configs/root.json')]: `{ "include": ["../src"] }`,
          // found in the nearest node_modules upwards
          ['/work/node_modules/@acme/tsconfig/lib.json']: `{ "exclude": ["/work/app/src/skip"] }`,
          // a bare package name is its tsconfig.json
          [at('node_modules/@acme/preset/tsconfig.json')]:
            `{ "compilerOptions": { "allowJs": true } }`,
        }
      )
      expect(configFiles).toEqual(
        [
          at('tsconfig.json'),
          at('base.json'),
          at('configs/root.json'),
          '/work/node_modules/@acme/tsconfig/lib.json',
          at('node_modules/@acme/preset/tsconfig.json'),
        ].sort()
      )
      // the package configs apply: the inherited include, exclude and allowJs
      expect(files).toEqual([at('src/a.ts'), at('src/legacy.js'), at('src/nested/b.tsx')])
    })

    it('lists a parent that cannot be read, so creating it is noticed', async () => {
      const { configFiles, warnings } = await resolveWith(`{ "extends": "./later.json" }`)
      expect(configFiles).toEqual([at('later.json'), at('tsconfig.json')])
      expect(warnings).toHaveLength(1)
    })
  })
})

describe('resolveProjectFiles on a real project tree', () => {
  let dir: string
  const write = (name: string, text = ''): void => {
    mkdirSync(dirname(join(dir, name)), { recursive: true })
    writeFileSync(join(dir, name), text)
  }
  const resolveTree = (configName = 'tsconfig.json') =>
    resolveProjectFiles(nodeProjectFs, {
      configFileName: join(dir, configName),
      projectDir: dir,
    })
  const rel = (files: string[]): string[] => files.map((f) => f.slice(dir.length + 1))

  beforeEach(() => {
    dir = mkdtempSync(join(realpathSync(tmpdir()), 'postgrest-mapper-tsconfig-'))
  })
  afterEach(() => rmSync(dir, { recursive: true, force: true }))

  describe('${configDir}', () => {
    it('stands for the directory of the config in include, exclude and files', async () => {
      write('src/a.ts')
      write('src/skip/b.ts')
      write('tools/c.ts')
      write(
        'tsconfig.json',
        JSON.stringify({
          files: ['${configDir}/tools/c.ts'],
          include: ['${configDir}/src/**/*.ts'],
          exclude: ['${configDir}/src/skip'],
        })
      )
      const { files, warnings } = await resolveTree()
      expect(rel(files)).toEqual(['src/a.ts', 'tools/c.ts'])
      expect(warnings).toEqual([])
    })

    it('stands for the directory of the config being loaded, not of the one that inherits it', async () => {
      write('app/src/a.ts')
      write('app/dist/gen.ts')
      write('shared/configs/src/wrong.ts')
      write(
        'shared/configs/base.json',
        JSON.stringify({
          include: ['${configDir}/src'],
          compilerOptions: { outDir: '${configDir}/dist' },
        })
      )
      write('app/tsconfig.json', JSON.stringify({ extends: '../shared/configs/base.json' }))
      const { files } = await resolveProjectFiles(nodeProjectFs, {
        configFileName: join(dir, 'app/tsconfig.json'),
        projectDir: join(dir, 'app'),
      })
      expect(rel(files)).toEqual(['app/src/a.ts'])
      // the inherited outDir is the leaf's too: a pattern reaching into it finds nothing
      write(
        'shared/configs/out.json',
        JSON.stringify({
          include: ['${configDir}'],
          compilerOptions: { outDir: '${configDir}/dist' },
        })
      )
      write('app/out.json', JSON.stringify({ extends: '../shared/configs/out.json' }))
      const out = await resolveProjectFiles(nodeProjectFs, {
        configFileName: join(dir, 'app/out.json'),
        projectDir: join(dir, 'app'),
      })
      expect(rel(out.files)).toEqual(['app/src/a.ts'])
    })
  })

  describe('extends', () => {
    it('resolves an ancestor reached through two branches the same way each time', async () => {
      write('src/a.ts')
      write('src/legacy.js')
      write('tests/t.ts')
      write('base.json', JSON.stringify({ include: ['src'], compilerOptions: { allowJs: true } }))
      write('strict.json', JSON.stringify({ extends: './base.json', include: ['tests'] }))
      write('tsconfig.json', JSON.stringify({ extends: ['./strict.json', './base.json'] }))
      const { files, warnings } = await resolveTree()
      // TypeScript: the later base.json wins, so `src` is included and JavaScript is allowed
      expect(rel(files)).toEqual(['src/a.ts', 'src/legacy.js'])
      expect(warnings).toEqual([])
    })

    it('keeps allowJs from an earlier parent when a later one says nothing about it', async () => {
      write('src/legacy.js')
      write('js.json', JSON.stringify({ compilerOptions: { allowJs: true }, include: ['src'] }))
      write('quiet.json', JSON.stringify({ compilerOptions: { strict: true } }))
      write('tsconfig.json', JSON.stringify({ extends: ['./js.json', './quiet.json'] }))
      expect(rel((await resolveTree()).files)).toEqual(['src/legacy.js'])
    })

    it('warns about a cycle and still resolves the rest', async () => {
      write('src/a.ts')
      write('a.json', JSON.stringify({ extends: './b.json', include: ['src'] }))
      write('b.json', JSON.stringify({ extends: './a.json' }))
      const { files, warnings } = await resolveTree('a.json')
      expect(rel(files)).toEqual(['src/a.ts'])
      expect(warnings).toHaveLength(1)
      expect(warnings[0]).toMatch(/cycle|circular/i)
    })
  })
})
