import { describe, test, assert } from 'vitest'
import { State } from 'phoenix'
import type { RealtimePresenceState } from '../../src/RealtimePresence'
import PresenceAdapter from '../../src/phoenix/presenceAdapter'

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
  ] as { name: string, curState: State, expectedState: RealtimePresenceState }[])('transforms $name state', ({ curState, expectedState }) => {
    assert.deepEqual(PresenceAdapter.transformState(curState), expectedState)
  })

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
