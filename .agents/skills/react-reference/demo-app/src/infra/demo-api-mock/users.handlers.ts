import { http, HttpResponse } from 'msw'
import { demoIdentityConfig } from './demo-identity.config'

/**
 * Имитирует защищённые операции профиля пользователя.
 */
export const usersHandlers = [
  http.get('/api/identity/users/current', ({ request }) => {
    if (request.headers.get('Authorization') !== `Bearer ${demoIdentityConfig.accessToken}`) {
      return HttpResponse.json({ code: 'NOT_AUTHENTICATED' }, { status: 401 })
    }

    return HttpResponse.json(demoIdentityConfig.profile)
  })
]
