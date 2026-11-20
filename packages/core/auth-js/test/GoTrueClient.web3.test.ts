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
          issuedAt: '2026-10-24T16:35:08.407Z',
          resources: ['https://example.com/tos', 'https://example.com/privacy'],
        },
      },
    })

    const { message } = JSON.parse(mockFetch.mock.calls[0][1].body)

    expect(message).toBe(
      [
        'example.com wants you to sign in with your Solana account:',
        '11111111111111111111111111111111',
        '',
        'Version: 1',
        'URI: https://example.com/login',
        'Issued At: 2026-10-24T16:35:08.407Z',
        'Resources:',
        '- https://example.com/tos',
        '- https://example.com/privacy',
      ].join('\n')
    )
  })
})
