import type { SignInRequest } from 'infra/backend-api'
import type { SignInInput } from '../types/sign-in-input.type'

/**
 * Преобразует параметры входа в запрос серверного API.
 */
export const mapSignInInput = (input: SignInInput): SignInRequest => {
  return {
    login: input.login,
    password: input.password
  }
}
