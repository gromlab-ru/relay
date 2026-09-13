import { backendApi, isBackendApiError } from 'infra/backend-api'
import { toApplicationDefect } from 'shared/errors'
import { logoutRejectedAuthentication } from '../operations/logout-rejected-authentication.operation'

/**
 * Best-effort уведомляет backend о завершении уже закрытой локальной сессии.
 */
export const signOut = async (accessToken: string): Promise<void> => {
  try {
    await backendApi.authentication.signOut({
      headers: { Authorization: `Bearer ${accessToken}` }
    })
  } catch (error) {
    if (isBackendApiError(error, 401)) {
      logoutRejectedAuthentication(error)
      return
    }

    throw toApplicationDefect('authentication.signOut', error)
  }
}
