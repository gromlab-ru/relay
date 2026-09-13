import { backendApi, isBackendApiError } from 'infra/backend-api'
import { createAuthenticationUnavailableError } from '../errors/authentication-error.factory'
import { mapCurrentSessionDto } from '../mappers/current-session.mapper'
import { logoutRejectedAuthentication } from '../operations/logout-rejected-authentication.operation'
import type { CurrentSession } from '../types/current-session.type'

/**
 * Возвращает текущую сессию или null без авторизации.
 */
export const getCurrentSession = async (): Promise<CurrentSession | null> => {
  try {
    const responseDto = await backendApi.authentication.getCurrentSession()

    return mapCurrentSessionDto(responseDto)
  } catch (error) {
    if (isBackendApiError(error, 401)) {
      if (logoutRejectedAuthentication(error)) {
        return null
      }

      throw createAuthenticationUnavailableError()
    }

    throw createAuthenticationUnavailableError()
  }
}
