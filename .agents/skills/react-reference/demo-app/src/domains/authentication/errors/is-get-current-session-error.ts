import { AUTHENTICATION_ERROR_CODE } from './authentication-error-code'
import { AuthenticationDomainError } from './authentication-domain.error'
import type { GetCurrentSessionError } from './get-current-session-error.type'

/**
 * Проверяет ожидаемую ошибку чтения текущей сессии.
 */
export const isGetCurrentSessionError = (error: unknown): error is GetCurrentSessionError => {
  return (
    error instanceof AuthenticationDomainError &&
    error.details.code === AUTHENTICATION_ERROR_CODE.TEMPORARILY_UNAVAILABLE
  )
}
