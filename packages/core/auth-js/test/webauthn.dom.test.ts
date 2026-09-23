import type {
  AuthenticationCredential,
  AuthenticationResponseJSON,
  RegistrationCredential,
  RegistrationResponseJSON,
} from '../src/lib/webauthn.dom'

type Equal<Left, Right> =
  (<Value>() => Value extends Left ? 1 : 2) extends <Value>() => Value extends Right ? 1 : 2
    ? true
    : false

type Expect<Value extends true> = Value

type RegistrationCredentialReturnsRegistrationJSON = Expect<
  Equal<ReturnType<RegistrationCredential['toJSON']>, RegistrationResponseJSON>
>

type AuthenticationCredentialReturnsAuthenticationJSON = Expect<
  Equal<ReturnType<AuthenticationCredential['toJSON']>, AuthenticationResponseJSON>
>

describe('WebAuthn credential types', () => {
  test('preserve registration and authentication JSON return types', () => {
    const registration: RegistrationCredentialReturnsRegistrationJSON = true
    const authentication: AuthenticationCredentialReturnsAuthenticationJSON = true

    expect(registration).toBe(true)
    expect(authentication).toBe(true)
  })
})
