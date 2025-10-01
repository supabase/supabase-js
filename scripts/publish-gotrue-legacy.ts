#!/usr/bin/env node

/**
 * Publishes @supabase/gotrue-js as a legacy mirror of @supabase/auth-js
 * This maintains backward compatibility for projects using the old package name
 */

import * as fs from 'fs'
import * as path from 'path'
import { execSync } from 'child_process'

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[36m',
  red: '\x1b[31m',
} as const

function log(message: string, color: string = colors.reset): void {
  console.log(`${color}${message}${colors.reset}`)
}

function getArg(name: string): string | undefined {
  const idx = process.argv.findIndex((a) => a === `--${name}` || a.startsWith(`--${name}=`))
  if (idx === -1) return undefined
  const token = process.argv[idx]
  if (token.includes('=')) return token.split('=')[1]
  return process.argv[idx + 1]
}

interface PackageJson {
  name: string
  version: string
  description?: string
  repository?: {
    type?: string
    url?: string
    directory?: string
  }
  deprecated?: string
  [key: string]: any
}

async function publishGotrueLegacy(): Promise<void> {
  try {
    // Get the tag from arguments (e.g., --tag=canary, --tag=latest)
    const tag = getArg('tag') || 'latest'
    const dryRun = process.argv.includes('--dry-run')

    log(`\n📦 Publishing @supabase/gotrue-js (legacy mirror of auth-js)`, colors.blue)
    log(`   Tag: ${tag}`, colors.blue)
    if (dryRun) log(`   DRY RUN MODE - No actual publish will occur`, colors.yellow)

    // Paths
    const rootDir = path.join(__dirname, '..')
    const authJsDir = path.join(rootDir, 'packages/core/auth-js')
    const authJsPackageJson = path.join(authJsDir, 'package.json')
    const authJsPackageLockJson = path.join(authJsDir, 'package-lock.json')
    const authJsDistDir = path.join(authJsDir, 'dist')

    // Read auth-js package.json to get version
    const originalPackageContent = fs.readFileSync(authJsPackageJson, 'utf8')
    const authPackage: PackageJson = JSON.parse(originalPackageContent)
    const version = authPackage.version

    log(`\n📋 Auth-js version: ${version}`, colors.green)

    // Check if dist exists
    if (!fs.existsSync(authJsDistDir)) {
      log(`❌ Error: auth-js dist directory not found. Run build first!`, colors.red)
      process.exit(1)
    }

    // Save original package-lock.json if it exists
    let originalPackageLockContent: string | null = null
    if (fs.existsSync(authJsPackageLockJson)) {
      originalPackageLockContent = fs.readFileSync(authJsPackageLockJson, 'utf8')
    }

    log(`\n✏️  Modifying package.json to gotrue-js...`)

    // Modify package.json and package-lock.json in place
    // Using sed-like approach from the original CI
    const packageJsonContent = fs.readFileSync(authJsPackageJson, 'utf8')
    const modifiedPackageJson = packageJsonContent.replace(
      /"name":\s*"@supabase\/auth-js"/g,
      '"name": "@supabase/gotrue-js"'
    )
    fs.writeFileSync(authJsPackageJson, modifiedPackageJson)

    if (fs.existsSync(authJsPackageLockJson)) {
      const packageLockContent = fs.readFileSync(authJsPackageLockJson, 'utf8')
      const modifiedPackageLock = packageLockContent.replace(
        /"name":\s*"@supabase\/auth-js"/g,
        '"name": "@supabase/gotrue-js"'
      )
      fs.writeFileSync(authJsPackageLockJson, modifiedPackageLock)
    }

    // Validate tag to prevent command injection
    const validTags = ['latest', 'canary', 'beta', 'alpha', 'next', 'rc']
    if (!validTags.includes(tag)) {
      log(`❌ Error: Invalid tag '${tag}'. Must be one of: ${validTags.join(', ')}`, colors.red)
      process.exit(1)
    }

    // Publish to npm from the auth-js directory
    const publishCommand = `npm publish --provenance --tag ${tag}`

    log(`\n🚀 Publishing to npm...`)
    log(`   Command: ${publishCommand}`)

    if (!dryRun) {
      try {
        // Change to auth-js directory and publish
        process.chdir(authJsDir)
        execSync(publishCommand, { stdio: 'inherit' })

        log(
          `\n✅ Successfully published @supabase/gotrue-js@${version} with tag '${tag}'`,
          colors.green
        )
      } catch (error) {
        log(`\n❌ Failed to publish gotrue-js: ${(error as Error).message}`, colors.red)
        throw error
      } finally {
        // Always restore the original files
        log(`\n🔄 Restoring original package files...`)

        // Restore original package.json
        fs.writeFileSync(authJsPackageJson, originalPackageContent)

        // Restore original package-lock.json if it existed
        if (originalPackageLockContent) {
          fs.writeFileSync(authJsPackageLockJson, originalPackageLockContent)
        }

        // Change back to root
        process.chdir(rootDir)
      }
    } else {
      // In dry-run, restore files immediately
      log(`\n🔄 Restoring original package files (dry-run)...`)
      fs.writeFileSync(authJsPackageJson, originalPackageContent)
      if (originalPackageLockContent) {
        fs.writeFileSync(authJsPackageLockJson, originalPackageLockContent)
      }

      log(
        `\n✅ Dry run complete - would have published @supabase/gotrue-js@${version} with tag '${tag}'`,
        colors.yellow
      )
    }

    log(`\n✨ Done!`, colors.green)
  } catch (error) {
    log(`\n❌ Error: ${(error as Error).message}`, colors.red)
    process.exit(1)
  }
}

// Run the script
publishGotrueLegacy()
