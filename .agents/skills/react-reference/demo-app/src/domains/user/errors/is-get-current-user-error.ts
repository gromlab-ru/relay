import { USER_ERROR_CODE } from './user-error-code'
import type { GetCurrentUserError } from './get-current-user-error.type'
import { UserDomainError } from './user-domain.error'

/**
 * Проверяет ожидаемую ошибку получения профиля.
 */
export const isGetCurrentUserError = (error: unknown): error is GetCurrentUserError => {
  return (
    error instanceof UserDomainError &&
    error.details.code === USER_ERROR_CODE.TEMPORARILY_UNAVAILABLE
  )
}
