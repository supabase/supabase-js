const fs = require('fs')
const path = require('path')

const src = path.join(__dirname, '..', 'wrapper.mjs')
const destDir = path.join(__dirname, '..', 'dist', 'esm')
const dest = path.join(destDir, 'wrapper.mjs')

fs.mkdirSync(destDir, { recursive: true })
fs.copyFileSync(src, dest)
