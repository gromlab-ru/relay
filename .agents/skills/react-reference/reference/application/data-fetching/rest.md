# REST data fetching

REST является базовым протоколом обмена между browser-only React SPA и сервером. Технические operations, configured `HttpClient` и API client создаются через [`@gromlab/rest-api-codegen`](../../libraries/rest-api-codegen/README.md). Предметный REST-вызов всегда закрывается публичным API домена.

## Сквозной поток

```text
React consumer
→ public domain hook или adapter
→ domain adapter
→ infra API client или standalone operation
→ configured HttpClient
→ REST API
```

Границы domain contract, mapping и ошибок определены в
[`architecture/units/domains`](../architecture/units/domains/README.md). Этот документ определяет, какой публичный API
использовать для конкретного вида запроса.

## 1. Подготовь infra API-модуль

Сначала найди существующий модуль `src/infra/<name>-api`. Один внешний API использует один configured transport. Не создавай `HttpClient`, API client или `fetch` wrapper рядом с domain adapter или React hook.

Infra-фасет может предоставить полный API client:

```ts
import { petStoreApi } from 'infra/pet-store-api'

const petDto = await petStoreApi.pets.getPet({ id })
```

Либо standalone operation с тем же configured transport:

```ts
import {
  getPet,
  petStoreHttpClient,
} from 'infra/pet-store-api'

const petDto = await getPet(petStoreHttpClient, { id })
```

Второй вариант допустим для lazy-модуля, который не должен включать всё дерево API client в свой чанк. Operation и `HttpClient` импортируются из фасета одного API-модуля; transport не создаётся и не настраивается в consumer.

Если демонстрационное приложение должно запускаться без внешнего сервера, сохрани тот же HTTP-контракт и перехватывай
запросы отдельным инфраструктурным юнитом MSW. Не подменяй доменный адаптер или API-клиент тестовой реализацией. Порядок
размещения, запуска и проверки описан в [`Автономной имитации API`](api-mocking.md).

## 2. Создай domain contract

До вызова source operation определи domain input, result и известные errors. Не используй DTO как публичный тип домена, даже когда поля временно совпадают.

```ts
export type Pet = Readonly<{
  id: string
  name: string
}>

export type UpdatePetInput = Readonly<{
  id: string
  name: string
}>
```

Точные правила находятся в [`domains/contracts.md`](../architecture/units/domains/contracts.md) и
[`domains/errors.md`](../architecture/units/domains/errors.md).

## 3. Создай и опубликуй adapter

Адаптер преобразует предметные входные данные в запрос источника, вызывает готовую инфраструктурную возможность,
преобразует DTO ответа в предметный результат и полностью классифицирует ошибки источника. Для GET-адаптера, который
служит загрузчиком SWR, каждый неуспешный исход должен стать одной из ошибок его публичного предметного контракта.

```ts
export const getPet = async (petId: string): Promise<Pet> => {
  try {
    const petDto = await getPetOperation(petStoreHttpClient, { id: petId })

    return mapPetDto(petDto)
  } catch (error) {
    if (isPetNotFoundSourceError(error)) {
      throw createPetNotFoundError(petId)
    }

    throw createPetTemporarilyUnavailableError()
  }
}
```

Такой GET-адаптер не оставляет SWR неизвестное значение, которое нарушило бы тип `SWRResponse<Pet,
GetPetError>`. Включи запасной код вроде `TEMPORARILY_UNAVAILABLE` в тип ошибки конкретной GET-операции и используй его
для сетевого сбоя, неизвестного ответа или другого нераспознанного исключения. Не добавляй общий код `UNEXPECTED` и не
передавай исходную ошибку через SWR.

Это правило относится к GET-адаптерам, которые являются загрузчиками типизированного SWR-хука. Для изменяющих и
императивных операций неизвестный сбой по-прежнему преобразуется в `ApplicationDefect` и обрабатывается по
[`failure-handling`](../quality/failure-handling.md).

Фасет домена публикует adapter без бессмысленного wrapper:

```ts
export { getPet } from './adapters/get-pet.adapter'
export { updatePet } from './adapters/update-pet.adapter'
```

## GET для React render

Если GET-response является server state и участвует в render, домен публикует SWR hook поверх своего GET adapter:

```ts
export const useGetPet = (petId: string | null): UseGetPetResponse => {
  const key = getPetKey(petId)

  return useSWR(key, ([, currentPetId]) => getPet(currentPetId))
}
```

Тип ответа хука является стандартным `SWRResponse<Pet, GetPetError>`. Не переименовывай и не удаляй его поля, не
создавай отдельное поле `defect`. Потребитель проверяет ожидаемую ошибку в `error`, а для повторного запроса и обновления
кеша использует стандартный `mutate`.

Рабочие примеры этого контракта находятся в `demo-app`: публичная сессия
[`useGetCurrentSession`](../../../demo-app/src/domains/authentication/hooks/use-get-current-session/use-get-current-session.hook.ts)
и приватный профиль
[`useGetCurrentUser`](../../../demo-app/src/domains/user/hooks/use-get-current-user/use-get-current-user.hook.ts).

React consumer использует hook из фасета домена:

```ts
import { useGetPet } from 'domains/pets'

const pet = useGetPet(petId)
```

Не выполняй GET server state для render напрямую из component, event handler или `useEffect`. Правила keys, auth scope и revalidation находятся в [`SWR GET`](../../libraries/swr/get-data.md).

## Императивный GET

Публичный GET adapter остаётся доступен для результата, который не является server state текущего render:

- download или export;
- проверка перед одноразовым действием;
- выполнение вне React lifecycle;
- сценарий, которому не нужны shared cache и automatic revalidation.

```ts
import { exportPets } from 'domains/pets'

const file = await exportPets(filter)
```

Не помещай binary response и одноразовый side effect в SWR cache только потому, что endpoint использует HTTP `GET`.

## Mutations

`POST`, `PUT`, `PATCH` и `DELETE` выполняются через публичные domain adapters:

```ts
import { updatePet } from 'domains/pets'

await updatePet({
  id: petId,
  name,
})
```

Mutation adapter не использует `useSWRMutation`, не знает о mounted consumers и не изменяет SWR cache. Он отвечает только за domain input/result/errors и обращение к source operation.

## Синхронизация после mutation

После успешной mutation явный domain lifecycle owner синхронизирует затронутые GET keys. Это может быть domain action hook, hook формы или владелец другого сценария, который уже управляет вызовом adapter.

Предпочитай revalidation, когда mutation response не гарантирует полный канонический GET result:

```ts
await updatePet(input)
await mutate(getPetKey(input.id))
```

Ручной cache update применяй только при определённом optimistic state, rollback, связанных detail/list keys и защите от races. Не скрывай global cache side effect внутри adapter: одна и та же операция должна безопасно работать вне React и в нескольких cache scopes.

## Auth и transport policy

URL, credentials, headers, timeout, retry и общая нормализация transport errors принадлежат configured `HttpClient`. Domain adapter передаёт только параметры операции и не читает token самостоятельно.

Стабильная identity может участвовать в private SWR key, но access token, refresh token и cookie в cache key не помещаются. Auth/session owner отключает и очищает private cache при logout или account switch.

Если access token хранится в `localStorage`, технический владелец применяет следующие правила:

- token рассматривается как непрозрачная строка;
- token читается перед каждым защищённым запросом;
- token не попадает в URL, ключ кеша, телеметрию и диагностические сообщения;
- повреждённое или отклонённое API значение удаляется;
- при terminal Bearer `401`, оставшемся после настроенной refresh/retry policy, domain adapter сравнивает отклонённый
  Bearer с текущим credential и вызывает публичное действие auth-домена только для текущей сессии;
- защита от XSS обязательна, потому что выполняемый на странице JavaScript имеет доступ к `localStorage`.

## Проверка

- Consumer предметных данных импортирует hook или adapter из фасета домена.
- Domain contract не содержит DTO и source errors.
- Adapter использует готовый API client либо standalone operation с configured transport.
- GET-адаптер для SWR преобразует каждый неуспешный исход в ошибку своего публичного контракта.
- GET для render выполняется через public domain SWR hook.
- SWR-хук возвращает стандартный `SWRResponse`; потребитель использует `error` и `mutate`.
- Imperative GET и mutation выполняются через public domain adapter.
- Mutation adapter не зависит от SWR.
- Cache synchronization имеет явного lifecycle owner.
- Hook и adapter не создают transport и не дублируют auth/error policy.
- Transport не интерпретирует terminal `401` как потерю сессии без контекста конкретной операции.
