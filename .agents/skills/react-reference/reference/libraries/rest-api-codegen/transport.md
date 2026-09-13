# HTTP transport

Сначала найди существующий transport или SDK и переиспользуй его. Путь файла, base URL, auth и error policy определяй
по runtime и соглашениям текущего проекта.

Создай один transport для API и храни в нём общие настройки HTTP. Если приложение использует один полный API-клиент и
одну политику транспорта, создавай `HttpClient` и результат `createApiClient` в одном файле `<name>-api.ts`. Выноси
transport в отдельный файл, только если его разделяют несколько клиентов или для одного API нужны разные политики сред
выполнения.

Для generated-клиента и его `overrides` импортируй `HttpClient` из `generated`:

```ts
import { HttpClient } from './generated'

export const httpClient = new HttpClient({
  baseUrl: 'https://api.example.com',
  timeout: 10_000,
  headers: {
    Accept: 'application/json'
  }
})
```

Для полностью ручного клиента в `extensions` импортируй `HttpClient` из `@gromlab/rest-api-codegen`. Operations и
transport должны использовать совместимые контракты. Все operations одного API используют один transport.

## Возможности

Конфигурация `HttpClient` задаёт общую policy запросов:

- `baseUrl`, headers, credentials и timeout;
- `onRequest` для auth и изменения запроса перед отправкой;
- `onResponse` для обработки успешного ответа;
- `onError` для нормализации ошибок, fallback или ограниченного retry;
- `customFetch`, query serializer и response parser, если стандартного поведения недостаточно.

Hooks получают request или response context и могут вернуть изменённое значение. Например, актуальный token можно
добавлять перед каждым защищённым запросом:

```ts
const httpClient = new HttpClient({
  baseUrl: 'https://api.example.com',
  onRequest(request) {
    if (request.secure !== true) {
      return request
    }

    const accessToken = getAccessToken()
    if (accessToken === null) {
      return request
    }

    const headers = new Headers(request.headers)
    if (!headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${accessToken}`)
    }

    return {
      ...request,
      headers
    }
  }
})
```

Конкретная auth, error и retry policy зависит от API и runtime. Её точную реализацию бери из skill
`rest-api-codegen-ru`. Если skill недоступен, используй документацию
[`gromlab-ru/rest-api-codegen`](https://github.com/gromlab-ru/rest-api-codegen).

## Защищённый 401

Не изменяй состояние авторизации глобально в `onError`: transport не знает, какая схема аутентификации использована и
что означает `401` для конкретной операции. Он повторно выбрасывает source error, сохраняя контракт операции.

Потерю Bearer-сессии обрабатывает вызывающий domain adapter. Если защищённая операция после настроенной transport-level
refresh/retry policy вернула terminal `401`, adapter вызывает публичное действие auth-домена, которое синхронно удаляет
credential и закрывает auth boundary. Операции входа, регистрации, refresh и альтернативные схемы аутентификации
сохраняют собственную обработку `401`.

Если `onError` выполняет refresh, при окончательном отказе повторно выброси исходный `ApiError(401)` либо другой стабильный
terminal-auth error с информацией об отклонённом credential. Не заменяй его обычным `Error`: domain adapter должен
отличить потерю сессии от временного сбоя и не завершить новую сессию из-за позднего ответа старого запроса.

HTTP-транспорт не импортирует auth store, SWR, router и доменные session keys. Очистку сессии и приватного SWR-кеша
выполняет владелец жизненного цикла авторизации.

Transport без auth side effects показан в
[`demo-app/src/infra/backend-api/backend-api.ts`](../../../demo-app/src/infra/backend-api/backend-api.ts).

В workspace или npm SDK экспортируй `HttpClient`, но не создавай configured singleton с URL и credentials. Каждый
consumer настраивает transport для своего runtime. Организация SDK описана в [`sdk.md`](sdk.md).
