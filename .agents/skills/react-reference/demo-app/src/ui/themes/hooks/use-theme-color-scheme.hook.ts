import { useComputedColorScheme, useMantineColorScheme } from '@mantine/core'
import type { ThemeColorSchemeControls } from '../types/theme-color-scheme-controls.type'

/**
 * Возвращает текущую визуальную схему и действие для её переключения.
 */
export const useThemeColorScheme = (): ThemeColorSchemeControls => {
  const colorScheme = useComputedColorScheme('light', { getInitialValueInEffect: false })
  const { toggleColorScheme } = useMantineColorScheme()

  return {
    isDark: colorScheme === 'dark',
    toggleColorScheme
  }
}
