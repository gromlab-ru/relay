import type { USER_ERROR_CODE } from './user-error-code'

/**
 * Данные ожидаемой ошибки User.
 */
export type UserErrorDetails = Readonly<{
  /**
   * Стабильный код ошибки.
   */
  code: (typeof USER_ERROR_CODE)[keyof typeof USER_ERROR_CODE]
}>

/**
 * Ожидаемая ошибка операции User.
 */
export class UserDomainError extends Error {
  readonly name = 'UserDomainError'

  /**
   * Создаёт ошибку с доменными данными.
   */
  constructor(readonly details: UserErrorDetails) {
    super(`user:${details.code}`)
  }
}
