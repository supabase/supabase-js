#!/usr/bin/env node

const fs = require('fs')
const path = require('path')

/**
 * Updates the Json type definition in the generated types file
 * This is a cross-platform replacement for the sed command
 */
function updateJsonType() {
  const filePath = path.join(__dirname, '..', 'test', 'types.generated.ts')

  try {
    // Read the file
    let content = fs.readFileSync(filePath, 'utf8')

    // Replace the Json type definition
    const updatedContent = content.replace(
      /export type Json =[\s\S]*?(?=\n\nexport type Database)/,
      'export type Json = unknown;'
    )

    // Write the updated content back to the file
    fs.writeFileSync(filePath, updatedContent, 'utf8')

    console.log('✅ Successfully updated Json type in test/types.generated.ts')
  } catch (error) {
    console.error('❌ Error updating Json type:', error.message)
    process.exit(1)
  }
}

// Run the function if this script is executed directly
if (require.main === module) {
  updateJsonType()
}

module.exports = { updateJsonType }
