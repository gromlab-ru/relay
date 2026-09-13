import { Button, Container, Stack, Text, Title } from '@mantine/core'
import cl from 'clsx'
import { Link, useLocation } from 'react-router-dom'
import styles from './styles/not-found.module.css'
import type { NotFoundScreenProps } from './types/not-found-screen-props.type'

/**
 * Отображает экран неизвестного адреса приложения.
 *
 * Используется для:
 *  - сообщения об отсутствующем маршруте
 *  - возврата пользователя на главную страницу
 */
export const NotFoundScreen = (props: NotFoundScreenProps) => {
  const { className, ...rootAttrs } = props
  const location = useLocation()

  return (
    <Container
      {...rootAttrs}
      className={cl(styles.root, className)}
      component="section"
      size="sm"
    >
      <Stack gap="lg">
        <Text c="indigo" fw={700} size="sm">
          Ошибка 404
        </Text>
        <Title order={1}>Страница не найдена</Title>
        <Text c="dimmed">
          Адрес <Text component="span" fw={600}>{location.pathname}</Text> не относится к известному маршруту.
        </Text>
        <Button component={Link} to="/">
          Вернуться на главную
        </Button>
      </Stack>
    </Container>
  )
}
