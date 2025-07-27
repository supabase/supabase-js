import * as fs from 'fs'
import * as path from 'path'

// Simulates isows removal (like in server environments)
function simulateIsowsRemoval(): { backupPath: string; originalPath: string } {
  const originalPath = path.join(__dirname, '..', 'node_modules', 'isows')
  const backupPath = path.join(__dirname, '..', 'node_modules', 'isows_backup')

  try {
    if (fs.existsSync(originalPath)) {
      fs.renameSync(originalPath, backupPath)
      console.log('📦 isows temporarily removed (server environment simulation)')
    }
  } catch (error) {
    console.log('⚠️  Failed to remove isows:', (error as Error).message)
  }

  return { backupPath, originalPath }
}

// Restores isows
function restoreIsows(backupPath: string, originalPath: string): void {
  try {
    if (fs.existsSync(backupPath)) {
      fs.renameSync(backupPath, originalPath)
      console.log('📦 isows restored')
    }
  } catch (error) {
    console.log('⚠️  Failed to restore isows:', (error as Error).message)
  }
}

function testIsowsAvailability(): boolean {
  try {
    require('isows')
    return true
  } catch {
    console.log('isows is not available')
    return false
  }
}

function testRealtimeClientCreation(): boolean {
  try {
    const { RealtimeClient } = require('@supabase/realtime-js')
    new RealtimeClient('ws://localhost:54321/realtime/v1')
    return true
  } catch {
    console.log('realtime client is not available')
    return false
  }
}

/**
 * Jest test for isows compatibility
 */

describe('isows compatibility', () => {
  let backupPath: string
  let originalPath: string

  beforeEach(() => {
    ;({ backupPath, originalPath } = simulateIsowsRemoval())
    console.log('backupPath', backupPath)
    console.log('originalPath', originalPath)
  })

  afterEach(() => {
    restoreIsows(backupPath, originalPath)
  })

  it('should work without isows dependency', () => {
    const isowsAvailable = testIsowsAvailability()
    const isRealtimeClientWorks = testRealtimeClientCreation()

    expect(isowsAvailable).toBe(false)
    expect(isRealtimeClientWorks).toBe(true) // should be true because realtime-js doesn't use isows
  })
})
