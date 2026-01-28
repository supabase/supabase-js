/**
 * Synthetic WebAuthn test fixtures for testing authentication flows
 * These are clearly deterministic test values, NOT real credentials
 * All sensitive fields have been replaced with synthetic data for security
 */

import { AuthenticationResponseJSON, RegistrationResponseJSON } from '../src/lib/webauthn'
import { base64UrlToUint8Array } from '../src/lib/base64url'
import { AuthenticationCredential, RegistrationCredential } from '../src/lib/webauthn.dom'

export const webauthnAssertionCredentialResponse = {
  factorId: '1c339118-cf88-4cee-b393-fc787827aa44',
  challengeId: '3c18b413-67d0-4e39-a78e-ab700693169f',
  challenge: 'TEST-CHALLENGE-BASE64URL-ENCODED-STRING-FOR-WEBAUTHN-AUTHENTICATION-FLOW',

  credentialId:
    'SYNTHETIC-TEST-CREDENTIAL-ID-0123456789ABCDEF-NOT-A-REAL-CREDENTIAL-IDENTIFIER',
  rpId: 'localhost',
  origin: 'http://localhost:5173',

  credentialResponse: {
    id: 'SYNTHETIC-TEST-CREDENTIAL-ID-0123456789ABCDEF-NOT-A-REAL-CREDENTIAL-IDENTIFIER',
    rawId: 'SYNTHETIC-TEST-CREDENTIAL-ID-0123456789ABCDEF-NOT-A-REAL-CREDENTIAL-IDENTIFIER',
    type: 'public-key',
    response: {
      authenticatorData: 'MOCK-AUTHENTICATOR-DATA-TEST-VALUE-BASE64URL',
      clientDataJSON:
        'eyJ0eXBlIjoid2ViYXV0aG4uZ2V0IiwiY2hhbGxlbmdlIjoiVEVTVC1DSEFMTEVORUUiLCJvcmlnaW4iOiJodHRwOi8vbG9jYWxob3N0OjUxNzMiLCJjcm9zc09yaWdpbiI6ZmFsc2V9',
      signature:
        'MOCK-ECDSA-SIGNATURE-TEST-VALUE-00112233445566778899AABBCCDDEEFF-NOT-REAL-SIGNATURE',
    },
    authenticatorAttachment: 'cross-platform',
    clientExtensionResults: {},
  } as AuthenticationResponseJSON,


  authenticatorDataParsed: {
    rpIdHash: 'SYNTHETIC-RP-ID-HASH-TEST-VALUE-BASE64-ENCODED',
    flags: 5,
    signCount: 5,
  },

  clientDataParsed: {
    type: 'webauthn.get',
    challenge: 'TEST-CHALLENGE-BASE64URL-ENCODED-STRING-FOR-WEBAUTHN-AUTHENTICATION-FLOW',
    origin: 'http://localhost:5173',
    crossOrigin: false,
  },
}

export const webauthnAssertionMockCredential = {
  id: webauthnAssertionCredentialResponse.credentialResponse.id,
  rawId: base64UrlToUint8Array(webauthnAssertionCredentialResponse.credentialResponse.rawId).buffer,
  type: 'public-key' as const,
  authenticatorAttachment:
    webauthnAssertionCredentialResponse.credentialResponse.authenticatorAttachment || null,
  parseCreationOptionsFromJSON: jest.fn(),
  parseRequestOptionsFromJSON: jest.fn(),
  toJSON: jest.fn(() => webauthnAssertionCredentialResponse.credentialResponse),
  getClientExtensionResults: jest.fn(
    () => webauthnAssertionCredentialResponse.credentialResponse.clientExtensionResults
  ),
  response: {
    clientDataJSON: base64UrlToUint8Array(
      webauthnAssertionCredentialResponse.credentialResponse.response.clientDataJSON
    ).buffer,
    authenticatorData: base64UrlToUint8Array(
      webauthnAssertionCredentialResponse.credentialResponse.response.authenticatorData
    ).buffer,
    signature: base64UrlToUint8Array(
      webauthnAssertionCredentialResponse.credentialResponse.response.signature
    ).buffer,
    userHandle: null,
  },
} as AuthenticationCredential

export const webauthnCreationCredentialResponse = {
  factorId: '1c339118-cf88-4cee-b393-fc787827aa44',
  challengeId: '78276c27-aab0-48cb-b745-3f697055ad94',
  challenge: 'TEST-REGISTRATION-CHALLENGE-BASE64URL-FOR-WEBAUTHN-CREDENTIAL-CREATION',
  rpId: 'localhost',
  origin: 'http://localhost:5173',
  credentialResponse: {
    id: 'SYNTHETIC-TEST-CREDENTIAL-ID-0123456789ABCDEF-NOT-A-REAL-CREDENTIAL-IDENTIFIER',
    rawId: 'SYNTHETIC-TEST-CREDENTIAL-ID-0123456789ABCDEF-NOT-A-REAL-CREDENTIAL-IDENTIFIER',
    type: 'public-key',
    response: {
      attestationObject:
        'MOCK-ATTESTATION-OBJECT-CBOR-ENCODED-TEST-DATA-FOR-WEBAUTHN-REGISTRATION-FLOW-0123456789ABCDEF',
      clientDataJSON:
        'eyJ0eXBlIjoid2ViYXV0aG4uY3JlYXRlIiwiY2hhbGxlbmdlIjoiVEVTVC1SRUdJU1RSQVRJT04tQ0hBTExFTkdFIiwib3JpZ2luIjoiaHR0cDovL2xvY2FsaG9zdDo1MTczIiwiY3Jvc3NPcmlnaW4iOmZhbHNlfQ',
      authenticatorData:
        'MOCK-REGISTRATION-AUTHENTICATOR-DATA-WITH-ATTESTED-CREDENTIAL-DATA-TEST-VALUE-BASE64URL',
      publicKey:
        'MOCK-PUBLIC-KEY-ECDSA-P256-SPKI-FORMAT-TEST-DATA-FOR-WEBAUTHN-NOT-A-REAL-PUBLIC-KEY',
      publicKeyAlgorithm: -7,
      transports: ['usb'],
    },
    authenticatorAttachment: 'cross-platform',
  } as RegistrationResponseJSON,
}

export const webauthnCreationMockCredential = {
  id: webauthnCreationCredentialResponse.credentialResponse.id,
  rawId: base64UrlToUint8Array(webauthnCreationCredentialResponse.credentialResponse.rawId).buffer,
  type: 'public-key' as const,
  authenticatorAttachment:
    webauthnCreationCredentialResponse.credentialResponse.authenticatorAttachment || null,
  parseCreationOptionsFromJSON: jest.fn(),
  parseRequestOptionsFromJSON: jest.fn(),
  toJSON: jest.fn(() => webauthnCreationCredentialResponse.credentialResponse),
  getClientExtensionResults: jest.fn(() => ({})),
  response: {
    clientDataJSON: base64UrlToUint8Array(
      webauthnCreationCredentialResponse.credentialResponse.response.clientDataJSON
    ).buffer,
    attestationObject: base64UrlToUint8Array(
      webauthnCreationCredentialResponse.credentialResponse.response.attestationObject
    ).buffer,
    getTransports: jest.fn(
      () => webauthnCreationCredentialResponse.credentialResponse.response.transports || []
    ),
    getAuthenticatorData: jest.fn(
      () =>
        base64UrlToUint8Array(
          webauthnCreationCredentialResponse.credentialResponse.response.authenticatorData!
        ).buffer
    ),
    getPublicKey: jest.fn(
      () =>
        base64UrlToUint8Array(
          webauthnCreationCredentialResponse.credentialResponse.response.publicKey!
        ).buffer
    ),
    getPublicKeyAlgorithm: jest.fn(
      () => webauthnCreationCredentialResponse.credentialResponse.response.publicKeyAlgorithm!
    ),
  },
} as RegistrationCredential