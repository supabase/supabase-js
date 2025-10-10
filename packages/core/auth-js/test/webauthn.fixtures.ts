/**
 * Real WebAuthn test fixtures captured from actual authentication flows
 * This data was captured from a successful WebAuthn authentication with Touch ID on macOS
 */

import { AuthenticationResponseJSON, RegistrationResponseJSON } from '../src/lib/webauthn'
import { base64UrlToUint8Array } from '../src/lib/base64url'
import { AuthenticationCredential, RegistrationCredential } from '../src/lib/webauthn.dom'

export const webauthnAssertionCredentialResponse = {
  factorId: '1c339118-cf88-4cee-b393-fc787827aa44',
  challengeId: '3c18b413-67d0-4e39-a78e-ab700693169f',
  challenge: 'VbLuwKyYzmr6zL3lMyaWH5oeZ1-XolTc-PWKyAP9_xM',

  credentialId:
    'DdXDk8SeBbRJ9Tdzixah_kx8ss4_R6vsChaoN0og-00lrytX9ih4ohyUoU_jtiQ4ObCpgyZedT8fCm9VcgAYpQ',
  rpId: 'localhost',
  origin: 'http://localhost:5173',

  credentialResponse: {
    id: 'DdXDk8SeBbRJ9Tdzixah_kx8ss4_R6vsChaoN0og-00lrytX9ih4ohyUoU_jtiQ4ObCpgyZedT8fCm9VcgAYpQ',
    rawId: 'DdXDk8SeBbRJ9Tdzixah_kx8ss4_R6vsChaoN0og-00lrytX9ih4ohyUoU_jtiQ4ObCpgyZedT8fCm9VcgAYpQ',
    type: 'public-key',
    response: {
      authenticatorData: 'SZYN5YgOjGh0NBcPZHZgW4_krrmihjLHmVzzuoMdl2MFAAAABQ',
      clientDataJSON:
        'eyJ0eXBlIjoid2ViYXV0aG4uZ2V0IiwiY2hhbGxlbmdlIjoiVmJMdXdLeVl6bXI2ekwzbE15YVdINW9lWjEtWG9sVGMtUFdLeUFQOV94TSIsIm9yaWdpbiI6Imh0dHA6Ly9sb2NhbGhvc3Q6NTE3MyIsImNyb3NzT3JpZ2luIjpmYWxzZX0',
      signature:
        'MEQCICn34eDexsucGLVWem0lrAb92HhM5Aj-U2ed2TJneNIyAiA50q-SpbRQD5MvRsqBGy8NAKonupEtZyRdOgcs70APZQ',
    },
    authenticatorAttachment: 'cross-platform',
    clientExtensionResults: {},
  } as AuthenticationResponseJSON,
  

  authenticatorDataParsed: {
    rpIdHash: 'SZYN5YgOjGh0NBcPZHZgW4/krrmihjLHmVzzuoMdl2M=',
    flags: 5,
    signCount: 5,
  },

  clientDataParsed: {
    type: 'webauthn.get',
    challenge: 'VbLuwKyYzmr6zL3lMyaWH5oeZ1-XolTc-PWKyAP9_xM',
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
  challenge: 'W6tSIPRrwCkkBztAtl_lJyrB3umFlvSdGdcYti-OsGM',
  rpId: 'localhost',
  origin: 'http://localhost:5173',
  credentialResponse: {
    id: 'DdXDk8SeBbRJ9Tdzixah_kx8ss4_R6vsChaoN0og-00lrytX9ih4ohyUoU_jtiQ4ObCpgyZedT8fCm9VcgAYpQ',
    rawId: 'DdXDk8SeBbRJ9Tdzixah_kx8ss4_R6vsChaoN0og-00lrytX9ih4ohyUoU_jtiQ4ObCpgyZedT8fCm9VcgAYpQ',
    type: 'public-key',
    response: {
      attestationObject:
        'o2NmbXRkbm9uZWdhdHRTdG10oGhhdXRoRGF0YVjESZYN5YgOjGh0NBcPZHZgW4_krrmihjLHmVzzuoMdl2NFAAAAAgAAAAAAAAAAAAAAAAAAAAAAQA3Vw5PEngW0SfU3c4sWof5MfLLOP0er7AoWqDdKIPtNJa8rV_YoeKIclKFP47YkODmwqYMmXnU_HwpvVXIAGKWlAQIDJiABIVggbz6gtnM1dDzJghgBiBGJJZaBpLXgT19WZEcQT5JAanciWCDlC-xVpfcZ7XWG_ZWck47XX0OefXvECdEjIuTqT6MCIQ',
      clientDataJSON:
        'eyJ0eXBlIjoid2ViYXV0aG4uY3JlYXRlIiwiY2hhbGxlbmdlIjoiVzZ0U0lQUnJ3Q2trQnp0QXRsX2xKeXJCM3VtRmx2U2RHZGNZdGktT3NHTSIsIm9yaWdpbiI6Imh0dHA6Ly9sb2NhbGhvc3Q6NTE3MyIsImNyb3NzT3JpZ2luIjpmYWxzZX0',
      authenticatorData:
        'SZYN5YgOjGh0NBcPZHZgW4_krrmihjLHmVzzuoMdl2NFAAAAAgAAAAAAAAAAAAAAAAAAAAAAQA3Vw5PEngW0SfU3c4sWof5MfLLOP0er7AoWqDdKIPtNJa8rV_YoeKIclKFP47YkODmwqYMmXnU_HwpvVXIAGKWlAQIDJiABIVggbz6gtnM1dDzJghgBiBGJJZaBpLXgT19WZEcQT5JAanciWCDlC-xVpfcZ7XWG_ZWck47XX0OefXvECdEjIuTqT6MCIQ',
      publicKey:
        'MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEbz6gtnM1dDzJghgBiBGJJZaBpLXgT19WZEcQT5JAanflC-xVpfcZ7XWG_ZWck47XX0OefXvECdEjIuTqT6MCIQ',
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