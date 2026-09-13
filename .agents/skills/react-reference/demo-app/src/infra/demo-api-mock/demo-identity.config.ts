/**
 * Данные автономного пользователя для MSW-обработчиков идентификации.
 */
export const demoIdentityConfig = {
  accessToken: 'eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJzdWIiOiJkZW1vLXVzZXIifQ.demo-signature',
  login: 'demo@example.com',
  password: 'demo-password',
  profile: {
    displayName: 'Демо-пользователь',
    email: 'demo@example.com',
    id: 'demo-user'
  },
  session: {
    permissions: ['account:read'],
    userId: 'demo-user'
  }
} as const
