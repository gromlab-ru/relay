import type { AUTHENTICATION_ERROR_CODE } from './authentication-error-code'

/**
 * Ожидаемая ошибка чтения текущей сессии.
 */
export type GetCurrentSessionError = Error & Readonly<{
  /**
   * Данные ошибки чтения сессии.
   */
  details: Readonly<{
    /**
     * Код временной недоступности авторизации.
     */
    code: typeof AUTHENTICATION_ERROR_CODE.TEMPORARILY_UNAVAILABLE
  }>
  /**
   * Имя доменной ошибки во время выполнения.
   */
  name: 'AuthenticationDomainError'
}>
