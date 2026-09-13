import { useState } from 'react'
import { Alert, Avatar, Button, Center, Container, Loader, Paper, Stack, Text, Title } from '@mantine/core'
import cl from 'clsx'
import { useAuthenticationActions } from 'domains/authentication'
import { useGetCurrentUser } from 'domains/user'
import { AppIcon } from 'infra/app-icons'
import styles from './styles/account.module.css'
import type { AccountScreenProps } from './types/account-screen-props.type'

/**
 * Отображает защищённый кабинет текущего пользователя.
 *
 * Используется для:
 *  - чтения профиля из приватной области SWR-кеша
 *  - завершения авторизованной сессии
 */
export const AccountScreen = (props: AccountScreenProps) => {
  const { className, ...rootAttrs } = props
  const [signOutError, setSignOutError] = useState<string | null>(null)
  const [isSigningOut, setIsSigningOut] = useState(false)
  const authenticationActions = useAuthenticationActions()
  const currentUser = useGetCurrentUser()

  /**
   * Повторно получает профиль пользователя.
   */
  const handleRetry = (): void => {
    void currentUser.mutate()
  }

  /**
   * Завершает сессию; маршрутная граница выполняет перенаправление.
   */
  const handleSignOut = async (): Promise<void> => {
    setIsSigningOut(true)
    setSignOutError(null)

    try {
      await authenticationActions.signOut()
    } catch {
      setSignOutError('Не удалось корректно завершить сессию. Локальные данные входа удалены.')
    } finally {
      setIsSigningOut(false)
    }
  }

  if (currentUser.error !== undefined) {
    return (
      <Container className={cl(styles.root, className)} component="section" size="sm">
        <Alert color="red" title="Профиль временно недоступен">
          <Stack gap="md">
            <Text>Повторите запрос данных кабинета.</Text>
            <Button onClick={handleRetry} variant="light">
              Повторить
            </Button>
          </Stack>
        </Alert>
      </Container>
    )
  }

  if (currentUser.isLoading || currentUser.data === undefined) {
    return (
      <Center className={cl(styles.root, className)} component="section">
        <Loader color="indigo" />
      </Center>
    )
  }

  return (
    <section {...rootAttrs} className={cl(styles.root, className)}>
      <Container size="md">
        <Stack gap="xl">
          <Stack gap="xs">
            <Text c="indigo" fw={700} size="sm">
              /account
            </Text>
            <Title order={1}>Кабинет пользователя</Title>
            <Text c="dimmed">Профиль загружен отдельным доменом после успешной проверки сессии.</Text>
          </Stack>

          <Paper className={styles.card} p="xl" radius="lg" withBorder>
            <Stack gap="xl">
              <Avatar color="indigo" name={currentUser.data.displayName} size="xl" />
              <div className={styles.profile}>
                <Text c="dimmed">Имя</Text>
                <Text fw={600}>{currentUser.data.displayName}</Text>
                <Text c="dimmed">Почта</Text>
                <Text fw={600}>{currentUser.data.email}</Text>
                <Text c="dimmed">ID</Text>
                <Text fw={600}>{currentUser.data.id}</Text>
              </div>
              {signOutError !== null && (
                <Alert color="red" role="alert">
                  {signOutError}
                </Alert>
              )}
              <Button
                color="red"
                leftSection={<AppIcon aria-hidden="true" height={18} icon="sign-out" width={18} />}
                loading={isSigningOut}
                onClick={handleSignOut}
                variant="light"
              >
                Выйти
              </Button>
            </Stack>
          </Paper>
        </Stack>
      </Container>
    </section>
  )
}
