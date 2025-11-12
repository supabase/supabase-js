#!/usr/bin/env node

const fs = require('node:fs')
const path = require('node:path')

// Get the directory of the script
const scriptDir = __dirname
const projectRoot = path.dirname(path.dirname(scriptDir))

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

// Update imports in deno.json
denoJson.imports = {
  '@supabase/realtime-js': `npm:@supabase/realtime-js@${versions.realtime}`,
  '@supabase/functions-js': `npm:@supabase/functions-js@${versions.functions}`,
  '@supabase/postgrest-js': `npm:@supabase/postgrest-js@${versions.postgrest}`,
  '@supabase/auth-js': `npm:@supabase/auth-js@${versions.auth}`,
  '@supabase/storage-js': `npm:@supabase/storage-js@${versions.storage}/dist/module/index.js`,
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