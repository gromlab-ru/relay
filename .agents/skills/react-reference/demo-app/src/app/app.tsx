import { RouterProvider } from 'react-router-dom'
import { AuthenticationProvider } from 'domains/authentication'
import { ThemeProvider } from 'ui/themes'
import { appRouter } from './router/app-router'

/**
 * Отображает корневую композицию приложения.
 *
 * Используется для:
 *  - подключения жизненного цикла авторизации
 *  - подключения общей темы
 *  - подключения маршрутизатора
 */
export const App = () => (
  <ThemeProvider>
    <AuthenticationProvider>
      <RouterProvider router={appRouter} />
    </AuthenticationProvider>
  </ThemeProvider>
)
