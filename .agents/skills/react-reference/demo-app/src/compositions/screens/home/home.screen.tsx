import { Badge, Button, Container, Paper, SimpleGrid, Stack, Text, Title } from '@mantine/core'
import cl from 'clsx'
import { Link } from 'react-router-dom'
import styles from './styles/home.module.css'
import type { HomeScreenProps } from './types/home-screen-props.type'

/**
 * Отображает стартовый экран демонстрационного приложения.
 *
 * Используется для:
 *  - проверки общего оформления приложения
 *  - перехода к защищённому кабинету пользователя
 */
export const HomeScreen = (props: HomeScreenProps) => {
  const { className, ...rootAttrs } = props

  return (
    <section {...rootAttrs} className={cl(styles.root, className)}>
      <Container size="lg">
        <Stack className={styles.hero} gap="xl">
          <Badge color="indigo" size="lg" variant="light">
            Каркас готов
          </Badge>
          <Title className={styles.title} order={1}>
            Рабочий пример React Reference
          </Title>
          <Text className={styles.lead} c="dimmed" size="xl">
            Здесь правила документации будут превращаться в небольшие законченные пользовательские сценарии.
          </Text>
        </Stack>

        <SimpleGrid className={styles.grid} cols={{ base: 1, md: 3 }} spacing="lg">
          <Paper className={styles.card} p="xl" radius="lg" withBorder>
            <Text c="indigo" fw={700} size="sm">
              01
            </Text>
            <Title order={2} size="h3">
              OpenAPI и REST
            </Title>
            <Text c="dimmed">Клиент серверного API создаётся из общей схемы и использует один HttpClient с JWT-политикой.</Text>
          </Paper>
          <Paper className={styles.card} p="xl" radius="lg" withBorder>
            <Text c="indigo" fw={700} size="sm">
              02
            </Text>
            <Title order={2} size="h3">
              Защита маршрута
            </Title>
            <Text c="dimmed">Защищённая ветка ожидает сессию, сохраняет адрес и перенаправляет гостя на вход.</Text>
            <Button component={Link} to="/account" variant="light">
              Открыть кабинет
            </Button>
          </Paper>
          <Paper className={styles.card} p="xl" radius="lg" withBorder>
            <Text c="indigo" fw={700} size="sm">
              03
            </Text>
            <Title order={2} size="h3">
              Домены и SWR
            </Title>
            <Text c="dimmed">Домен авторизации владеет сессией, а домен пользователя загружает приватный профиль.</Text>
            <Button component={Link} color="gray" to="/sign-in" variant="light">
              Перейти ко входу
            </Button>
          </Paper>
        </SimpleGrid>
      </Container>
    </section>
  )
}
