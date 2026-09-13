/**
 * Допустимые статусы авторизации.
 */
export type AuthenticationStatus = 'unknown' | 'authenticated' | 'unauthenticated'

/**
 * Состояние и действия домена авторизации.
 */
export type AuthenticationStore = Readonly<{
  /**
   * Текущий статус авторизации.
   */
  status: AuthenticationStatus
  /**
   * Изменяет статус авторизации.
   */
  setStatus: (status: AuthenticationStatus) => void
}>
