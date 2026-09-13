import { isBackendApiError } from 'infra/backend-api'

/**
 * Проверяет временную недоступность серверного API.
 */
export const isAuthenticationUnavailableSourceError = (error: unknown): boolean => {
  return isBackendApiError(error, 503, 'TEMPORARILY_UNAVAILABLE')
}
