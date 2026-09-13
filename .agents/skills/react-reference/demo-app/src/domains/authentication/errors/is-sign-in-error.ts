import { AuthenticationDomainError } from './authentication-domain.error'
import type { SignInError } from './sign-in-error.type'

/**
 * Проверяет ожидаемую ошибку операции входа.
 */
export const isSignInError = (error: unknown): error is SignInError => {
  return error instanceof AuthenticationDomainError
}
