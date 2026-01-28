#!/usr/bin/env node

/**
 * Sync common type definitions from postgrest-js to supabase-js
 *
 * This script copies shared type definitions from @supabase/postgrest-js
 * to @supabase/supabase-js to ensure type compatibility across complex
 * generic types and conditional types.
 *
 * Source of truth: packages/core/postgrest-js/src/types/common/
 * Destination: packages/core/supabase-js/src/lib/rest/types/common/
 */

const fs = require('fs')
const path = require('path')

const SOURCE_DIR = path.join(__dirname, '../packages/core/postgrest-js/src/types/common')
const DEST_DIR = path.join(__dirname, '../packages/core/supabase-js/src/lib/rest/types/common')

const HEADER_COMMENT = `/**
 * AUTO-GENERATED FILE - DO NOT EDIT
 *
 * This file is automatically synchronized from @supabase/postgrest-js
 * Source: packages/core/postgrest-js/src/types/common/
 *
 * To update this file, modify the source in postgrest-js and run:
 *   npm run codegen
 */

`

function syncFile(fileName) {
  const sourcePath = path.join(SOURCE_DIR, fileName)
  const destPath = path.join(DEST_DIR, fileName)

  if (!fs.existsSync(sourcePath)) {
    console.error(`❌ Source file not found: ${sourcePath}`)
    process.exit(1)
  }

  const sourceContent = fs.readFileSync(sourcePath, 'utf8')
  const expectedContent = HEADER_COMMENT + sourceContent

  // Check if destination exists and compare with what we would generate
  let needsUpdate = true
  if (fs.existsSync(destPath)) {
    const destContent = fs.readFileSync(destPath, 'utf8')

    // Compare the full expected output with the current file
    if (destContent === expectedContent) {
      needsUpdate = false
    }
  }

  if (needsUpdate) {
    fs.writeFileSync(destPath, expectedContent, 'utf8')
    console.log(`✅ Synced: ${fileName}`)
    return true
  } else {
    console.log(`⏭️  Unchanged: ${fileName}`)
    return false
  }
}

function main() {
  console.log('🔄 Syncing common types from postgrest-js to supabase-js...\n')

  // Ensure destination directory exists
  if (!fs.existsSync(DEST_DIR)) {
    fs.mkdirSync(DEST_DIR, { recursive: true })
    console.log(`📁 Created directory: ${DEST_DIR}\n`)
  }

  // Get all .ts files from source directory
  const sourceFiles = fs.readdirSync(SOURCE_DIR).filter((file) => file.endsWith('.ts'))

  if (sourceFiles.length === 0) {
    console.error(`❌ No TypeScript files found in ${SOURCE_DIR}`)
    process.exit(1)
  }

  let changedCount = 0
  for (const file of sourceFiles) {
    const changed = syncFile(file)
    if (changed) changedCount++
  }

  console.log(
    `\n✨ Sync complete: ${changedCount} file(s) updated, ${sourceFiles.length - changedCount} unchanged`
  )

  if (changedCount > 0) {
    console.log('\n⚠️  Generated files were updated. Please commit these changes.')
  }
}

main()
