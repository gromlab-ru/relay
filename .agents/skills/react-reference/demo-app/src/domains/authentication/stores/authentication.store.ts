import { createStore } from 'zustand/vanilla'
import type { AuthenticationStore } from './types/authentication-store.type'

/**
 * Хранит клиентский статус домена авторизации.
 */
export const authenticationStore = createStore<AuthenticationStore>()((set) => ({
  status: 'unknown',
  setStatus: (status) => set({ status })
}))
