# Subscriptions и realtime

Используй `useSWRSubscription` в browser-only React SPA на Vite для входящего realtime-потока, когда React consumer нужен последний актуальный snapshot данных или событие должно синхронизировать канонический GET-cache.

`useSWRSubscription` доступен начиная с SWR 2.1. Перед применением проверь фактическую версию package и сигнатуры API по
официальной [документации SWR](https://swr.vercel.app/docs/subscription).

## Преимущества

- realtime updates приходят без polling;
- одинаковый key создаёт одну subscription в пределах SWR cache provider;
- несколько consumers получают общее последнее `data` и `error`;
- disposer вызывается после unmount последнего consumer;
- conditional `null` key не создаёт listener до появления обязательного контекста;
- subscription можно связать с GET-cache через snapshot, delta или invalidation.

Subscription хранит последнее значение, а не очередь событий. Используй её только когда потеря промежуточных событий
не нарушает сценарий либо события атомарно сворачиваются в состояние.

## Базовый hook

В `demo-app` пока нет реализации подписок. Следующий встроенный пример является нормативным шаблоном, а не ссылкой на
проверяемый сценарий демо. Перед применением сверь его с API установленной версии SWR и фактическим сокет-транспортом
проекта.

Key идентифицирует класс события, ресурс и стабильную auth identity:

```ts
export type OrderSubscriptionKey = readonly [
  'orders/order-updated',
  string,
  string
]
```

```ts
export const getOrderSubscriptionKey = (
  userId: string | null,
  orderId: string | null
): OrderSubscriptionKey | null => {
  if (userId === null || orderId === null) {
    return null
  }

  return ['orders/order-updated', userId, orderId]
}
```

Для user-dependent событий stable auth identity обязательна: она не позволяет новому пользователю переиспользовать
subscription state предыдущего. Не помещай raw access token в key. Credential принадлежит transport, а key использует
стабильный `userId`, `sessionId` или `tenantId`.

Subscribe callback подключает exact handler и обязательно возвращает disposer:

```ts
export const useOrderSubscription = (
  orderId: string | null
): SWRSubscriptionResponse<Order, OrderSubscriptionError> => {
  const user = useGetUser()
  const userId = user.data?.userId ?? null
  const key = getOrderSubscriptionKey(userId, orderId)
  const subscribe = ([, , currentOrderId]: OrderSubscriptionKey, { next }: OrderSubscriptionOptions) => {
    const subscription = subscribeToOrderUpdates(currentOrderId, {
      onData: (order) => next(null, order),
      onError: (error) => next(error)
    })

    return () => subscription.close()
  }

  return useSWRSubscription(key, subscribe)
}
```

Domain subscription adapter скрывает mapper, source errors и технический transport. Внутри него удаляй тот же handler, который был передан transport. Не используй broad `off(event)` и не отключай shared connection при unmount одного hook.

## Semantics SWR

- Несколько mounted hooks с одинаковым key используют одну subscription.
- SWR считает consumers и вызывает disposer после unmount последнего.
- После полного cleanup повторный mount создаёт новую subscription.
- `next(error)` сохраняет последнее data и устанавливает error.
- Следующий `next(null, data)` обновляет data и очищает error.
- Subscription state внутренне имеет отдельный namespace и не конфликтует с обычным `useSWR` того же key.

Последний пункт означает, что socket event не обновляет GET-cache автоматически. Для этого нужен явный sync.

## Два способа использования

### Самостоятельное latest value

Component читает `data` непосредственно из `useSWRSubscription`. Подходит для transient значений:

- connection status;
- текущий уровень или индикатор активности;
- live progress;
- другой snapshot, который не требуется восстанавливать через REST.

Промежуточные события не должны иметь самостоятельного смысла. Если важен порядок каждого события, используй queue,
event reducer или другое средство вместо latest-value subscription.

### GET bootstrap и realtime sync

Для восстановимого server state используй public domain GET hook как канонический REST bootstrap:

```text
GET query → canonical SWR cache
subscription → realtime event
sync → canonical SWR cache
```

Так UI получает данные до первого socket event, а после временного disconnect может восстановить состояние повторным
GET. Query, subscription и sync являются разными ролями и тестируются независимо.

Sync lifecycle должен иметь явного владельца. Если синхронизация нужна всему приложению или модулю, монтируй её в
именованном Provider/owner boundary, а не скрывай внутри случайного экрана.

## Стратегии sync

Выбирай стратегию по семантике socket payload.

### Snapshot

Событие содержит полный канонический snapshot и заменяет cache:

```ts
await mutate(snapshot, { revalidate: false })
```

Проверяй revision или timestamp, если snapshot может прийти не по порядку. Полная замена не должна стирать отдельный
transient overlay, которого нет в server snapshot.

### Delta

Событие содержит изменение части состояния. Применяй pure reducer через functional mutate:

```ts
await mutate(
  (current) => current ? applyOrderDelta(current, event) : current,
  { revalidate: false }
)
```

Не строй новое значение из `data`, захваченного render closure: параллельные события могут перезаписать изменения друг
друга. Mapper/reducer валидирует payload и тестируется отдельно.

### Invalidation

Событие сообщает только о возможном изменении либо payload недостаточно надёжен. Запусти повторный GET:

```ts
await mutate()
```

Invalidation дороже локального patch, но возвращает каноническое состояние и проще сохраняет корректность.

## Socket transport

SWR управляет subscription state и listener lifecycle, но не владеет connection. Технический socket transport является
юнитом `infra`: его shared socket manager или SDK
отвечает за:

- создание и разделение connection;
- auth credentials и пересоздание connection при смене identity;
- reconnect/backoff и heartbeat;
- transport-level errors;
- окончательный disconnect при завершении session;
- resubscribe semantics конкретного protocol.

Subscription hook:

- получает готовый transport;
- регистрирует listener конкретного события;
- передаёт data/error через `next`;
- удаляет exact listener в disposer;
- не закрывает shared connection.

Не создавай новый socket instance из каждого hook. Во время initial connect и reconnect manager должен возвращать
существующий instance, а не создавать параллельные connections. При смене auth identity старое connection закрывается
и создаётся заново с актуальными credentials.

При logout или account switch сначала отключи subscription hooks через `null` user/session identity, затем пересоздай
transport и активируй keys нового `userId`. JWT refresh не должен менять subscription keys, если identity пользователя и
представление данных остались прежними.

Предметную outbound command выполняй через public domain adapter/action. `useSWRSubscription` предназначен для входящих updates, а не для отправки commands.

## Reconnect reconciliation

Socket reconnect не гарантирует доставку событий, пропущенных во время disconnect. После успешного reconnect:

1. Revalidate канонические GET keys или запроси snapshot/revision у protocol.
2. Только после reconciliation продолжай применять delta stream.
3. Не полагайся на `revalidateOnReconnect`: он реагирует на browser online state, а не на reconnect socket library.

Если backend поддерживает sequence/revision, отклоняй устаревшие события и запрашивай пропущенный диапазон либо новый
snapshot.

## High-frequency и ordered events

`useSWRSubscription.data` содержит последнее принятое значение. Несколько событий могут схлопнуться до выполнения
React effect. Поэтому:

- latest status можно передавать через обычный `next`;
- накопительное значение обновляй через updater form `next(null, current => reduce(current, event))`;
- canonical GET-cache патчь functional `mutate`;
- для обязательной обработки каждого события используй queue или специализированный event store;
- backpressure, replay, offline log и сложный multiplexing не скрывай внутри SWR hook.

## Payload и errors

Socket payload является внешними runtime-данными. До записи в доменный cache проверь обязательные IDs, discriminants,
enum values, числовые диапазоны и revision. Невалидное событие направляй в error/telemetry channel и не применяй.

Transport error передавай через `next(error)` либо отдельный connection-state hook. Не ограничивай обработку
`console.error`, если UI должен показывать disconnected/reconnecting state.

Если payload и errors принадлежат доменному сценарию, subscription hook находится внутри доменного юнита. Внутренние
adapter и mapper преобразуют source payload в domain model, известные source errors — в operation-specific domain errors,
а unknown failure — в defect согласно правилам проекта. Внешний consumer получает hook только через client-compatible
public facet доменного юнита и не импортирует socket client или source event types.

## Когда SWR не подходит

Выбери специализированный transport/state mechanism, если нужны:

- commands и acknowledgements как единый state machine;
- обязательная обработка каждого события;
- backpressure, batching или windowing;
- replay, event log, offline queue или persistence;
- сложный multiplexing;
- connection lifecycle, независимый от mounted React consumers;
- SDK, который уже полностью управляет state, reconnect и subscriptions.

## Проверка

- Key стабилен и не содержит raw credential.
- User-dependent key содержит стабильный auth scope.
- Subscribe callback всегда возвращает disposer.
- Cleanup удаляет exact listener и не закрывает shared socket.
- Latest-value semantics соответствует сценарию.
- Delta применяется functional updater, а не stale render data.
- Reconnect завершается reconciliation с каноническим state.
- Payload валидируется до изменения domain cache.
- Domain-owned payload и errors не пересекают public boundary в source form.
- Always-on sync имеет явного владельца lifecycle.
