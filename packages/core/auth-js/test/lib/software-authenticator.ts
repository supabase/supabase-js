/**
 * Minimal software WebAuthn authenticator for e2e tests.
 */

import { createHash, createSign, generateKeyPairSync, randomBytes, KeyObject } from 'crypto'
import { base64UrlToUint8Array, bytesToBase64URL } from '../../src/lib/base64url'
import type { AuthenticationResponseJSON, RegistrationResponseJSON } from '../../src/lib/webauthn'
import type {
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
} from '../../src/lib/webauthn.dom'

type CborValue =
  | number
  | string
  | Uint8Array
  | Map<number, CborValue>
  | { [key: string]: CborValue }

const cborHead = (major: number, length: number): Buffer => {
  if (length < 24) {
    return Buffer.from([(major << 5) | length])
  }
  if (length < 0x100) {
    return Buffer.from([(major << 5) | 24, length])
  }
  if (length < 0x10000) {
    const head = Buffer.alloc(3)
    head[0] = (major << 5) | 25
    head.writeUInt16BE(length, 1)
    return head
  }
  const head = Buffer.alloc(5)
  head[0] = (major << 5) | 26
  head.writeUInt32BE(length, 1)
  return head
}

/**
 * Encodes integers, byte/text strings and maps — the only CBOR types needed
 * for attestation objects and COSE keys. Map entries are emitted in insertion
 * order, so callers pass keys pre-sorted per CTAP2 canonical form.
 */
const cborEncode = (value: CborValue): Buffer => {
  if (typeof value === 'number') {
    if (!Number.isInteger(value)) {
      throw new Error('Only integers are supported')
    }
    return value >= 0 ? cborHead(0, value) : cborHead(1, -value - 1)
  }
  if (typeof value === 'string') {
    const bytes = Buffer.from(value, 'utf8')
    return Buffer.concat([cborHead(3, bytes.length), bytes])
  }
  if (value instanceof Uint8Array) {
    return Buffer.concat([cborHead(2, value.length), Buffer.from(value)])
  }
  const entries: Array<[number | string, CborValue]> =
    value instanceof Map ? [...value.entries()] : Object.entries(value)
  return Buffer.concat([
    cborHead(5, entries.length),
    ...entries.flatMap(([key, entry]) => [cborEncode(key as CborValue), cborEncode(entry)]),
  ])
}

const FLAG_USER_PRESENT = 0x01
const FLAG_USER_VERIFIED = 0x04
const FLAG_ATTESTED_CREDENTIAL_DATA = 0x40

export class SoftwareAuthenticator {
  readonly rpId: string
  readonly origin: string

  private readonly credentialId = randomBytes(32)
  private readonly privateKey: KeyObject
  private readonly cosePublicKey: Buffer
  private userHandle: Uint8Array | null = null
  private signCount = 0

  constructor({ rpId, origin }: { rpId: string; origin: string }) {
    this.rpId = rpId
    this.origin = origin

    const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' })
    this.privateKey = privateKey
    const jwk = publicKey.export({ format: 'jwk' })
    this.cosePublicKey = cborEncode(
      new Map<number, CborValue>([
        [1, 2], // kty: EC2
        [3, -7], // alg: ES256
        [-1, 1], // crv: P-256
        [-2, Buffer.from(jwk.x!, 'base64url')],
        [-3, Buffer.from(jwk.y!, 'base64url')],
      ])
    )
  }

  get credentialIdBase64Url(): string {
    return bytesToBase64URL(this.credentialId)
  }

  private clientDataJSON(type: 'webauthn.create' | 'webauthn.get', challenge: string): Buffer {
    return Buffer.from(
      JSON.stringify({ type, challenge, origin: this.origin, crossOrigin: false }),
      'utf8'
    )
  }

  private rpIdHash(): Buffer {
    return createHash('sha256').update(this.rpId, 'utf8').digest()
  }

  /** Simulates navigator.credentials.create() for the given server options. */
  create(options: PublicKeyCredentialCreationOptionsJSON): RegistrationResponseJSON {
    // The user handle is echoed back in assertions so the server can resolve
    // the user during discoverable (passkey) login.
    this.userHandle = base64UrlToUint8Array(options.user.id)

    const credentialIdLength = Buffer.alloc(2)
    credentialIdLength.writeUInt16BE(this.credentialId.length, 0)
    const authData = Buffer.concat([
      this.rpIdHash(),
      Buffer.from([FLAG_USER_PRESENT | FLAG_USER_VERIFIED | FLAG_ATTESTED_CREDENTIAL_DATA]),
      Buffer.alloc(4), // signature counter starts at 0
      Buffer.alloc(16), // zero AAGUID
      credentialIdLength,
      this.credentialId,
      this.cosePublicKey,
    ])
    const attestationObject = cborEncode({ fmt: 'none', attStmt: {}, authData })
    const clientData = this.clientDataJSON('webauthn.create', options.challenge)

    return {
      id: this.credentialIdBase64Url,
      rawId: this.credentialIdBase64Url,
      type: 'public-key',
      response: {
        attestationObject: bytesToBase64URL(attestationObject),
        clientDataJSON: bytesToBase64URL(clientData),
        transports: ['usb'],
      },
      clientExtensionResults: {},
      authenticatorAttachment: 'cross-platform',
    }
  }

  /** Simulates navigator.credentials.get() for the given server options. */
  get(options: PublicKeyCredentialRequestOptionsJSON): AuthenticationResponseJSON {
    if (!this.userHandle) {
      throw new Error('No credential registered: call create() before get()')
    }

    this.signCount += 1
    const signCount = Buffer.alloc(4)
    signCount.writeUInt32BE(this.signCount, 0)
    const authenticatorData = Buffer.concat([
      this.rpIdHash(),
      Buffer.from([FLAG_USER_PRESENT | FLAG_USER_VERIFIED]),
      signCount,
    ])

    const clientData = this.clientDataJSON('webauthn.get', options.challenge)
    const clientDataHash = createHash('sha256').update(clientData).digest()
    const signature = createSign('SHA256')
      .update(Buffer.concat([authenticatorData, clientDataHash]))
      .sign(this.privateKey)

    return {
      id: this.credentialIdBase64Url,
      rawId: this.credentialIdBase64Url,
      type: 'public-key',
      response: {
        authenticatorData: bytesToBase64URL(authenticatorData),
        clientDataJSON: bytesToBase64URL(clientData),
        signature: bytesToBase64URL(signature),
        userHandle: bytesToBase64URL(this.userHandle),
      },
      clientExtensionResults: {},
      authenticatorAttachment: 'cross-platform',
    }
  }
}
