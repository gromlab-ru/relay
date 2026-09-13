import { isBackendApiError } from 'infra/backend-api'

/**
 * Проверяет отказ серверного API из-за неверных данных входа.
 */
export const isInvalidCredentialsSourceError = (error: unknown): boolean => {
  return isBackendApiError(error, 401, 'INVALID_CREDENTIALS')
}
