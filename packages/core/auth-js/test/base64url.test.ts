import {
  codepointToUTF8,
  stringFromBase64URL,
  stringFromUTF8,
  stringToBase64URL,
} from '../src/lib/base64url'

const EXAMPLES = [
  'a',
  'ab',
  'abc',
  'abcd',
  'hello world',
  'нешто на кирилица',
  'something with emojis 🤙🏾 ',
  'Supabaseは、オープンソースの Firebase 代替製品です。エンタープライズグレードのオープンソースツールを使って、Firebase の機能を構築しています。',
]

describe('stringToBase64URL', () => {
  EXAMPLES.forEach((example) => {
    test(`encode "${example}"`, () => {
      expect(stringToBase64URL(example)).toEqual(Buffer.from(example).toString('base64url'))
    })
  })
})

describe('stringFromBase64URL', () => {
  EXAMPLES.forEach((example) => {
    test(`decode "${example}"`, () => {
      expect(stringFromBase64URL('\r\t\n ' + Buffer.from(example).toString('base64url'))).toEqual(
        example
      )
    })
  })

  test('decode with invalid Base64-URL character', () => {
    expect(() => {
      stringFromBase64URL('*')
    }).toThrow(new Error(`Invalid Base64-URL character "*"`))
  })
})

const BAD_UTF8 = [
  [0xf8], // 11111000
  [0xff], // 11111111
  [0x80], // 10000000
  [0xf8, 1], // 11110000 00000001
  [0xe0, 1], // 11100000 00000001
  [0xc0, 1], // 11100000 00000001
]

describe('stringFromUTF8', () => {
  BAD_UTF8.forEach((example) => {
    test(`should recognize bad UTF-8 sequence ${example
      .map((x) => x.toString(16))
      .join(' ')}`, () => {
      expect(() => {
        const state = { utf8seq: 0, codepoint: 0 }
        example.forEach((byte) => {
          // eslint-disable-next-line @typescript-eslint/no-empty-function
          stringFromUTF8(byte, state, () => {})
        })
      }).toThrow(new Error('Invalid UTF-8 sequence'))
    })
  })
})

describe('codepointToUTF8', () => {
  test('invalid codepoints above 0x10ffff', () => {
    const invalidCodepoint = 0x10ffff + 1
    expect(() => {
      codepointToUTF8(invalidCodepoint, () => {
        throw new Error('Should not becalled')
      })
    }).toThrow(new Error(`Unrecognized Unicode codepoint: ${invalidCodepoint.toString(16)}`))
  })
})
