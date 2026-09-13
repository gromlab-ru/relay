import { AppShell } from '@mantine/core'
import cl from 'clsx'
import { Outlet } from 'react-router-dom'
import styles from './styles/main.module.css'
import type { MainLayoutProps } from './types/main-layout-props.type'
import { Footer } from './ui/footer'
import { Header } from './ui/header'

/**
 * Отображает постоянный каркас демонстрационного приложения.
 *
 * Используется для:
 *  - размещения верхней и нижней панелей вокруг маршрутных экранов
 *  - отображения вложенного маршрута через Outlet
 */
export const MainLayout = (props: MainLayoutProps) => {
  const { className, ...rootAttrs } = props

  return (
    <AppShell
      {...rootAttrs}
      className={cl(styles.root, className)}
      footer={{ height: 56 }}
      header={{ height: 64 }}
      padding={0}
    >
      <Header />
      <AppShell.Main className={styles.main}>
        <Outlet />
      </AppShell.Main>
      <Footer />
    </AppShell>
  )
}
