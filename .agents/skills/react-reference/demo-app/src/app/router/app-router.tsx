import { createBrowserRouter } from 'react-router-dom'
import { MainLayout } from 'compositions/layouts/main'
import { HomeScreen } from 'compositions/screens/home'
import { NotFoundScreen } from 'compositions/screens/not-found'
import { RouteErrorBoundary } from './route-error-boundary/route-error-boundary'
import { RoutePending } from './route-pending/route-pending'

/**
 * Определяет дерево URL и способ подключения маршрутов приложения.
 */
export const appRouter = createBrowserRouter([
  {
    path: '/',
    element: <MainLayout />,
    errorElement: <RouteErrorBoundary />,
    hydrateFallbackElement: <RoutePending />,
    children: [
      {
        index: true,
        Component: HomeScreen
      },
      {
        path: 'sign-in',
        lazy: () => import('compositions/screens/sign-in/lazy')
      },
      {
        lazy: () => import('compositions/route-boundaries/require-authentication/lazy'),
        children: [
          {
            path: 'account',
            lazy: () => import('compositions/screens/account/lazy')
          }
        ]
      },
      {
        path: '*',
        Component: NotFoundScreen
      }
    ]
  }
])
