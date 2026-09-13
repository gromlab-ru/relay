import type { ReactNode } from 'react'
import type { GetCurrentSessionError } from '../../../errors/get-current-session-error.type'

/**
 * Параметры отображения ошибки проверки авторизации.
 */
export type AuthGuardErrorRenderParams = Readonly<{
  /**
   * Доменная ошибка проверки текущей сессии.
   */
  error: GetCurrentSessionError
  /**
   * Повторяет проверку текущей сессии.
   */
  retry: () => void
}>

/**
 * Свойства границы авторизации.
 */
export type AuthGuardProps = Readonly<{
  /**
   * Содержимое для авторизованного пользователя.
   */
  children: ReactNode
  /**
   * Содержимое во время проверки текущей сессии.
   */
  pendingFallback?: ReactNode
  /**
   * Отображает доменную ошибку проверки сессии.
   */
  renderError?: (params: AuthGuardErrorRenderParams) => ReactNode
  /**
   * Содержимое для пользователя без действующей сессии.
   */
  unauthenticatedFallback?: ReactNode
}>
