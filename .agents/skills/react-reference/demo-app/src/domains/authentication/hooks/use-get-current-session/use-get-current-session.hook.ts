import useSWR from 'swr'
import { getCurrentSession } from '../../adapters/get-current-session.adapter'
import { getCurrentSessionKey } from './get-current-session-key'
import type {
  GetCurrentSessionData,
  GetCurrentSessionError,
  GetCurrentSessionKey,
  UseGetCurrentSessionResponse
} from './types/use-get-current-session.type'

/**
 * Предоставляет текущую сессию через единую запись SWR-кеша.
 */
export const useGetCurrentSession = (): UseGetCurrentSessionResponse => {
  const key = getCurrentSessionKey()
  const fetcher = () => getCurrentSession()

  return useSWR<GetCurrentSessionData, GetCurrentSessionError, GetCurrentSessionKey>(key, fetcher)
}
