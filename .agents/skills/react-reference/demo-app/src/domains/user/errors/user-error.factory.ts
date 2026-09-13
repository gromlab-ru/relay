import { USER_ERROR_CODE } from './user-error-code'
import { UserDomainError } from './user-domain.error'

/**
 * Создаёт ошибку временной недоступности профиля.
 */
export const createUserUnavailableError = (): UserDomainError => {
  return new UserDomainError({
    code: USER_ERROR_CODE.TEMPORARILY_UNAVAILABLE
  })
}
