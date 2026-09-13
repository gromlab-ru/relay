import { MantineProvider } from '@mantine/core'
import { theme } from '../../config/theme.config'
import type { ThemeProviderProps } from './types/theme-provider-props.type'
import '../../styles/index.css'

/**
 * Подключает общую визуальную тему Mantine к дочернему дереву приложения.
 *
 * Используется для:
 *  - предоставления настроек темы компонентам Mantine
 *  - управления цветовой схемой приложения
 */
export const ThemeProvider = (props: ThemeProviderProps) => {
  const { children } = props

  return (
    <MantineProvider defaultColorScheme="auto" theme={theme}>
      {children}
    </MantineProvider>
  )
}
