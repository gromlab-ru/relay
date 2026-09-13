import { AppShell, Container, Text } from '@mantine/core'
import cl from 'clsx'
import styles from './styles/footer.module.css'
import type { FooterProps } from './types/footer-props.type'

/**
 * Отображает пояснение к демонстрационному приложению.
 *
 * Используется для:
 *  - обозначения связи документации с рабочим кодом
 */
export const Footer = (props: FooterProps) => {
  const { className, ...rootAttrs } = props

  return (
    <AppShell.Footer {...rootAttrs} className={cl(styles.root, className)}>
      <Container className={styles.inner} size="lg">
        <Text c="dimmed" size="sm">
          Документация, подтверждённая рабочим приложением.
        </Text>
      </Container>
    </AppShell.Footer>
  )
}
