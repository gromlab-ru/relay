import type { CurrentSessionResponse } from 'infra/backend-api'
import type { CurrentSession } from '../types/current-session.type'

/**
 * Преобразует ответ серверного API в доменную сессию.
 */
export const mapCurrentSessionDto = (dto: CurrentSessionResponse): CurrentSession => {
  return {
    permissions: dto.permissions,
    userId: dto.userId
  }
}
