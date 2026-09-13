import { logoutRejectedAuthentication } from 'domains/authentication'
import { backendApi, isBackendApiError } from 'infra/backend-api'
import { createUserUnavailableError } from '../errors/user-error.factory'
import { mapCurrentUserDto } from '../mappers/current-user.mapper'
import type { CurrentUser } from '../types/current-user.type'

/**
 * Возвращает профиль текущего пользователя.
 */
export const getCurrentUser = async (): Promise<CurrentUser> => {
  try {
    const responseDto = await backendApi.users.getCurrentUser()

    return mapCurrentUserDto(responseDto)
  } catch (error) {
    if (isBackendApiError(error, 401)) {
      logoutRejectedAuthentication(error)
    }

    throw createUserUnavailableError()
  }
}
