/**
 * Управление визуальной цветовой схемой приложения.
 */
export type ThemeColorSchemeControls = {
  /**
   * Указывает, что сейчас используется тёмная схема.
   */
  isDark: boolean
  /**
   * Переключает светлую и тёмную схемы.
   */
  toggleColorScheme: () => void
}
