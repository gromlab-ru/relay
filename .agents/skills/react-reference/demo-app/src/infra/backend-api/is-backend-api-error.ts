import { ApiError } from './generated'

/**
 * Проверяет минимальную форму тела ошибки серверного API.
 */
const hasProblemCode = (value: unknown): value is { code: string } => {
  return (
    typeof value === 'object' &&
    value !== null &&
    'code' in value &&
    typeof value.code === 'string'
  )
}

/**
 * Проверяет HTTP-статус и код технической ошибки серверного API.
 */
export const isBackendApiError = (
  error: unknown,
  status: number,
  code?: string
): boolean => {
  if (!(error instanceof ApiError) || error.status !== status) {
    return false
  }

  if (code === undefined) {
    return true
  }

  return hasProblemCode(error.error) && error.error.code === code
}
