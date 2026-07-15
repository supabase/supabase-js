import { describe, test, assert, expect } from 'vitest'
import { Presence } from '@supabase/phoenix'
import type { RealtimePresenceState } from '../../src/RealtimePresence'
import PresenceAdapter from '../../src/phoenix/presenceAdapter'
import { PresenceStates } from '../../src/phoenix/types'

describe('transformState', () => {
  test.each([
    { name: 'empty', curState: {}, expectedState: {} },
    {
      name: 'single presence',
      curState: {
        abc123: {
          metas: [{ phx_ref: '2', phx_ref_prev: '1', user_id: 1 }],
        },
      },
      expectedState: {
        abc123: [{ presence_ref: '2', user_id: 1 }],
      },
    },
    {
      name: 'single presence without phx_ref_prev',
      curState: {
        abc123: {
          metas: [{ phx_ref: '2', user_id: 1 }],
        },
      },
      expectedState: {
        abc123: [{ presence_ref: '2', user_id: 1 }],
      },
    },
    {
      name: 'multiple presences',
      curState: {
        abc123: {
          metas: [
            { phx_ref: '2', phx_ref_prev: '1', user_id: 1 },
            { phx_ref: '3', user_id: 2 },
          ],
        },
      },
      expectedState: {
        abc123: [
          { presence_ref: '2', user_id: 1 },
          { presence_ref: '3', user_id: 2 },
        ],
      },
    },
    {
      name: 'multiple keys',
      curState: {
        abc123: {
          metas: [{ phx_ref: '2', phx_ref_prev: '1', user_id: 1 }],
        },
        def456: {
          metas: [{ phx_ref: '4', user_id: 3 }],
        },
      },
      expectedState: {
        abc123: [{ presence_ref: '2', user_id: 1 }],
        def456: [{ presence_ref: '4', user_id: 3 }],
      },
    },
    {
      name: 'empty metas',
      curState: {
        abc123: {
          metas: [],
        },
      },
      expectedState: {
        abc123: [],
      },
    },
    {
      name: 'with extra data',
      curState: {
        abc123: {
          metas: [
            {
              phx_ref: '2',
              phx_ref_prev: '1',
              user_id: 1,
              details: { mood: 'happy' },
            },
          ],
        },
      },
      expectedState: {
        abc123: [{ presence_ref: '2', user_id: 1, details: { mood: 'happy' } }],
      },
    },
  ] as { name: string; curState: PresenceStates; expectedState: RealtimePresenceState }[])(
    'transforms $name state',
    ({ curState, expectedState }) => {
      assert.deepEqual(PresenceAdapter.transformState(curState), expectedState)
    }
  )

  test('does not mutate original state', () => {
    const originalState = {
      abc123: {
        metas: [{ phx_ref: '2', phx_ref_prev: '1', user_id: 1 }],
      },
    }
    const originalStateDeepCopy = JSON.parse(JSON.stringify(originalState))

    PresenceAdapter.transformState(originalState)

    assert.deepEqual(originalState, originalStateDeepCopy)
  })
})

// Reproduces GHSA-63mc-hw7g-86rr: @supabase/phoenix's Presence.syncState/syncDiff look up
// presence keys with a bare `state[key]` check, so a key matching an Object.prototype
// member (e.g. "constructor") resolves to the inherited prototype value instead of
// `undefined`. The code then calls `.metas` on it and crashes. Any authenticated presence
// channel participant can join under such a key to break presence sync for every viewer.
describe('Presence prototype pollution (GHSA-63mc-hw7g-86rr)', () => {
  test('syncState should not crash when a presence key collides with Object.prototype', () => {
    const maliciousState = {
      constructor: { metas: [{ phx_ref: '1', user_id: 'attacker' }] },
    }

    expect(() => Presence.syncState({}, maliciousState)).not.toThrow()
  })

  test('syncDiff should not crash when a joining presence key collides with Object.prototype', () => {
    const maliciousDiff = {
      joins: { constructor: { metas: [{ phx_ref: '1', user_id: 'attacker' }] } },
      leaves: {},
    }

    expect(() => Presence.syncDiff({}, maliciousDiff)).not.toThrow()
  })

  test('syncDiff should not crash when a leaving presence key collides with Object.prototype', () => {
    const maliciousDiff = {
      joins: {},
      leaves: { constructor: { metas: [{ phx_ref: '1', user_id: 'attacker' }] } },
    }

    expect(() => Presence.syncDiff({}, maliciousDiff)).not.toThrow()
  })
})
