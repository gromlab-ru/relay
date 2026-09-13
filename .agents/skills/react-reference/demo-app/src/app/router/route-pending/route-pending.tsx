import { Center, Loader } from '@mantine/core'
import cl from 'clsx'
import styles from './styles/route-pending.module.css'
import type { RoutePendingProps } from './types/route-pending-props.type'

/**
 * Показывает состояние ожидания при динамической загрузке маршрута.
 *
 * Используется для:
 *  - отображения загрузки до получения компонента страницы
 */
export const RoutePending = (props: RoutePendingProps) => {
  const { className, ...rootAttrs } = props

  return (
    <Center {...rootAttrs} className={cl(styles.root, className)}>
      <Loader aria-label="Страница загружается" />
    </Center>
  )
}
