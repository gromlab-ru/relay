/**
 * Проверяет принадлежность ключа приватным данным приложения или пользователя.
 */
export const isPrivateCacheKey = (key: unknown, userId?: string): boolean => {
  return (
    Array.isArray(key) &&
    key[0] === 'private' &&
    (userId === undefined || key[1] === userId)
  )
}
