import { createApiClient, HttpClient, operationsTree } from './generated'
import { getAccessToken } from './access-token-storage'

const httpClient = new HttpClient({
  baseUrl: '/api',
  timeout: 10_000,
  headers: {
    Accept: 'application/json'
  },
  onRequest(request) {
    if (request.secure !== true) {
      return request
    }

    const headers = new Headers(request.headers)
    if (headers.has('Authorization')) {
      return request
    }

    const accessToken = getAccessToken()
    if (accessToken === null) {
      return request
    }

    headers.set('Authorization', `Bearer ${accessToken}`)

    return { ...request, headers }
  }
})

/**
 * Предоставляет операции серверного API через единый настроенный HTTP-клиент.
 */
export const backendApi = createApiClient(httpClient, operationsTree)
