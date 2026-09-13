import type { CurrentSession } from '../../../types/current-session.type'
import type { SignInInput } from '../../../types/sign-in-input.type'

/**
 * Действия авторизации с синхронизацией SWR-кеша.
 */
export type UseAuthenticationActionsResponse = Readonly<{
  /**
   * Выполняет вход и публикует новую сессию.
   */
  signIn: (input: SignInInput) => Promise<CurrentSession>
  /**
   * Завершает сессию и очищает приватные данные.
   */
  signOut: () => Promise<void>
}>
