import type { GetCurrentSessionKey } from './types/use-get-current-session.type'

/**
 * Возвращает стабильный ключ сессии без JWT.
 */
export const getCurrentSessionKey = (): GetCurrentSessionKey => {
  return ['authentication/current-session']
}
