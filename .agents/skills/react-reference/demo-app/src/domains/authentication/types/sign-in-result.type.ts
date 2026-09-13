import type { CurrentSession } from './current-session.type'

/**
 * Внутренний результат успешного ответа операции входа.
 */
export type SignInResult = Readonly<{
  /**
   * Непрозрачный JWT для технического хранилища.
   */
  accessToken: string
  /**
   * Созданная сессия пользователя.
   */
  currentSession: CurrentSession
}>
