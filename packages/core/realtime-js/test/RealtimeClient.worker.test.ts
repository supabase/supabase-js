import assert from 'assert'
import path from 'path'
import { afterAll, afterEach, beforeAll, beforeEach, expect, test, vi } from 'vitest'
import { Server } from 'mock-socket'
import RealtimeClient from '../src/RealtimeClient'
import { setupRealtimeTest, cleanupRealtimeTest, TestSetup } from './helpers/setup'
import Worker from 'web-worker'

let testSetup: TestSetup
let mockServer: Server
let client: RealtimeClient

beforeAll(() => {
  window.Worker = Worker
  const projectRef = testSetup?.projectRef || 'test-project'
  const url = `wss://${projectRef}/socket`
  mockServer = new Server(url)
})

afterAll(() => {
  vi.stubGlobal('Worker', Worker)
  mockServer.close()
})

beforeEach(() => {
  testSetup = setupRealtimeTest()
  const workerPath = path.join(__dirname, '/helpers/test_worker.js')
  client = new RealtimeClient('ws://localhost:8080/socket', {
    worker: true,
    workerUrl: workerPath,
    heartbeatIntervalMs: 10,
    params: { apikey: '123456789' },
  })
})

afterEach(() => {
  cleanupRealtimeTest(testSetup)
})

test('sets worker flag', () => {
  assert.ok(client.worker)
})

test('sets worker URL', () => {
  const workerPath = path.join(__dirname, '/helpers/test_worker.js')
  assert.equal(client.workerUrl, workerPath)
})

test('ensures single worker ref is started even with multiple connect calls', () => {
  client._onConnOpen()
  let ref = client.workerRef

  client._onConnOpen()
  assert.ok(ref === client.workerRef)
})

test('throws error when Web Worker is not supported', () => {
  // Temporarily remove Worker from window
  const originalWorker = window.Worker
  // @ts-ignore - Deliberately setting to undefined to test error case
  window.Worker = undefined

  expect(() => {
    new RealtimeClient('ws://localhost:8080/socket', {
      worker: true,
      params: { apikey: '123456789' },
    })
  }).toThrow('Web Worker is not supported')

  // Restore Worker
  window.Worker = originalWorker
})

test('creates worker with blob URL when no workerUrl provided', () => {
  // Mock URL.createObjectURL to return a valid file URL for Node.js web-worker polyfill
  const workerPath = path.join(__dirname, '/helpers/test_worker.js')
  const mockObjectURL = `file://${workerPath}`
  const originalCreateObjectURL = global.URL.createObjectURL
  global.URL.createObjectURL = vi.fn(() => mockObjectURL)

  try {
    const client = new RealtimeClient('ws://localhost:8080/socket', {
      worker: true,
      params: { apikey: '123456789' },
    })

    // Trigger worker creation by calling _onConnOpen
    client._onConnOpen()

    // Verify worker was created (workerRef should exist)
    assert.ok(client.workerRef)
    assert.ok(client.workerRef instanceof Worker)

    // Verify createObjectURL was called (this exercises the blob creation path)
    expect(global.URL.createObjectURL).toHaveBeenCalled()
  } finally {
    // Restore original function
    global.URL.createObjectURL = originalCreateObjectURL
  }
})
