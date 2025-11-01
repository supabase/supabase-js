import GoTrueClient from '../GoTrueClient'
import { base64UrlToUint8Array, bytesToBase64URL } from './base64url'
import { AuthError, AuthUnknownError, isAuthError } from './errors'
import {
  AuthMFAEnrollWebauthnResponse,
  AuthMFAVerifyResponse,
  AuthMFAVerifyResponseData,
  MFAChallengeWebauthnParams,
  MFAEnrollWebauthnParams,
  MFAVerifyWebauthnParamFields,
  MFAVerifyWebauthnParams,
  RequestResult,
  StrictOmit,
} from './types'
import { isBrowser } from './helpers'
import type {
  AuthenticationCredential,
  AuthenticationResponseJSON,
  AuthenticatorAttachment,
  PublicKeyCredentialCreationOptionsFuture,
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialFuture,
  PublicKeyCredentialRequestOptionsFuture,
  PublicKeyCredentialRequestOptionsJSON,
  RegistrationCredential,
  RegistrationResponseJSON,
} from './webauthn.dom'

import {
  identifyAuthenticationError,
  identifyRegistrationError,
  isWebAuthnError,
  WebAuthnError,
  WebAuthnUnknownError,
} from './webauthn.errors'

export { WebAuthnError, isWebAuthnError, identifyRegistrationError, identifyAuthenticationError }
// Re-export the JSON types for use in other files
export type { RegistrationResponseJSON, AuthenticationResponseJSON }

/**
 * WebAuthn abort service to manage ceremony cancellation.
 * Ensures only one WebAuthn ceremony is active at a time to prevent "operation already in progress" errors.
 *
 * @experimental This class is experimental and may change in future releases
 * @see {@link https://w3c.github.io/webauthn/#sctn-automation-webdriver-capability W3C WebAuthn Spec - Aborting Ceremonies}
 */
export class WebAuthnAbortService {
  private controller: AbortController | undefined

  /**
   * Create an abort signal for a new WebAuthn operation.
   * Automatically cancels any existing operation.
   *
   * @returns {AbortSignal} Signal to pass to navigator.credentials.create() or .get()
   * @see {@link https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal MDN - AbortSignal}
   */
  createNewAbortSignal(): AbortSignal {
    // Abort any existing calls to navigator.credentials.create() or navigator.credentials.get()
    if (this.controller) {
      const abortError = new Error('Cancelling existing WebAuthn API call for new one')
      abortError.name = 'AbortError'
      this.controller.abort(abortError)
    }

    const newController = new AbortController()
    this.controller = newController
    return newController.signal
  }

  /**
   * Manually cancel the current WebAuthn operation.
   * Useful for cleaning up when user cancels or navigates away.
   *
   * @see {@link https://developer.mozilla.org/en-US/docs/Web/API/AbortController/abort MDN - AbortController.abort}
   */
  cancelCeremony(): void {
    if (this.controller) {
      const abortError = new Error('Manually cancelling existing WebAuthn API call')
      abortError.name = 'AbortError'
      this.controller.abort(abortError)
      this.controller = undefined
    }
  }
}

/**
 * Singleton instance to ensure only one WebAuthn ceremony is active at a time.
 * This prevents "operation already in progress" errors when retrying WebAuthn operations.
 *
 * @experimental This instance is experimental and may change in future releases
 */
export const webAuthnAbortService = new WebAuthnAbortService()

/**
 * Server response format for WebAuthn credential creation options.
 * Uses W3C standard JSON format with base64url-encoded binary fields.
 */
export type ServerCredentialCreationOptions = PublicKeyCredentialCreationOptionsJSON

/**
 * Server response format for WebAuthn credential request options.
 * Uses W3C standard JSON format with base64url-encoded binary fields.
 */
export type ServerCredentialRequestOptions = PublicKeyCredentialRequestOptionsJSON

/**
 * Convert base64url encoded strings in WebAuthn credential creation options to ArrayBuffers
 * as required by the WebAuthn browser API.
 * Supports both native WebAuthn Level 3 parseCreationOptionsFromJSON and manual fallback.
 *
 * @param {ServerCredentialCreationOptions} options - JSON options from server with base64url encoded fields
 * @returns {PublicKeyCredentialCreationOptionsFuture} Options ready for navigator.credentials.create()
 * @see {@link https://w3c.github.io/webauthn/#sctn-parseCreationOptionsFromJSON W3C WebAuthn Spec - parseCreationOptionsFromJSON}
 */
export function deserializeCredentialCreationOptions(
  options: ServerCredentialCreationOptions
): PublicKeyCredentialCreationOptionsFuture {
  if (!options) {
    throw new Error('Credential creation options are required')
  }

  // Check if the native parseCreationOptionsFromJSON method is available
  if (
    typeof PublicKeyCredential !== 'undefined' &&
    'parseCreationOptionsFromJSON' in PublicKeyCredential &&
    typeof (PublicKeyCredential as unknown as PublicKeyCredentialFuture)
      .parseCreationOptionsFromJSON === 'function'
  ) {
    // Use the native WebAuthn Level 3 method
    return (
      PublicKeyCredential as unknown as PublicKeyCredentialFuture
    ).parseCreationOptionsFromJSON(
      /** we assert the options here as typescript still doesn't know about future webauthn types */
      options as any
    ) as PublicKeyCredentialCreationOptionsFuture
  }

  // Fallback to manual parsing for browsers that don't support the native method
  // Destructure to separate fields that need transformation
  const { challenge: challengeStr, user: userOpts, excludeCredentials, ...restOptions } = options

  // Convert challenge from base64url to ArrayBuffer
  const challenge = base64UrlToUint8Array(challengeStr).buffer as ArrayBuffer

  // Convert user.id from base64url to ArrayBuffer
  const user: PublicKeyCredentialUserEntity = {
    ...userOpts,
    id: base64UrlToUint8Array(userOpts.id).buffer as ArrayBuffer,
  }

  // Build the result object
  const result: PublicKeyCredentialCreationOptionsFuture = {
    ...restOptions,
    challenge,
    user,
  }

  // Only add excludeCredentials if it exists
  if (excludeCredentials && excludeCredentials.length > 0) {
    result.excludeCredentials = new Array(excludeCredentials.length)

    for (let i = 0; i < excludeCredentials.length; i++) {
      const cred = excludeCredentials[i]
      result.excludeCredentials[i] = {
        ...cred,
        id: base64UrlToUint8Array(cred.id).buffer,
        type: cred.type || 'public-key',
        // Cast transports to handle future transport types like "cable"
        transports: cred.transports,
      }
    }
  }

  return result
}

/**
 * Convert base64url encoded strings in WebAuthn credential request options to ArrayBuffers
 * as required by the WebAuthn browser API.
 * Supports both native WebAuthn Level 3 parseRequestOptionsFromJSON and manual fallback.
 *
 * @param {ServerCredentialRequestOptions} options - JSON options from server with base64url encoded fields
 * @returns {PublicKeyCredentialRequestOptionsFuture} Options ready for navigator.credentials.get()
 * @see {@link https://w3c.github.io/webauthn/#sctn-parseRequestOptionsFromJSON W3C WebAuthn Spec - parseRequestOptionsFromJSON}
 */
export function deserializeCredentialRequestOptions(
  options: ServerCredentialRequestOptions
): PublicKeyCredentialRequestOptionsFuture {
  if (!options) {
    throw new Error('Credential request options are required')
  }

  // Check if the native parseRequestOptionsFromJSON method is available
  if (
    typeof PublicKeyCredential !== 'undefined' &&
    'parseRequestOptionsFromJSON' in PublicKeyCredential &&
    typeof (PublicKeyCredential as unknown as PublicKeyCredentialFuture)
      .parseRequestOptionsFromJSON === 'function'
  ) {
    // Use the native WebAuthn Level 3 method
    return (
      PublicKeyCredential as unknown as PublicKeyCredentialFuture
    ).parseRequestOptionsFromJSON(options) as PublicKeyCredentialRequestOptionsFuture
  }

  // Fallback to manual parsing for browsers that don't support the native method
  // Destructure to separate fields that need transformation
  const { challenge: challengeStr, allowCredentials, ...restOptions } = options

  // Convert challenge from base64url to ArrayBuffer
  const challenge = base64UrlToUint8Array(challengeStr).buffer as ArrayBuffer

  // Build the result object
  const result: PublicKeyCredentialRequestOptionsFuture = {
    ...restOptions,
    challenge,
  }

  // Only add allowCredentials if it exists
  if (allowCredentials && allowCredentials.length > 0) {
    result.allowCredentials = new Array(allowCredentials.length)

    for (let i = 0; i < allowCredentials.length; i++) {
      const cred = allowCredentials[i]
      result.allowCredentials[i] = {
        ...cred,
        id: base64UrlToUint8Array(cred.id).buffer,
        type: cred.type || 'public-key',
        // Cast transports to handle future transport types like "cable"
        transports: cred.transports,
      }
    }
  }

  return result
}

/**
 * Server format for credential response with base64url-encoded binary fields
 * Can be either a registration or authentication response
 */
export type ServerCredentialResponse = RegistrationResponseJSON | AuthenticationResponseJSON

/**
 * Convert a registration/enrollment credential response to server format.
 * Serializes binary fields to base64url for JSON transmission.
 * Supports both native WebAuthn Level 3 toJSON and manual fallback.
 *
 * @param {RegistrationCredential} credential - Credential from navigator.credentials.create()
 * @returns {RegistrationResponseJSON} JSON-serializable credential for server
 * @see {@link https://w3c.github.io/webauthn/#dom-publickeycredential-tojson W3C WebAuthn Spec - toJSON}
 */
export function serializeCredentialCreationResponse(
  credential: RegistrationCredential
): RegistrationResponseJSON {
  // Check if the credential instance has the toJSON method
  if ('toJSON' in credential && typeof credential.toJSON === 'function') {
    // Use the native WebAuthn Level 3 method
    return (credential as RegistrationCredential).toJSON()
  }
  const credentialWithAttachment = credential as PublicKeyCredential & {
    response: AuthenticatorAttestationResponse
    authenticatorAttachment?: string | null
  }

  return {
    id: credential.id,
    rawId: credential.id,
    response: {
      attestationObject: bytesToBase64URL(new Uint8Array(credential.response.attestationObject)),
      clientDataJSON: bytesToBase64URL(new Uint8Array(credential.response.clientDataJSON)),
    },
    type: 'public-key',
    clientExtensionResults: credential.getClientExtensionResults(),
    // Convert null to undefined and cast to AuthenticatorAttachment type
    authenticatorAttachment: (credentialWithAttachment.authenticatorAttachment ?? undefined) as
      | AuthenticatorAttachment
      | undefined,
  }
}

/**
 * Convert an authentication/verification credential response to server format.
 * Serializes binary fields to base64url for JSON transmission.
 * Supports both native WebAuthn Level 3 toJSON and manual fallback.
 *
 * @param {AuthenticationCredential} credential - Credential from navigator.credentials.get()
 * @returns {AuthenticationResponseJSON} JSON-serializable credential for server
 * @see {@link https://w3c.github.io/webauthn/#dom-publickeycredential-tojson W3C WebAuthn Spec - toJSON}
 */
export function serializeCredentialRequestResponse(
  credential: AuthenticationCredential
): AuthenticationResponseJSON {
  // Check if the credential instance has the toJSON method
  if ('toJSON' in credential && typeof credential.toJSON === 'function') {
    // Use the native WebAuthn Level 3 method
    return (credential as AuthenticationCredential).toJSON()
  }

  // Fallback to manual conversion for browsers that don't support toJSON
  // Access authenticatorAttachment via type assertion to handle TypeScript version differences
  // @simplewebauthn/types includes this property but base TypeScript 4.7.4 doesn't
  const credentialWithAttachment = credential as PublicKeyCredential & {
    response: AuthenticatorAssertionResponse
    authenticatorAttachment?: string | null
  }

  const clientExtensionResults = credential.getClientExtensionResults()
  const assertionResponse = credential.response

  return {
    id: credential.id,
    rawId: credential.id, // W3C spec expects rawId to match id for JSON format
    response: {
      authenticatorData: bytesToBase64URL(new Uint8Array(assertionResponse.authenticatorData)),
      clientDataJSON: bytesToBase64URL(new Uint8Array(assertionResponse.clientDataJSON)),
      signature: bytesToBase64URL(new Uint8Array(assertionResponse.signature)),
      userHandle: assertionResponse.userHandle
        ? bytesToBase64URL(new Uint8Array(assertionResponse.userHandle))
        : undefined,
    },
    type: 'public-key',
    clientExtensionResults,
    // Convert null to undefined and cast to AuthenticatorAttachment type
    authenticatorAttachment: (credentialWithAttachment.authenticatorAttachment ?? undefined) as
      | AuthenticatorAttachment
      | undefined,
  }
}

/**
 * A simple test to determine if a hostname is a properly-formatted domain name.
 * Considers localhost valid for development environments.
 *
 * A "valid domain" is defined here: https://url.spec.whatwg.org/#valid-domain
 *
 * Regex sourced from here:
 * https://www.oreilly.com/library/view/regular-expressions-cookbook/9781449327453/ch08s15.html
 *
 * @param {string} hostname - The hostname to validate
 * @returns {boolean} True if valid domain or localhost
 * @see {@link https://url.spec.whatwg.org/#valid-domain WHATWG URL Spec - Valid Domain}
 */
export function isValidDomain(hostname: string): boolean {
  return (
    // Consider localhost valid as well since it's okay wrt Secure Contexts
    hostname === 'localhost' || /^([a-z0-9]+(-[a-z0-9]+)*\.)+[a-z]{2,}$/i.test(hostname)
  )
}

/**
 * Determine if the browser is capable of WebAuthn.
 * Checks for necessary Web APIs: PublicKeyCredential and Credential Management.
 *
 * @returns {boolean} True if browser supports WebAuthn
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/API/PublicKeyCredential#browser_compatibility MDN - PublicKeyCredential Browser Compatibility}
 */
function browserSupportsWebAuthn(): boolean {
  return !!(
    isBrowser() &&
    'PublicKeyCredential' in window &&
    window.PublicKeyCredential &&
    'credentials' in navigator &&
    typeof navigator?.credentials?.create === 'function' &&
    typeof navigator?.credentials?.get === 'function'
  )
}

/**
 * Create a WebAuthn credential using the browser's credentials API.
 * Wraps navigator.credentials.create() with error handling.
 *
 * @param {CredentialCreationOptions} options - Options including publicKey parameters
 * @returns {Promise<RequestResult<RegistrationCredential, WebAuthnError>>} Created credential or error
 * @see {@link https://w3c.github.io/webauthn/#sctn-createCredential W3C WebAuthn Spec - Create Credential}
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/API/CredentialsContainer/create MDN - credentials.create}
 */
export async function createCredential(
  options: StrictOmit<CredentialCreationOptions, 'publicKey'> & {
    publicKey: PublicKeyCredentialCreationOptionsFuture
  }
): Promise<RequestResult<RegistrationCredential, WebAuthnError>> {
  try {
    const response = await navigator.credentials.create(
      /** we assert the type here until typescript types are updated */
      options as Parameters<typeof navigator.credentials.create>[0]
    )
    if (!response) {
      return {
        data: null,
        error: new WebAuthnUnknownError('Empty credential response', response),
      }
    }
    if (!(response instanceof PublicKeyCredential)) {
      return {
        data: null,
        error: new WebAuthnUnknownError('Browser returned unexpected credential type', response),
      }
    }
    return { data: response as RegistrationCredential, error: null }
  } catch (err) {
    return {
      data: null,
      error: identifyRegistrationError({
        error: err as Error,
        options,
      }),
    }
  }
}

/**
 * Get a WebAuthn credential using the browser's credentials API.
 * Wraps navigator.credentials.get() with error handling.
 *
 * @param {CredentialRequestOptions} options - Options including publicKey parameters
 * @returns {Promise<RequestResult<AuthenticationCredential, WebAuthnError>>} Retrieved credential or error
 * @see {@link https://w3c.github.io/webauthn/#sctn-getAssertion W3C WebAuthn Spec - Get Assertion}
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/API/CredentialsContainer/get MDN - credentials.get}
 */
export async function getCredential(
  options: StrictOmit<CredentialRequestOptions, 'publicKey'> & {
    publicKey: PublicKeyCredentialRequestOptionsFuture
  }
): Promise<RequestResult<AuthenticationCredential, WebAuthnError>> {
  try {
    const response = await navigator.credentials.get(
      /** we assert the type here until typescript types are updated */
      options as Parameters<typeof navigator.credentials.get>[0]
    )
    if (!response) {
      return {
        data: null,
        error: new WebAuthnUnknownError('Empty credential response', response),
      }
    }
    if (!(response instanceof PublicKeyCredential)) {
      return {
        data: null,
        error: new WebAuthnUnknownError('Browser returned unexpected credential type', response),
      }
    }
    return { data: response as AuthenticationCredential, error: null }
  } catch (err) {
    return {
      data: null,
      error: identifyAuthenticationError({
        error: err as Error,
        options,
      }),
    }
  }
}

export const DEFAULT_CREATION_OPTIONS: Partial<PublicKeyCredentialCreationOptionsFuture> = {
  hints: ['security-key'],
  authenticatorSelection: {
    authenticatorAttachment: 'cross-platform',
    requireResidentKey: false,
    /** set to preferred because older yubikeys don't have PIN/Biometric */
    userVerification: 'preferred',
    residentKey: 'discouraged',
  },
  attestation: 'direct',
}

export const DEFAULT_REQUEST_OPTIONS: Partial<PublicKeyCredentialRequestOptionsFuture> = {
  /** set to preferred because older yubikeys don't have PIN/Biometric */
  userVerification: 'preferred',
  hints: ['security-key'],
  attestation: 'direct',
}

function deepMerge<T>(...sources: Partial<T>[]): T {
  const isObject = (val: unknown): val is Record<string, unknown> =>
    val !== null && typeof val === 'object' && !Array.isArray(val)

  const isArrayBufferLike = (val: unknown): val is ArrayBuffer | ArrayBufferView =>
    val instanceof ArrayBuffer || ArrayBuffer.isView(val)

  const result: Partial<T> = {}

  for (const source of sources) {
    if (!source) continue

    for (const key in source) {
      const value = source[key]
      if (value === undefined) continue

      if (Array.isArray(value)) {
        // preserve array reference, including unions like AuthenticatorTransport[]
        result[key] = value as T[typeof key]
      } else if (isArrayBufferLike(value)) {
        result[key] = value as T[typeof key]
      } else if (isObject(value)) {
        const existing = result[key]
        if (isObject(existing)) {
          result[key] = deepMerge(existing, value) as unknown as T[typeof key]
        } else {
          result[key] = deepMerge(value) as unknown as T[typeof key]
        }
      } else {
        result[key] = value as T[typeof key]
      }
    }
  }

  return result as T
}

/**
 * Merges WebAuthn credential creation options with overrides.
 * Sets sensible defaults for authenticator selection and extensions.
 *
 * @param {PublicKeyCredentialCreationOptionsFuture} baseOptions - The base options from the server
 * @param {PublicKeyCredentialCreationOptionsFuture} overrides - Optional overrides to apply
 * @param {string} friendlyName - Optional friendly name for the credential
 * @returns {PublicKeyCredentialCreationOptionsFuture} Merged credential creation options
 * @see {@link https://w3c.github.io/webauthn/#dictdef-authenticatorselectioncriteria W3C WebAuthn Spec - AuthenticatorSelectionCriteria}
 */
export function mergeCredentialCreationOptions(
  baseOptions: PublicKeyCredentialCreationOptionsFuture,
  overrides?: Partial<PublicKeyCredentialCreationOptionsFuture>
): PublicKeyCredentialCreationOptionsFuture {
  return deepMerge(DEFAULT_CREATION_OPTIONS, baseOptions, overrides || {})
}

/**
 * Merges WebAuthn credential request options with overrides.
 * Sets sensible defaults for user verification and hints.
 *
 * @param {PublicKeyCredentialRequestOptionsFuture} baseOptions - The base options from the server
 * @param {PublicKeyCredentialRequestOptionsFuture} overrides - Optional overrides to apply
 * @returns {PublicKeyCredentialRequestOptionsFuture} Merged credential request options
 * @see {@link https://w3c.github.io/webauthn/#dictdef-publickeycredentialrequestoptions W3C WebAuthn Spec - PublicKeyCredentialRequestOptions}
 */
export function mergeCredentialRequestOptions(
  baseOptions: PublicKeyCredentialRequestOptionsFuture,
  overrides?: Partial<PublicKeyCredentialRequestOptionsFuture>
): PublicKeyCredentialRequestOptionsFuture {
  return deepMerge(DEFAULT_REQUEST_OPTIONS, baseOptions, overrides || {})
}

/**
 * WebAuthn API wrapper for Supabase Auth.
 * Provides methods for enrolling, challenging, verifying, authenticating, and registering WebAuthn credentials.
 *
 * @experimental This API is experimental and may change in future releases
 * @see {@link https://w3c.github.io/webauthn/ W3C WebAuthn Specification}
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/API/Web_Authentication_API MDN - Web Authentication API}
 */
export class WebAuthnApi {
  public enroll: typeof WebAuthnApi.prototype._enroll
  public challenge: typeof WebAuthnApi.prototype._challenge
  public verify: typeof WebAuthnApi.prototype._verify
  public authenticate: typeof WebAuthnApi.prototype._authenticate
  public register: typeof WebAuthnApi.prototype._register

  constructor(private client: GoTrueClient) {
    // Bind all methods so they can be destructured
    this.enroll = this._enroll.bind(this)
    this.challenge = this._challenge.bind(this)
    this.verify = this._verify.bind(this)
    this.authenticate = this._authenticate.bind(this)
    this.register = this._register.bind(this)
  }

  /**
   * Enroll a new WebAuthn factor.
   * Creates an unverified WebAuthn factor that must be verified with a credential.
   *
   * @experimental This method is experimental and may change in future releases
   * @param {Omit<MFAEnrollWebauthnParams, 'factorType'>} params - Enrollment parameters (friendlyName required)
   * @returns {Promise<AuthMFAEnrollWebauthnResponse>} Enrolled factor details or error
   * @see {@link https://w3c.github.io/webauthn/#sctn-registering-a-new-credential W3C WebAuthn Spec - Registering a New Credential}
   */
  public async _enroll(
    params: Omit<MFAEnrollWebauthnParams, 'factorType'>
  ): Promise<AuthMFAEnrollWebauthnResponse> {
    return this.client.mfa.enroll({ ...params, factorType: 'webauthn' })
  }

  /**
   * Challenge for WebAuthn credential creation or authentication.
   * Combines server challenge with browser credential operations.
   * Handles both registration (create) and authentication (request) flows.
   *
   * @experimental This method is experimental and may change in future releases
   * @param {MFAChallengeWebauthnParams & { friendlyName?: string; signal?: AbortSignal }} params - Challenge parameters including factorId
   * @param {Object} overrides - Allows you to override the parameters passed to navigator.credentials
   * @param {PublicKeyCredentialCreationOptionsFuture} overrides.create - Override options for credential creation
   * @param {PublicKeyCredentialRequestOptionsFuture} overrides.request - Override options for credential request
   * @returns {Promise<RequestResult>} Challenge response with credential or error
   * @see {@link https://w3c.github.io/webauthn/#sctn-credential-creation W3C WebAuthn Spec - Credential Creation}
   * @see {@link https://w3c.github.io/webauthn/#sctn-verifying-assertion W3C WebAuthn Spec - Verifying Assertion}
   */
  public async _challenge(
    {
      factorId,
      webauthn,
      friendlyName,
      signal,
    }: MFAChallengeWebauthnParams & { friendlyName?: string; signal?: AbortSignal },
    overrides?:
      | {
          create?: Partial<PublicKeyCredentialCreationOptionsFuture>
          request?: never
        }
      | {
          create?: never
          request?: Partial<PublicKeyCredentialRequestOptionsFuture>
        }
  ): Promise<
    RequestResult<
      { factorId: string; challengeId: string } & {
        webauthn: StrictOmit<
          MFAVerifyWebauthnParamFields<'create' | 'request'>['webauthn'],
          'rpId' | 'rpOrigins'
        >
      },
      WebAuthnError | AuthError
    >
  > {
    try {
      // Get challenge from server using the client's MFA methods
      const { data: challengeResponse, error: challengeError } = await this.client.mfa.challenge({
        factorId,
        webauthn,
      })

      if (!challengeResponse) {
        return { data: null, error: challengeError }
      }

      const abortSignal = signal ?? webAuthnAbortService.createNewAbortSignal()

      /** webauthn will fail if either of the name/displayname are blank */
      if (challengeResponse.webauthn.type === 'create') {
        const { user } = challengeResponse.webauthn.credential_options.publicKey
        if (!user.name) {
          user.name = `${user.id}:${friendlyName}`
        }
        if (!user.displayName) {
          user.displayName = user.name
        }
      }

      switch (challengeResponse.webauthn.type) {
        case 'create': {
          const options = mergeCredentialCreationOptions(
            challengeResponse.webauthn.credential_options.publicKey,
            overrides?.create
          )

          const { data, error } = await createCredential({
            publicKey: options,
            signal: abortSignal,
          })

          if (data) {
            return {
              data: {
                factorId,
                challengeId: challengeResponse.id,
                webauthn: {
                  type: challengeResponse.webauthn.type,
                  credential_response: data,
                },
              },
              error: null,
            }
          }
          return { data: null, error }
        }

        case 'request': {
          const options = mergeCredentialRequestOptions(
            challengeResponse.webauthn.credential_options.publicKey,
            overrides?.request
          )

          const { data, error } = await getCredential({
            ...challengeResponse.webauthn.credential_options,
            publicKey: options,
            signal: abortSignal,
          })

          if (data) {
            return {
              data: {
                factorId,
                challengeId: challengeResponse.id,
                webauthn: {
                  type: challengeResponse.webauthn.type,
                  credential_response: data,
                },
              },
              error: null,
            }
          }
          return { data: null, error }
        }
      }
    } catch (error) {
      if (isAuthError(error)) {
        return { data: null, error }
      }
      return {
        data: null,
        error: new AuthUnknownError('Unexpected error in challenge', error),
      }
    }
  }

  /**
   * Verify a WebAuthn credential with the server.
   * Completes the WebAuthn ceremony by sending the credential to the server for verification.
   *
   * @experimental This method is experimental and may change in future releases
   * @param {Object} params - Verification parameters
   * @param {string} params.challengeId - ID of the challenge being verified
   * @param {string} params.factorId - ID of the WebAuthn factor
   * @param {MFAVerifyWebauthnParams<T>['webauthn']} params.webauthn - WebAuthn credential response
   * @returns {Promise<AuthMFAVerifyResponse>} Verification result with session or error
   * @see {@link https://w3c.github.io/webauthn/#sctn-verifying-assertion W3C WebAuthn Spec - Verifying an Authentication Assertion}
   * */
  public async _verify<T extends 'create' | 'request'>({
    challengeId,
    factorId,
    webauthn,
  }: {
    challengeId: string
    factorId: string
    webauthn: MFAVerifyWebauthnParams<T>['webauthn']
  }): Promise<AuthMFAVerifyResponse> {
    return this.client.mfa.verify({
      factorId,
      challengeId,
      webauthn: webauthn,
    })
  }

  /**
   * Complete WebAuthn authentication flow.
   * Performs challenge and verification in a single operation for existing credentials.
   *
   * @experimental This method is experimental and may change in future releases
   * @param {Object} params - Authentication parameters
   * @param {string} params.factorId - ID of the WebAuthn factor to authenticate with
   * @param {Object} params.webauthn - WebAuthn configuration
   * @param {string} params.webauthn.rpId - Relying Party ID (defaults to current hostname)
   * @param {string[]} params.webauthn.rpOrigins - Allowed origins (defaults to current origin)
   * @param {AbortSignal} params.webauthn.signal - Optional abort signal
   * @param {PublicKeyCredentialRequestOptionsFuture} overrides - Override options for navigator.credentials.get
   * @returns {Promise<RequestResult<AuthMFAVerifyResponseData, WebAuthnError | AuthError>>} Authentication result
   * @see {@link https://w3c.github.io/webauthn/#sctn-authentication W3C WebAuthn Spec - Authentication Ceremony}
   * @see {@link https://developer.mozilla.org/en-US/docs/Web/API/PublicKeyCredentialRequestOptions MDN - PublicKeyCredentialRequestOptions}
   */
  public async _authenticate(
    {
      factorId,
      webauthn: {
        rpId = typeof window !== 'undefined' ? window.location.hostname : undefined,
        rpOrigins = typeof window !== 'undefined' ? [window.location.origin] : undefined,
        signal,
      },
    }: {
      factorId: string
      webauthn: {
        rpId?: string
        rpOrigins?: string[]
        signal?: AbortSignal
      }
    },
    overrides?: PublicKeyCredentialRequestOptionsFuture
  ): Promise<RequestResult<AuthMFAVerifyResponseData, WebAuthnError | AuthError>> {
    if (!rpId) {
      return {
        data: null,
        error: new AuthError('rpId is required for WebAuthn authentication'),
      }
    }
    try {
      if (!browserSupportsWebAuthn()) {
        return {
          data: null,
          error: new AuthUnknownError('Browser does not support WebAuthn', null),
        }
      }

      // Get challenge and credential
      const { data: challengeResponse, error: challengeError } = await this.challenge(
        {
          factorId,
          webauthn: { rpId, rpOrigins },
          signal,
        },
        { request: overrides }
      )

      if (!challengeResponse) {
        return { data: null, error: challengeError }
      }

      const { webauthn } = challengeResponse

      // Verify credential
      return this._verify({
        factorId,
        challengeId: challengeResponse.challengeId,
        webauthn: {
          type: webauthn.type,
          rpId,
          rpOrigins,
          credential_response: webauthn.credential_response,
        },
      })
    } catch (error) {
      if (isAuthError(error)) {
        return { data: null, error }
      }
      return {
        data: null,
        error: new AuthUnknownError('Unexpected error in authenticate', error),
      }
    }
  }

  /**
   * Complete WebAuthn registration flow.
   * Performs enrollment, challenge, and verification in a single operation for new credentials.
   *
   * @experimental This method is experimental and may change in future releases
   * @param {Object} params - Registration parameters
   * @param {string} params.friendlyName - User-friendly name for the credential
   * @param {string} params.rpId - Relying Party ID (defaults to current hostname)
   * @param {string[]} params.rpOrigins - Allowed origins (defaults to current origin)
   * @param {AbortSignal} params.signal - Optional abort signal
   * @param {PublicKeyCredentialCreationOptionsFuture} overrides - Override options for navigator.credentials.create
   * @returns {Promise<RequestResult<AuthMFAVerifyResponseData, WebAuthnError | AuthError>>} Registration result
   * @see {@link https://w3c.github.io/webauthn/#sctn-registering-a-new-credential W3C WebAuthn Spec - Registration Ceremony}
   * @see {@link https://developer.mozilla.org/en-US/docs/Web/API/PublicKeyCredentialCreationOptions MDN - PublicKeyCredentialCreationOptions}
   */
  public async _register(
    {
      friendlyName,
      rpId = typeof window !== 'undefined' ? window.location.hostname : undefined,
      rpOrigins = typeof window !== 'undefined' ? [window.location.origin] : undefined,
      signal,
    }: {
      friendlyName: string
      rpId?: string
      rpOrigins?: string[]
      signal?: AbortSignal
    },
    overrides?: Partial<PublicKeyCredentialCreationOptionsFuture>
  ): Promise<RequestResult<AuthMFAVerifyResponseData, WebAuthnError | AuthError>> {
    if (!rpId) {
      return {
        data: null,
        error: new AuthError('rpId is required for WebAuthn registration'),
      }
    }
    try {
      if (!browserSupportsWebAuthn()) {
        return {
          data: null,
          error: new AuthUnknownError('Browser does not support WebAuthn', null),
        }
      }

      // Enroll factor
      const { data: factor, error: enrollError } = await this._enroll({
        friendlyName,
      })

      if (!factor) {
        await this.client.mfa
          .listFactors()
          .then((factors) =>
            factors.data?.all.find(
              (v) =>
                v.factor_type === 'webauthn' &&
                v.friendly_name === friendlyName &&
                v.status !== 'unverified'
            )
          )
          .then((factor) => (factor ? this.client.mfa.unenroll({ factorId: factor?.id }) : void 0))
        return { data: null, error: enrollError }
      }

      // Get challenge and create credential
      const { data: challengeResponse, error: challengeError } = await this._challenge(
        {
          factorId: factor.id,
          friendlyName: factor.friendly_name,
          webauthn: { rpId, rpOrigins },
          signal,
        },
        {
          create: overrides,
        }
      )

      if (!challengeResponse) {
        return { data: null, error: challengeError }
      }

      return this._verify({
        factorId: factor.id,
        challengeId: challengeResponse.challengeId,
        webauthn: {
          rpId,
          rpOrigins,
          type: challengeResponse.webauthn.type,
          credential_response: challengeResponse.webauthn.credential_response,
        },
      })
    } catch (error) {
      if (isAuthError(error)) {
        return { data: null, error }
      }
      return {
        data: null,
        error: new AuthUnknownError('Unexpected error in register', error),
      }
    }
  }
}
