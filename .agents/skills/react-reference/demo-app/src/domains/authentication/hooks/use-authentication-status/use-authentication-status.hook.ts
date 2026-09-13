import { useStore } from 'zustand'
import { authenticationStore } from '../../stores/authentication.store'
import type {
  AuthenticationStatus,
  AuthenticationStore
} from '../../stores/types/authentication-store.type'

const selectAuthenticationStatus = (store: AuthenticationStore): AuthenticationStatus => {
  return store.status
}

/**
 * Возвращает текущий статус авторизации.
 */
export const useAuthenticationStatus = (): AuthenticationStatus => {
  return useStore(authenticationStore, selectAuthenticationStatus)
}
