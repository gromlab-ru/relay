/**
 * Текущая авторизованная сессия приложения.
 */
export type CurrentSession = Readonly<{
  /**
   * Разрешения текущей сессии.
   */
  permissions: readonly string[]
  /**
   * Стабильный идентификатор авторизованного пользователя.
   */
  userId: string
}>
