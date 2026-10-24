import GoTrueClient from '../src/GoTrueClient'
import { SolanaWallet } from '../src/lib/types'

describe('GoTrueClient signInWithWeb3 (solana)', () => {
  test('lists resources under a "Resources:" line when the wallet only supports signMessage', async () => {
    const mockFetch = jest.fn().mockRejectedValue(new Error('offline'))
    const client = new GoTrueClient({
      url: 'http://localhost:9999',
      autoRefreshToken: false,
      persistSession: false,
      fetch: mockFetch,
    })
    const wallet: SolanaWallet = {
      publicKey: { toBase58: () => '11111111111111111111111111111111' },
      signMessage: async () => new Uint8Array(64),
    }

    await client.signInWithWeb3({
      chain: 'solana',
      wallet,
      options: {
        url: 'https://example.com/login',
        signInWithSolana: {
          resources: ['https://example.com/tos', 'https://example.com/privacy'],
        },
      },
    })

    const { message } = JSON.parse(mockFetch.mock.calls[0][1].body)
    const lines = message.split('\n')
    const resourcesIndex = lines.indexOf('Resources:')

    expect(resourcesIndex).toBeGreaterThan(-1)
    expect(lines.slice(resourcesIndex + 1)).toEqual([
      '- https://example.com/tos',
      '- https://example.com/privacy',
    ])
  })
})
