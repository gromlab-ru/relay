const ACCESS_TOKEN_KEY = 'react-reference.identity.access-token'

/**
 * Возвращает сохранённый JWT как непрозрачную строку.
 */
export const getAccessToken = (): string | null => {
  const accessToken = localStorage.getItem(ACCESS_TOKEN_KEY)

  if (accessToken === null) {
    return null
  }

  if (accessToken.length === 0 || accessToken.trim() !== accessToken) {
    localStorage.removeItem(ACCESS_TOKEN_KEY)
    return null
  }

  return accessToken
}

/**
 * Сохраняет непустой JWT текущей сессии.
 */
export const setAccessToken = (accessToken: string): void => {
  if (accessToken.length === 0 || accessToken.trim() !== accessToken) {
    throw new TypeError('Access token must be non-empty without outer whitespace')
  }

  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken)
}

/**
 * Идемпотентно удаляет JWT текущей сессии.
 */
export const clearAccessToken = (): void => {
  localStorage.removeItem(ACCESS_TOKEN_KEY)
}
