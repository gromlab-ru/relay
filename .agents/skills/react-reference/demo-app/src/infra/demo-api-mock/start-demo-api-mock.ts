import { setupWorker } from 'msw/browser'
import { authenticationHandlers } from './authentication.handlers'
import { usersHandlers } from './users.handlers'

const worker = setupWorker(...authenticationHandlers, ...usersHandlers)

/**
 * Запускает автономную имитацию API до отображения приложения.
 */
export const startDemoApiMock = async (): Promise<void> => {
  await worker.start({
    onUnhandledRequest: 'bypass',
    serviceWorker: {
      url: `${import.meta.env.BASE_URL}mockServiceWorker.js`
    }
  })
}
