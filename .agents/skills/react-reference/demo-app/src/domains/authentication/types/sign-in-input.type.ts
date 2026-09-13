/**
 * Предметные параметры входа пользователя.
 */
export type SignInInput = Readonly<{
  /**
   * Логин пользователя.
   */
  login: string
  /**
   * Временный пароль, который нельзя сохранять в кеше.
   */
  password: string
}>
