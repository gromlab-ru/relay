import {
  getAccessToken,
  getBackendApiErrorAccessToken,
  isBackendApiError
} from 'infra/backend-api'
import { toApplicationDefect } from 'shared/errors'
import { logout } from './logout.operation'

/**
 * Завершает только ту сессию, Bearer credential которой отклонил backend.
 */
export const logoutRejectedAuthentication = (error: unknown): boolean => {
  if (!isBackendApiError(error, 401)) {
    return false
  }

  let currentAccessToken: string | null
  try {
    currentAccessToken = getAccessToken()
  } catch (storageError) {
    logout()
    throw toApplicationDefect(
      'authentication.readRejectedCredential',
      storageError
    )
  }

  if (getBackendApiErrorAccessToken(error) !== currentAccessToken) {
    return false
  }

  logout()
  return true
}
