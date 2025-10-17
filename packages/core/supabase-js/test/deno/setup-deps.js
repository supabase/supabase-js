#!/usr/bin/env node

const fs = require('node:fs')
const path = require('node:path')

// Get the directory of the script
const scriptDir = __dirname
const projectRoot = path.dirname(path.dirname(scriptDir))
const monorepoRoot = path.dirname(path.dirname(path.dirname(path.dirname(path.dirname(scriptDir)))))

// Read package.json from main project
const packageJsonPath = path.join(projectRoot, 'package.json')
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'))

// Extract versions from package.json dependencies
const getVersion = (packageName) => {
  const dependencies = packageJson.dependencies || {}
  const devDependencies = packageJson.devDependencies || {}

  // Check both dependencies and devDependencies
  return dependencies[packageName] || devDependencies[packageName] || null
}

const versions = {
  realtime: getVersion('@supabase/realtime-js'),
  functions: getVersion('@supabase/functions-js'),
  postgrest: getVersion('@supabase/postgrest-js'),
  auth: getVersion('@supabase/auth-js'),
  storage: getVersion('@supabase/storage-js'),
  node_fetch: getVersion('@supabase/node-fetch'),
}

// Read or create deno.json
const denoJsonPath = path.join(scriptDir, 'deno.json')
let denoJson = {
  lock: false,
  imports: {},
}

try {
  if (fs.existsSync(denoJsonPath)) {
    denoJson = JSON.parse(fs.readFileSync(denoJsonPath, 'utf8'))
  }
} catch (error) {
  console.warn('Warning: Could not read existing deno.json, creating new one')
}

// Paths to workspace packages (not published to npm or need local builds)
const storageVectorsPath = path.join(monorepoRoot, 'packages/integrations/storage-vectors-js/dist/index.js')
const storageVectorsUrl = `file://${storageVectorsPath}`

const storageJsPath = path.join(monorepoRoot, 'packages/core/storage-js/dist/module/index.js')
const storageJsUrl = `file://${storageJsPath}`

// Determine storage-js entry point based on environment variable
// For Deno 1.x (uses npm package): set STORAGE_JS_ENTRY=main
// For Deno 2.x (uses local build): don't set or set to 'module'
const useLocalStorageJs = process.env.STORAGE_JS_ENTRY !== 'main'
const storageJsImport = useLocalStorageJs
  ? storageJsUrl
  : process.env.STORAGE_JS_ENTRY === 'main'
    ? `npm:@supabase/storage-js@${versions.storage}/dist/main/index.js`
    : `npm:@supabase/storage-js@${versions.storage}/dist/module/index.js`

// Update imports in deno.json
denoJson.imports = {
  '@supabase/realtime-js': `npm:@supabase/realtime-js@${versions.realtime}`,
  '@supabase/functions-js': `npm:@supabase/functions-js@${versions.functions}`,
  '@supabase/postgrest-js': `npm:@supabase/postgrest-js@${versions.postgrest}`,
  '@supabase/auth-js': `npm:@supabase/auth-js@${versions.auth}`,
  '@supabase/storage-js': storageJsImport,
  '@supabase/node-fetch': `npm:@supabase/node-fetch@${versions.node_fetch}`,
}

// Only add storage-vectors-js when using local storage-js build
if (useLocalStorageJs) {
  denoJson.imports['@supabase/storage-vectors-js'] = storageVectorsUrl
}

// Ensure Node types are available for Deno type-checking of .d.ts files
denoJson.compilerOptions = denoJson.compilerOptions || {}
denoJson.compilerOptions.types = Array.isArray(denoJson.compilerOptions.types)
  ? Array.from(new Set([...denoJson.compilerOptions.types, 'npm:@types/node']))
  : ['npm:@types/node']

// Write updated deno.json
fs.writeFileSync(denoJsonPath, JSON.stringify(denoJson, null, 2) + '\n')

console.log('Updated deno.json with versions from package.json')
console.log('Versions used:', versions)
