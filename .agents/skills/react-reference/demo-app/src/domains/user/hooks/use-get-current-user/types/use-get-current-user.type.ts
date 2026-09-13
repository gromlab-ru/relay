import type { SWRResponse } from 'swr'
import type { GetCurrentUserError as CurrentUserDomainError } from '../../../errors/get-current-user-error.type'
import type { CurrentUser } from '../../../types/current-user.type'

/**
 * Данные GET-операции профиля пользователя.
 */
export type GetCurrentUserData = CurrentUser

/**
 * Ошибка GET-операции профиля пользователя.
 */
export type GetCurrentUserError = CurrentUserDomainError

/**
 * Ключ кеша GET-операции профиля пользователя.
 */
export type GetCurrentUserKey = readonly [
  'private',
  string,
  'backend-api/identity/users/get-current-user'
]

/**
 * Результат хука загрузки профиля пользователя.
 */
export type UseGetCurrentUserResponse = SWRResponse<GetCurrentUserData, GetCurrentUserError>
