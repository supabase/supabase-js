import { beforeAll, beforeEach, afterEach, test, expect, vi } from 'vitest'
import { type TestSetup, setupRealtimeTest } from './helpers/setup'
import Worker from 'web-worker'
import path from 'path'
import RealtimeClient from '../src/RealtimeClient'

let testSetup: TestSetup

beforeAll(() => {
  window.Worker = Worker
})

const workerUrl = path.join(__dirname, '/helpers/test_worker.js')

beforeEach(() => {
  testSetup = setupRealtimeTest({
    worker: true,
    workerUrl,
  })
})

afterEach(() => {
  testSetup.cleanup()
})

test('sets worker flag', () => {
  expect(testSetup.client.worker).toBeTruthy()
})

test('disables autoStartHeartbeat in socket', () => {
  expect(testSetup.client.socketAdapter.getSocket().autoSendHeartbeat).toBeFalsy()
})

test('sets worker URL', () => {
  expect(testSetup.client.workerUrl).toBe(workerUrl)
})

test('creates worker with blob URL when no workerUrl provided', async () => {
  // Mock URL.createObjectURL to return a valid file URL for Node.js web-worker polyfill
  const mockObjectURL = `file://${workerUrl}`
  const originalCreateObjectURL = global.URL.createObjectURL
  global.URL.createObjectURL = vi.fn(() => mockObjectURL)

  testSetup.cleanup()
  testSetup = setupRealtimeTest({
    worker: true,
  })

  testSetup.connect()
  await testSetup.socketConnected()

  // Verify worker was created (workerRef should exist)
  expect(testSetup.client.workerRef).toBeTruthy()
  expect(testSetup.client.workerRef instanceof Worker).toBeTruthy()

  // Verify createObjectURL was called (this exercises the blob creation path)
  expect(global.URL.createObjectURL).toHaveBeenCalled()
  global.URL.createObjectURL = originalCreateObjectURL
})

test('starts worker on conenction open', async () => {
  expect(testSetup.client.workerRef).toBeFalsy()
  testSetup.connect()
  await testSetup.socketConnected()
  expect(testSetup.client.workerRef).toBeTruthy()
})

test('ensures single worker ref is started even with multiple connect calls', async () => {
  testSetup.connect()
  await testSetup.socketConnected()
  const ref = testSetup.client.workerRef

  // @ts-ignore - simulate another onOpen call
  testSetup.client.socketAdapter.getSocket().triggerStateCallbacks('open')

  expect(testSetup.client.workerRef).toBe(ref)
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

test('terminates worker on disconnect', async () => {
  testSetup.connect()
  await testSetup.socketConnected()
  expect(testSetup.client.workerRef).toBeTruthy()
  const ref = testSetup.client.workerRef!

  const spy = vi.spyOn(ref, 'terminate')
  testSetup.disconnect()
  await testSetup.socketClosed()
  expect(spy).toHaveBeenCalled()
  expect(testSetup.client.workerRef).toBeFalsy()
})
