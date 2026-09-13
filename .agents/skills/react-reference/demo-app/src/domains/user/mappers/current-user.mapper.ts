import type { CurrentUserResponse } from 'infra/backend-api'
import type { CurrentUser } from '../types/current-user.type'

/**
 * Преобразует ответ серверного API в профиль пользователя.
 */
export const mapCurrentUserDto = (dto: CurrentUserResponse): CurrentUser => {
  return {
    displayName: dto.displayName,
    email: dto.email,
    id: dto.id
  }
}
