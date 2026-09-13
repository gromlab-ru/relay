import type { AUTHENTICATION_ERROR_CODE } from './authentication-error-code'

/**
 * Ожидаемые ошибки операции входа.
 */
export type SignInError = Error & Readonly<{
  /**
   * Данные ошибки операции входа.
   */
  details: Readonly<{
    /**
     * Допустимый код ошибки входа.
     */
    code:
      | typeof AUTHENTICATION_ERROR_CODE.INVALID_CREDENTIALS
      | typeof AUTHENTICATION_ERROR_CODE.TEMPORARILY_UNAVAILABLE
  }>
  /**
   * Имя доменной ошибки во время выполнения.
   */
  name: 'AuthenticationDomainError'
}>
