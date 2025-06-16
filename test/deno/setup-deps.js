#!/usr/bin/env node

const fs = require('node:fs')
const path = require('node:path')

// Get the directory of the script
const scriptDir = __dirname
const projectRoot = path.dirname(path.dirname(scriptDir))

// Read package-lock.json
const packageLockPath = path.join(projectRoot, 'package-lock.json')
const packageLock = JSON.parse(fs.readFileSync(packageLockPath, 'utf8'))

// Extract versions from package-lock.json
const getVersion = (packageName) => {
  const packagePath = `node_modules/${packageName}`
  return packageLock.packages[packagePath]?.version
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

// Update imports in deno.json
denoJson.imports = {
  '@supabase/realtime-js': `npm:@supabase/realtime-js@${versions.realtime}`,
  '@supabase/functions-js': `npm:@supabase/functions-js@${versions.functions}`,
  '@supabase/postgrest-js': `npm:@supabase/postgrest-js@${versions.postgrest}`,
  '@supabase/auth-js': `npm:@supabase/auth-js@${versions.auth}`,
  '@supabase/storage-js': `npm:@supabase/storage-js@${versions.storage}`,
  '@supabase/node-fetch': `npm:@supabase/node-fetch@${versions.node_fetch}`,
}

// Write updated deno.json
fs.writeFileSync(denoJsonPath, JSON.stringify(denoJson, null, 2) + '\n')

console.log('Updated deno.json with versions from package-lock.json')
