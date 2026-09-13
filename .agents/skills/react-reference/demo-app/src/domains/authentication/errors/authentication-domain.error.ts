import type { AUTHENTICATION_ERROR_CODE } from './authentication-error-code'

/**
 * Данные ожидаемой ошибки Authentication.
 */
export type AuthenticationErrorDetails = Readonly<{
  /**
   * Стабильный код ошибки.
   */
  code: (typeof AUTHENTICATION_ERROR_CODE)[keyof typeof AUTHENTICATION_ERROR_CODE]
}>

/**
 * Ожидаемая ошибка операции Authentication.
 */
export class AuthenticationDomainError extends Error {
  readonly name = 'AuthenticationDomainError'

  /**
   * Создаёт ошибку с доменными данными.
   */
  constructor(readonly details: AuthenticationErrorDetails) {
    super(`authentication:${details.code}`)
  }
}
