import { http, HttpResponse } from 'msw'
import { demoIdentityConfig } from './demo-identity.config'

/**
 * Проверяет тело запроса входа перед сравнением демонстрационных данных.
 */
const isSignInRequest = (value: unknown): value is { login: string; password: string } => {
  return (
    typeof value === 'object' &&
    value !== null &&
    'login' in value &&
    typeof value.login === 'string' &&
    'password' in value &&
    typeof value.password === 'string'
  )
}

/**
 * Проверяет Bearer JWT защищённого демонстрационного запроса.
 */
const hasValidAccessToken = (request: Request): boolean => {
  return request.headers.get('Authorization') === `Bearer ${demoIdentityConfig.accessToken}`
}

/**
 * Имитирует wire-контракт операций Authentication.
 */
export const authenticationHandlers = [
  http.post('/api/identity/authentication/sign-in', async ({ request }) => {
    const requestData: unknown = await request.json()

    if (
      !isSignInRequest(requestData) ||
      requestData.login !== demoIdentityConfig.login ||
      requestData.password !== demoIdentityConfig.password
    ) {
      return HttpResponse.json({ code: 'INVALID_CREDENTIALS' }, { status: 401 })
    }

    return HttpResponse.json({
      accessToken: demoIdentityConfig.accessToken,
      currentSession: demoIdentityConfig.session
    })
  }),
  http.get('/api/identity/authentication/session', ({ request }) => {
    if (!hasValidAccessToken(request)) {
      return HttpResponse.json({ code: 'NOT_AUTHENTICATED' }, { status: 401 })
    }

    return HttpResponse.json(demoIdentityConfig.session)
  }),
  http.post('/api/identity/authentication/sign-out', ({ request }) => {
    if (!hasValidAccessToken(request)) {
      return HttpResponse.json({ code: 'NOT_AUTHENTICATED' }, { status: 401 })
    }

    return new HttpResponse(null, { status: 204 })
  })
]
