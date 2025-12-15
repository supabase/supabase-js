/**
 * Post-build script to add .js extensions to relative imports in ESM output.
 *
 * Node.js ESM requires explicit file extensions for relative imports.
 * TypeScript doesn't add these by default, so we add them after compilation.
 *
 * This fixes:
 * - Node.js direct ESM imports (import { createClient } from '@supabase/supabase-js')
 * - jsDelivr CDN ESM imports (when bundled with the module build)
 */
const fs = require('fs')
const path = require('path')

function addJsExtensions(dir) {
  const files = fs.readdirSync(dir, { withFileTypes: true })
  for (const file of files) {
    const fullPath = path.join(dir, file.name)
    if (file.isDirectory()) {
      addJsExtensions(fullPath)
    } else if (file.name.endsWith('.js')) {
      let content = fs.readFileSync(fullPath, 'utf8')
      // Add .js to relative imports that don't already have an extension
      // Matches: from './foo' or from '../foo/bar' but not from './foo.js'
      content = content.replace(/(from\s+['"])(\.\.?\/[^'"]+)(?<!\.js)(['"])/g, '$1$2.js$3')
      fs.writeFileSync(fullPath, content)
    }
  }
}

const targetDir = path.resolve(__dirname, '../dist/module')
if (fs.existsSync(targetDir)) {
  addJsExtensions(targetDir)
  console.log('✓ Added .js extensions to ESM imports in dist/module/')
} else {
  console.error('Error: dist/module directory not found')
  process.exit(1)
}
