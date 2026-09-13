import { ApiError } from './generated'

const BEARER_PREFIX = 'Bearer '

/**
 * Возвращает Bearer access token, с которым был отправлен неуспешный запрос.
 */
export const getBackendApiErrorAccessToken = (error: unknown): string | null => {
  if (!(error instanceof ApiError)) {
    return null
  }

  const authorization = new Headers(error.request.headers).get('Authorization')
  if (
    authorization === null ||
    !authorization.toLowerCase().startsWith(BEARER_PREFIX.toLowerCase())
  ) {
    return null
  }

  const accessToken = authorization.slice(BEARER_PREFIX.length).trim()

  return accessToken.length === 0 ? null : accessToken
}
