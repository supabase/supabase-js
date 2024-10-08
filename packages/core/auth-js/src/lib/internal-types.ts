import { AuthError } from './errors'

export type MFAEnrollTOTPParams = {
  /** The type of factor being enrolled. */
  factorType: 'totp'
  /** Domain which the user is enrolled with. */
  issuer?: string
  /** Human readable name assigned to the factor. */
  friendlyName?: string
}
export type MFAEnrollPhoneParams = {
  /** The type of factor being enrolled. */
  factorType: 'phone'
  /** Human readable name assigned to the factor. */
  friendlyName?: string
  /** Phone number associated with a factor. Number should conform to E.164 format */
  phone: string
}

export type AuthMFAEnrollTOTPResponse =
  | {
      data: {
        /** ID of the factor that was just enrolled (in an unverified state). */
        id: string

        /** Type of MFA factor.*/
        type: 'totp'

        /** TOTP enrollment information. */
        totp: {
          /** Contains a QR code encoding the authenticator URI. You can
           * convert it to a URL by prepending `data:image/svg+xml;utf-8,` to
           * the value. Avoid logging this value to the console. */
          qr_code: string

          /** The TOTP secret (also encoded in the QR code). Show this secret
           * in a password-style field to the user, in case they are unable to
           * scan the QR code. Avoid logging this value to the console. */
          secret: string

          /** The authenticator URI encoded within the QR code, should you need
           * to use it. Avoid loggin this value to the console. */
          uri: string
        }
        /** Friendly name of the factor, useful for distinguishing between factors **/
        friendly_name?: string
      }
      error: null
    }
  | {
      data: null
      error: AuthError
    }

export type AuthMFAEnrollPhoneResponse =
  | {
      data: {
        /** ID of the factor that was just enrolled (in an unverified state). */
        id: string

        /** Type of MFA factor. */
        type: 'phone'

        /** Friendly name of the factor, useful for distinguishing between factors **/
        friendly_name?: string

        /** Phone number of the MFA factor in E.164 format. Used to send messages  */
        phone: string
      }
      error: null
    }
  | {
      data: null
      error: AuthError
    }
