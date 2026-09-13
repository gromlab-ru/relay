import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './app'

const rootElement = document.querySelector('#root')

if (rootElement === null) {
  throw new Error('Не найден корневой элемент приложения')
}

/**
 * Запускает технические ресурсы и отображает корневой компонент приложения.
 */
const startApp = async (): Promise<void> => {
  const { startDemoApiMock } = await import('infra/demo-api-mock/lazy')

  await startDemoApiMock()

  createRoot(rootElement).render(
    <StrictMode>
      <App />
    </StrictMode>
  )
}

void startApp()
