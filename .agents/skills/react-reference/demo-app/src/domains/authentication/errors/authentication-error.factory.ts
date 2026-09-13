import { AUTHENTICATION_ERROR_CODE } from './authentication-error-code'
import { AuthenticationDomainError } from './authentication-domain.error'

/**
 * Создаёт ошибку неверных данных входа.
 */
export const createInvalidCredentialsError = (): AuthenticationDomainError => {
  return new AuthenticationDomainError({
    code: AUTHENTICATION_ERROR_CODE.INVALID_CREDENTIALS
  })
}

/**
 * Создаёт ошибку временной недоступности авторизации.
 */
export const createAuthenticationUnavailableError = (): AuthenticationDomainError => {
  return new AuthenticationDomainError({
    code: AUTHENTICATION_ERROR_CODE.TEMPORARILY_UNAVAILABLE
  })
}
