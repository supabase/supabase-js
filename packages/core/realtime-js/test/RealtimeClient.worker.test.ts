import { beforeAll, afterAll, beforeEach, afterEach, test, expect, vi, describe } from 'vitest'
import { type TestSetup, setupRealtimeTest } from './helpers/setup'
import Worker from 'web-worker'
import path from 'path'
import { pathToFileURL } from 'url'
import RealtimeClient from '../src/RealtimeClient'

let testSetup: TestSetup

beforeAll(() => {
  window.Worker = Worker
})

const workerUrl = pathToFileURL(path.join(__dirname, '/helpers/test_worker.js')).href

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

describe('when no workerUrl provided', () => {
  const mockObjectURL = workerUrl.startsWith('file://') ? workerUrl : `file://${workerUrl}`
  let originalCreateObjectURL: any

  beforeAll(() => {
    originalCreateObjectURL = global.URL.createObjectURL
    global.URL.createObjectURL = vi.fn(() => mockObjectURL)
  })

  afterAll(() => {
    global.URL.createObjectURL = originalCreateObjectURL
  })

  test('creates worker with blob URL when no workerUrl provided', async () => {
    // Mock URL.createObjectURL to return a valid file URL for Node.js web-worker polyfill

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
  })
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
  await testSetup.disconnect()
  await testSetup.socketClosed()
  expect(spy).toHaveBeenCalled()
  expect(testSetup.client.workerRef).toBeFalsy()
})

test('worker reconnect: in-flight heartbeat on socket A does not cause heartbeat timeout teardown on socket B after reconnect', async () => {
  const heartbeatEvents: string[] = []
  testSetup.cleanup()
  testSetup = setupRealtimeTest({
    worker: true,
    workerUrl,
    heartbeatCallback: (status: string) => {
      heartbeatEvents.push(status)
    },
  })

  testSetup.connect()
  await testSetup.socketConnected()

  // 1. Send first heartbeat on socket A
  testSetup.client.sendHeartbeat()
  expect(heartbeatEvents).toContain('sent')

  // 2. Disconnect socket A while heartbeat was in flight (without reply or timeout)
  await testSetup.disconnect()
  await testSetup.socketClosed()

  // 3. Reconnect on socket B
  testSetup.connect()
  await testSetup.socketConnected()

  // 4. Send heartbeat on socket B - should send cleanly without teardown
  expect(testSetup.client.pendingHeartbeatRef).toBeNull()
  testSetup.client.sendHeartbeat()

  // Verify connection remains open and exactly two sent events occurred
  expect(testSetup.client.isConnected()).toBe(true)
  expect(heartbeatEvents.filter((s) => s === 'sent').length).toBe(2)
})

