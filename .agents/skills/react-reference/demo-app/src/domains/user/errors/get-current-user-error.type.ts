import type { USER_ERROR_CODE } from './user-error-code'

/**
 * Ожидаемая ошибка получения профиля пользователя.
 */
export type GetCurrentUserError = Error & Readonly<{
  /**
   * Данные ошибки чтения профиля.
   */
  details: Readonly<{
    /**
     * Код временной недоступности профиля.
     */
    code: typeof USER_ERROR_CODE.TEMPORARILY_UNAVAILABLE
  }>
  /**
   * Имя доменной ошибки во время выполнения.
   */
  name: 'UserDomainError'
}>
