# Использование API-клиента

Импортируй API-клиент и вызывай его методы:

```ts
import { petStoreApi } from 'infra/pet-store-api'

const pet = await petStoreApi.pets.getPet({ id: '42' })
```

## Настройка запроса

Если параметры нужны только этому запросу, передай их вторым аргументом:

```ts
const pet = await petStoreApi.pets.getPet(
  { id: '42' },
  {
    headers: {
      'X-Request-ID': requestId,
    },
    timeout: 5_000,
  },
)
```

Если параметры должны применяться ко всем запросам, добавь их в настройки [`HttpClient`](transport.md).

## Отмена запроса

В этом примере при переключении между питомцами предыдущая незавершённая загрузка отменяется перед началом новой:

```ts
let activeRequest: AbortController | undefined

async function loadPet(id: string) {
  activeRequest?.abort()

  const controller = new AbortController()
  activeRequest = controller

  try {
    return await petStoreApi.pets.getPet(
      { id },
      { signal: controller.signal },
    )
  } finally {
    if (activeRequest === controller) {
      activeRequest = undefined
    }
  }
}
```

Каждый вызов `loadPet` отменяет предыдущую незавершённую загрузку. Отменённый запрос завершится отклонением Promise.

## Вызов отдельной операции

Если нужен только один запрос, операцию можно вызвать напрямую. В этом случае передай ей `httpClient` первым
аргументом:

```ts
import {
  getPet,
  httpClient,
} from 'infra/pet-store-api'

const pet = await getPet(httpClient, { id: '42' })
```
