#!/usr/bin/env node

/**
 * Updates version.ts files for all packages in the monorepo
 * Run this after versioning but before publishing
 */

import * as fs from 'fs'
import * as path from 'path'

interface PackageConfig {
  name: string
  versionPath: string
}

interface PackageJson {
  name: string
  version: string
  [key: string]: any
}

const packageConfigs: PackageConfig[] = [
  { name: 'auth-js', versionPath: 'src/lib/version.ts' },
  { name: 'functions-js', versionPath: 'src/version.ts' },
  { name: 'postgrest-js', versionPath: 'src/version.ts' },
  { name: 'realtime-js', versionPath: 'src/lib/version.ts' },
  { name: 'storage-js', versionPath: 'src/lib/version.ts' },
  { name: 'supabase-js', versionPath: 'src/lib/version.ts' },
]

const packagesDir = path.join(__dirname, '../packages/core')

console.log('📦 Updating version.ts files for packages...\n')

packageConfigs.forEach(({ name: packageName, versionPath }: PackageConfig) => {
  const packagePath = path.join(packagesDir, packageName)
  const packageJsonPath = path.join(packagePath, 'package.json')
  const versionTsPath = path.join(packagePath, versionPath)

  try {
    // Read the current version from package.json
    const packageJsonContent = fs.readFileSync(packageJsonPath, 'utf8')
    const packageJson: PackageJson = JSON.parse(packageJsonContent)
    const version = packageJson.version

    // Generate the version.ts content
    const content = `// Generated automatically during releases by scripts/update-version-files.ts
// This file provides runtime access to the package version for:
// - HTTP request headers (e.g., X-Client-Info header for API requests)
// - Debugging and support (identifying which version is running)
// - Telemetry and logging (version reporting in errors/analytics)
// - Ensuring build artifacts match the published package version
export const version = '${version}'
`

    // Write the version.ts file
    fs.writeFileSync(versionTsPath, content)
    console.log(`  ✓ ${packageName}: ${version}`)
  } catch (error) {
    console.error(`  ✗ ${packageName}: ${(error as Error).message}`)
  }
})

console.log('\n✅ Version files updated successfully')
