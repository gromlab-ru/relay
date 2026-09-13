import type { SignInResponse } from 'infra/backend-api'
import { mapCurrentSessionDto } from './current-session.mapper'
import type { SignInResult } from '../types/sign-in-result.type'

/**
 * Преобразует ответ входа в локальную сессию и непрозрачный JWT.
 */
export const mapSignInResponseDto = (dto: SignInResponse): SignInResult => {
  return {
    accessToken: dto.accessToken,
    currentSession: mapCurrentSessionDto(dto.currentSession)
  }
}
