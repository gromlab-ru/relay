/**
 * Возвращает безопасный внутренний адрес после входа.
 */
export const getSignInReturnTo = (state: unknown): string => {
  if (
    typeof state === 'object' &&
    state !== null &&
    'returnTo' in state &&
    typeof state.returnTo === 'string' &&
    state.returnTo.startsWith('/') &&
    !state.returnTo.startsWith('//')
  ) {
    return state.returnTo
  }

  return '/account'
}
