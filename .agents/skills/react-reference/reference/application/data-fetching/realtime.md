# Realtime в React

Этот документ определяет подключение realtime к React lifecycle в дополнение к основному маршруту [`data fetching`](README.md). Технический контракт keys, subscribe callback, cleanup, sync payload, auth scope и reconnect применяй по [`libraries/swr/subscriptions.md`](../../libraries/swr/subscriptions.md).

## Разделение ответственности

Realtime integration разделяется между тремя владельцами:

| Ответственность | Владелец |
| --- | --- |
| Connection, credentials, protocol, reconnect и raw events | Infra-юнит transport или SDK |
| Преобразование предметного payload и source errors в domain contract | Доменный юнит |
| Место подключения и длительность subscription в React tree | Unit owner lifecycle |

Transport публикует только техническую возможность через публичный фасет infra-юнита. Domain adapter подписывается на неё, преобразует payload и ошибки, а публичный фасет домена предоставляет React hook, operation или event contract внешним consumers. Raw event types и transport errors не пересекают границу домена.

Такое разделение изолирует protocol от предметной модели, а явный lifecycle owner не позволяет случайному component управлять долгоживущим соединением.

## Почему `useSWRSubscription`

Используй `useSWRSubscription` для latest-value integration: одинаковый key разделяет subscription между consumers, а disposer вызывается после unmount последнего consumer. Это устраняет ручные listeners в каждом component, но не делает SWR владельцем connection или авторитетным источником данных API.

| Потребность | React integration |
| --- | --- |
| UI показывает последний transient snapshot | Consumer читает `data` из специализированного domain subscription hook |
| Realtime обновляет восстановимое REST-состояние | Lifecycle owner синхронизирует SWR GET-cache |
| Realtime нужен всему subtree юнита | Именованный owner component или Provider монтирует sync lifecycle |
| Realtime нужен только видимому consumer | Этот consumer монтирует subscription hook |
| Нужно отправить предметную command | Action вызывает публичный adapter домена |
| Нужен ordered processing, replay или queue | Используется специализированный mechanism вместо latest-value subscription |

## Latest snapshot

Используй subscription data напрямую, если UI нужен последний transient snapshot, который не требуется восстанавливать через REST:

```text
infra transport
→ internal domain adapter
→ domain useSWRSubscription hook
→ публичный фасет домена
→ React consumer
```

Подход подходит для presence, live progress и аналогичных значений. Не копируй latest value в React state или Zustand только ради нескольких consumers: одинаковый subscription key уже предоставляет shared projection. Общие правила выбора хранилища находятся в [`State management`](../state-management/README.md).

Если обязательна обработка каждого события, latest-value semantics не подходит. Используй queue, reducer или event store по критериям [`libraries/swr/subscriptions.md#когда-swr-не-подходит`](../../libraries/swr/subscriptions.md#когда-swr-не-подходит).

## GET bootstrap и realtime sync

Для восстановимого server state авторитетным источником остаётся API, а SWR GET-cache является его клиентской проекцией:

```text
REST GET → SWR GET-cache → React consumers
domain realtime event → sync → тот же SWR GET-cache
```

Public domain GET hook предоставляет данные до первого события и восстанавливает проекцию после disconnect. Lifecycle owner применяет snapshot, delta или invalidation по domain contract и защищает cache от stale updates. Стратегии определены в [`libraries/swr/subscriptions.md#стратегии-sync`](../../libraries/swr/subscriptions.md#стратегии-sync).

## Lifecycle owner

Unit owner определяет область жизни realtime integration:

- visible consumer монтирует hook, если данные нужны только ему;
- sync для subtree монтирует именованный owner component или Provider на границе юнита;
- session-wide sync принадлежит session unit owner, а не случайному screen;
- always-on sync не скрывается внутри визуального component, исчезающего при навигации.

Owner component может не рендерить DOM. Его назначение и область жизни должны быть понятны из имени и места подключения. Наличие hook или Provider само по себе не создаёт новый юнит.

Если для управления подпиской нужен новый `.tsx` с компонентом или `Provider`, создай его через `npx @gromlab/create`
по [`правилам создания TSX`](../components/tsx-generation.md), даже если он не выводит DOM.

При смене identity lifecycle owner отключает private subscription keys, обновляет transport context и затем активирует keys новой identity. Shared connection, commands, auth и reconnect остаются в infra transport.

## Границы

- React hook получает готовый transport через публичный фасет infra-юнита и не создаёт shared connection.
- Предметный payload всегда адаптируется внутри домена до публикации внешним consumers.
- Внешний consumer не импортирует transport, SDK, raw event type или source error для предметных данных.
- Server state не подменяется отдельным client store.
- Always-on subscription не зависит от случайного screen lifecycle.
- Для ordered events не используется latest-value cache.

## Проверка

- Transport принадлежит infra unit owner.
- Payload и source errors адаптированы доменным юнитом.
- Subscription lifecycle имеет явного unit owner.
- Внешний доступ проходит через соответствующий публичный фасет.
- Выбран latest snapshot или sync существующего SWR GET-cache.
- Cleanup, reconnect и stale update policy соответствуют `libraries/swr/subscriptions.md`.
