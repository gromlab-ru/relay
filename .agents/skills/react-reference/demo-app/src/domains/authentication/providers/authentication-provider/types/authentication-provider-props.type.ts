import type { ReactNode } from 'react'

/**
 * Свойства владельца жизненного цикла авторизации.
 */
export type AuthenticationProviderProps = Readonly<{
  /**
   * Дочернее дерево приложения.
   */
  children: ReactNode
}>
