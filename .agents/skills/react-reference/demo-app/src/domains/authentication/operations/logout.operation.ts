import { clearAccessToken, getAccessToken } from 'infra/backend-api'
import { toApplicationDefect } from 'shared/errors'
import { authenticationStore } from '../stores/authentication.store'

/**
 * Закрывает сессию и возвращает credential для best-effort server sign-out.
 */
export const takeAccessTokenAndLogout = (): string | null => {
  authenticationStore.getState().setStatus('unauthenticated')

  try {
    const accessToken = getAccessToken()
    clearAccessToken()
    return accessToken
  } catch (error) {
    throw toApplicationDefect('authentication.logout', error)
  }
}

/**
 * Идемпотентно закрывает локальную авторизованную сессию.
 */
export const logout = (): void => {
  takeAccessTokenAndLogout()
}
