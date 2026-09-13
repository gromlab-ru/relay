import { ActionIcon, Tooltip } from '@mantine/core'
import { IconMoon, IconSun } from '@tabler/icons-react'
import cl from 'clsx'
import { useThemeColorScheme } from 'ui/themes'
import styles from './styles/theme-color-scheme-toggle.module.css'
import type { ThemeColorSchemeToggleProps } from './types/theme-color-scheme-toggle-props.type'

/**
 * Переключает светлую и тёмную цветовые схемы приложения.
 *
 * Используется для:
 *  - отображения действия для текущей цветовой схемы
 *  - сохранения выбранной пользователем схемы
 */
export const ThemeColorSchemeToggle = (props: ThemeColorSchemeToggleProps) => {
  const { className, ...rootAttrs } = props
  const { isDark, toggleColorScheme } = useThemeColorScheme()
  const label = isDark ? 'Включить светлую тему' : 'Включить тёмную тему'

  return (
    <Tooltip label={label} position="bottom">
      <ActionIcon
        {...rootAttrs}
        aria-label={label}
        className={cl(styles.root, className)}
        color="indigo"
        onClick={toggleColorScheme}
        radius="xl"
        size="lg"
        variant="subtle"
      >
        {isDark ? <IconSun aria-hidden="true" size={20} /> : <IconMoon aria-hidden="true" size={20} />}
      </ActionIcon>
    </Tooltip>
  )
}
