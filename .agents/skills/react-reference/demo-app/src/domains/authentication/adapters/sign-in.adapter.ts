import { backendApi, setAccessToken } from 'infra/backend-api'
import { toApplicationDefect } from 'shared/errors'
import { createAuthenticationUnavailableError, createInvalidCredentialsError } from '../errors/authentication-error.factory'
import { mapSignInInput } from '../mappers/sign-in-request.mapper'
import { mapSignInResponseDto } from '../mappers/sign-in-response.mapper'
import { isAuthenticationUnavailableSourceError } from '../source-errors/is-authentication-unavailable-source-error'
import { isInvalidCredentialsSourceError } from '../source-errors/is-invalid-credentials-source-error'
import type { CurrentSession } from '../types/current-session.type'
import type { SignInInput } from '../types/sign-in-input.type'

/**
 * Создаёт локальную сессию и возвращает авторизованного пользователя.
 */
export const signIn = async (input: SignInInput): Promise<CurrentSession> => {
  try {
    const requestDto = mapSignInInput(input)
    const responseDto = await backendApi.authentication.signIn(requestDto)
    const result = mapSignInResponseDto(responseDto)

    setAccessToken(result.accessToken)

    return result.currentSession
  } catch (error) {
    if (isInvalidCredentialsSourceError(error)) {
      throw createInvalidCredentialsError()
    }

    if (isAuthenticationUnavailableSourceError(error)) {
      throw createAuthenticationUnavailableError()
    }

    throw toApplicationDefect('authentication.signIn', error)
  }
}
