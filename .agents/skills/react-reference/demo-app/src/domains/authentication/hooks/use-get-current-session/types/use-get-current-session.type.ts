import type { SWRResponse } from 'swr'
import type { GetCurrentSessionError as CurrentSessionDomainError } from '../../../errors/get-current-session-error.type'
import type { CurrentSession } from '../../../types/current-session.type'

/**
 * Данные GET-операции текущей сессии.
 */
export type GetCurrentSessionData = CurrentSession | null

/**
 * Ошибка GET-операции текущей сессии.
 */
export type GetCurrentSessionError = CurrentSessionDomainError

/**
 * Ключ кеша GET-операции текущей сессии.
 */
export type GetCurrentSessionKey = readonly ['authentication/current-session']

/**
 * Результат хука загрузки текущей сессии.
 */
export type UseGetCurrentSessionResponse = SWRResponse<GetCurrentSessionData, GetCurrentSessionError>
