import { useState } from 'react'
import { Alert, Button, Center, Container, Loader, Paper, PasswordInput, Stack, Text, TextInput, Title } from '@mantine/core'
import { isEmail, isNotEmpty, useForm } from '@mantine/form'
import cl from 'clsx'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import {
  AUTHENTICATION_ERROR_CODE,
  isSignInError,
  useAuthenticationActions,
  useAuthenticationStatus,
  useGetCurrentSession
} from 'domains/authentication'
import { getSignInReturnTo } from './helpers/get-sign-in-return-to'
import styles from './styles/sign-in.module.css'
import type { SignInFormValues } from './types/sign-in-form-values.type'
import type { SignInScreenProps } from './types/sign-in-screen-props.type'

/**
 * Отображает экран входа и завершает сценарий переходом.
 *
 * Используется для:
 *  - создания авторизованной сессии
 *  - возврата пользователя к исходному защищённому адресу
 */
export const SignInScreen = (props: SignInScreenProps) => {
  const { className, ...rootAttrs } = props
  const [submitError, setSubmitError] = useState<string | null>(null)
  const authenticationActions = useAuthenticationActions()
  const currentSession = useGetCurrentSession()
  const authenticationStatus = useAuthenticationStatus()
  const location = useLocation()
  const navigate = useNavigate()
  const returnTo = getSignInReturnTo(location.state)
  const form = useForm<SignInFormValues>({
    mode: 'uncontrolled',
    validateInputOnBlur: true,
    initialValues: {
      login: 'demo@example.com',
      password: 'demo-password'
    },
    onValuesChange: () => setSubmitError(null),
    validate: {
      login: isEmail('Введите корректный адрес почты'),
      password: isNotEmpty('Введите пароль')
    }
  })

  /**
   * Повторяет проверку текущей сессии.
   */
  const handleRetry = (): void => {
    void currentSession.mutate()
  }

  /**
   * Переводит фокус на первое поле с ошибкой.
   */
  const handleValidationError = (errors: typeof form.errors): void => {
    const firstErrorPath = Object.keys(errors)[0]

    if (firstErrorPath !== undefined) {
      form.getInputNode(firstErrorPath)?.focus()
    }
  }

  /**
   * Выполняет вход и возвращает пользователя к исходному адресу.
   */
  const handleSubmit = async (values: SignInFormValues): Promise<void> => {
    setSubmitError(null)

    try {
      await authenticationActions.signIn({
        login: values.login.trim(),
        password: values.password
      })
      void navigate(returnTo, { replace: true })
    } catch (error) {
      if (isSignInError(error)) {
        if (error.details.code === AUTHENTICATION_ERROR_CODE.INVALID_CREDENTIALS) {
          setSubmitError('Почта или пароль указаны неверно.')
          return
        }

        if (error.details.code === AUTHENTICATION_ERROR_CODE.TEMPORARILY_UNAVAILABLE) {
          setSubmitError('Сервис авторизации временно недоступен. Попробуйте ещё раз.')
          return
        }
      }

      setSubmitError('Не удалось выполнить вход. Попробуйте ещё раз.')
    }
  }

  if (currentSession.error !== undefined) {
    return (
      <section {...rootAttrs} className={cl(styles.root, className)}>
        <Container size="sm">
          <Alert color="red" title="Не удалось проверить авторизацию">
            <Stack gap="md">
              <Text>Сервис временно недоступен. Повторите проверку.</Text>
              <Button onClick={handleRetry} variant="light">
                Повторить
              </Button>
            </Stack>
          </Alert>
        </Container>
      </section>
    )
  }

  if (authenticationStatus === 'unknown') {
    return (
      <Center className={cl(styles.root, className)} component="section">
        <Loader color="indigo" />
      </Center>
    )
  }

  if (authenticationStatus === 'authenticated') {
    return <Navigate replace to={returnTo} />
  }

  return (
    <section {...rootAttrs} className={cl(styles.root, className)}>
      <Container size="sm">
        <Paper className={styles.card} p={{ base: 'lg', sm: 'xl' }} radius="lg" withBorder>
          <Stack gap="lg">
            <Stack gap="xs">
              <Text c="indigo" fw={700} size="sm">
                Защищённый маршрут
              </Text>
              <Title order={1}>Вход в кабинет</Title>
              <Text c="dimmed">
                Данные демо-пользователя уже заполнены. Маршрутная граница вернёт вас к запрошенному адресу.
              </Text>
            </Stack>

            <form noValidate onSubmit={form.onSubmit(handleSubmit, handleValidationError)}>
              <fieldset className={styles.fieldset} disabled={form.submitting}>
                <Stack gap="md">
                  <TextInput
                    key={form.key('login')}
                    autoComplete="email"
                    label="Почта"
                    required
                    type="email"
                    {...form.getInputProps('login')}
                  />
                  <PasswordInput
                    key={form.key('password')}
                    autoComplete="current-password"
                    label="Пароль"
                    required
                    {...form.getInputProps('password')}
                  />
                  {submitError !== null && (
                    <Alert color="red" role="alert">
                      {submitError}
                    </Alert>
                  )}
                  <Button loading={form.submitting} type="submit">
                    Войти
                  </Button>
                </Stack>
              </fieldset>
            </form>
          </Stack>
        </Paper>
      </Container>
    </section>
  )
}
