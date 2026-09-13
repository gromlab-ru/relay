import { Anchor, AppShell, Container, Group } from '@mantine/core'
import cl from 'clsx'
import { Link } from 'react-router-dom'
import { AppIcon } from 'infra/app-icons'
import styles from './styles/header.module.css'
import type { HeaderProps } from './types/header-props.type'
import { ThemeColorSchemeToggle } from './ui/theme-color-scheme-toggle'

/**
 * Отображает навигацию демонстрационного приложения.
 *
 * Используется для:
 *  - перехода к стартовому экрану и примеру маршрутизации
 *  - доступа к переключателю цветовой схемы
 */
export const Header = (props: HeaderProps) => {
  const { className, ...rootAttrs } = props

  return (
    <AppShell.Header {...rootAttrs} className={cl(styles.root, className)}>
      <Container className={styles.inner} size="lg">
        <Anchor className={styles.brand} component={Link} fw={700} to="/" underline="never">
          <AppIcon
            aria-hidden="true"
            className={styles.brandIcon}
            height={24}
            icon="app-mark"
            width={24}
          />
          <span>React Reference</span>
        </Anchor>
        <Group gap="xs" wrap="nowrap">
          <Anchor className={styles.homeLink} component={Link} size="sm" to="/" underline="never">
            Главная
          </Anchor>
          <Anchor component={Link} size="sm" to="/account" underline="never">
            Кабинет
          </Anchor>
          <ThemeColorSchemeToggle />
        </Group>
      </Container>
    </AppShell.Header>
  )
}
