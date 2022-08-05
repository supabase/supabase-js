export class AuthError extends Error {
  protected __isAuthError = true

  constructor(message: string) {
    super(message)
    this.name = 'AuthError'
  }
}

export function isAuthError(error: unknown): error is AuthError {
  return typeof error === 'object' && error !== null && '__isAuthError' in error
}

export class AuthApiError extends AuthError {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'AuthApiError'
    this.status = status
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      status: this.status,
    }
  }
}

export class AuthUnknownError extends AuthError {
  originalError: unknown

  constructor(message: string, originalError: unknown) {
    super(message)
    this.name = 'AuthUnknownError'
    this.originalError = originalError
  }
}

export class CustomAuthError extends AuthError {
  name: string
  status: number
  constructor(message: string, name: string, status: number) {
    super(message)
    this.name = name
    this.status = status
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      status: this.status,
    }
  }
}

export class AuthEventMissingError extends CustomAuthError {
  constructor() {
    super('Auth event missing!', 'AuthEventMissingError', 400)
  }
}

export class AuthSessionMissingError extends CustomAuthError {
  constructor() {
    super('Auth session missing!', 'AuthSessionMissingError', 400)
  }
}

export class AuthNoCookieError extends CustomAuthError {
  constructor() {
    super('No cookie found!', 'AuthNoCookieError', 401)
  }
}

export class AuthInvalidCredentialsError extends CustomAuthError {
  constructor(message: string) {
    super(message, 'AuthInvalidCredentialsError', 400)
  }
}
