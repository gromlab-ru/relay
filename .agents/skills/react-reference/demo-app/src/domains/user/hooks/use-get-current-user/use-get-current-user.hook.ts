import useSWR from 'swr'
import { useGetCurrentSession } from 'domains/authentication'
import { getCurrentUser } from '../../adapters/get-current-user.adapter'
import { getCurrentUserKey } from './get-current-user-key'
import type {
  GetCurrentUserData,
  GetCurrentUserError,
  GetCurrentUserKey,
  UseGetCurrentUserResponse
} from './types/use-get-current-user.type'

/**
 * Получает профиль в приватной области кеша текущей сессии.
 */
export const useGetCurrentUser = (): UseGetCurrentUserResponse => {
  const currentSession = useGetCurrentSession()
  const userId = currentSession.data?.userId ?? null
  const key = getCurrentUserKey(userId)
  const fetcher = () => getCurrentUser()

  return useSWR<GetCurrentUserData, GetCurrentUserError, GetCurrentUserKey | null>(key, fetcher)
}
