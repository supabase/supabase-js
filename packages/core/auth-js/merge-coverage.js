#!/usr/bin/env node

/**
 * Merges coverage reports from CLI tests and Docker tests into a single report.
 *
 * This script combines the lcov.info files from both test suites:
 * - coverage/lcov.info (CLI tests: core functionality)
 * - coverage-docker/lcov.info (Docker tests: edge cases)
 *
 * Output: coverage-merged/lcov.info
 */

const fs = require('fs')
const path = require('path')

const coverageDir = path.join(__dirname, 'coverage')
const coverageDockerDir = path.join(__dirname, 'coverage-docker')
const coverageMergedDir = path.join(__dirname, 'coverage-merged')

const lcovFile = path.join(coverageDir, 'lcov.info')
const lcovDockerFile = path.join(coverageDockerDir, 'lcov.info')
const lcovMergedFile = path.join(coverageMergedDir, 'lcov.info')

try {
  // Check if both coverage files exist
  if (!fs.existsSync(lcovFile)) {
    console.error(`Error: ${lcovFile} not found. Run 'nx test:auth auth-js' first.`)
    process.exit(1)
  }

  if (!fs.existsSync(lcovDockerFile)) {
    console.error(`Error: ${lcovDockerFile} not found. Run 'nx test:docker auth-js' first.`)
    process.exit(1)
  }

  // Create merged directory
  if (!fs.existsSync(coverageMergedDir)) {
    fs.mkdirSync(coverageMergedDir, { recursive: true })
  }

  // Read both lcov files
  console.log('Reading coverage files...')
  const lcovContent = fs.readFileSync(lcovFile, 'utf8')
  const lcovDockerContent = fs.readFileSync(lcovDockerFile, 'utf8')

  // Merge by concatenation (Coveralls handles deduplication)
  console.log('Merging coverage reports...')
  const mergedContent = lcovContent + '\n' + lcovDockerContent

  // Write merged file
  fs.writeFileSync(lcovMergedFile, mergedContent)

  console.log(`✓ Coverage reports merged successfully!`)
  console.log(`  Output: ${lcovMergedFile}`)
  console.log(`  CLI coverage: ${lcovFile}`)
  console.log(`  Docker coverage: ${lcovDockerFile}`)
} catch (error) {
  console.error('Error merging coverage reports:', error.message)
  process.exit(1)
}
