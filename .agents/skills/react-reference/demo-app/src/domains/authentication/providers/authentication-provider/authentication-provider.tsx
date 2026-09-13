import { useEffect } from 'react'
import { useSWRConfig } from 'swr'
import { getCurrentSessionKey } from '../../hooks/use-get-current-session/get-current-session-key'
import { useGetCurrentSession } from '../../hooks/use-get-current-session/use-get-current-session.hook'
import { isPrivateCacheKey } from '../../hooks/use-authentication-actions/is-private-cache-key'
import { useAuthenticationStatus } from '../../hooks/use-authentication-status/use-authentication-status.hook'
import { authenticationStore } from '../../stores/authentication.store'
import type { AuthenticationProviderProps } from './types/authentication-provider-props.type'

/**
 * Подключает жизненный цикл авторизации к доменному состоянию и SWR-кешу.
 *
 * Используется для:
 *  - определения статуса авторизации при запуске
 *  - очистки сессии и приватного кеша после выхода или защищённого 401
 */
export const AuthenticationProvider = (props: AuthenticationProviderProps) => {
  const { children } = props
  const { mutate } = useSWRConfig()
  const currentSession = useGetCurrentSession()
  const authenticationStatus = useAuthenticationStatus()
  const setAuthenticationStatus = authenticationStore.getState().setStatus

  useEffect(() => {
    if (currentSession.data === undefined) {
      return
    }

    setAuthenticationStatus(
      currentSession.data === null
        ? 'unauthenticated'
        : 'authenticated'
    )
  }, [currentSession.data, setAuthenticationStatus])

  useEffect(() => {
    if (authenticationStatus !== 'unauthenticated') {
      return
    }

    void Promise.all([
      mutate(getCurrentSessionKey(), null, { revalidate: false }),
      mutate(isPrivateCacheKey, undefined, { revalidate: false })
    ])
  }, [authenticationStatus, mutate])

  return children
}
