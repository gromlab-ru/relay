# SWR

Используй `swr` в browser-only React SPA на Vite для двух задач:

1. Получение и client cache REST GET-data через публичный domain hook.
2. Получение realtime updates через публичный domain subscription hook.

Архитектурный маршрут, domain contract и выбор между hook и adapter определены в основной инструкции [`Data fetching в React`](../../application/data-fetching/README.md). Этот раздел описывает только SWR keys, cache, request lifecycle, revalidation и subscriptions.

## Место SWR

```text
React consumer
→ public domain SWR hook
→ domain GET adapter
→ infra REST operation / API client
→ configured HttpClient
→ REST API
```

SWR не создаёт HTTP transport, API client и REST operations. Их предоставляет infra API-модуль, подготовленный по [`@gromlab/rest-api-codegen`](../rest-api-codegen/README.md). Domain adapter выполняет mapping и разрешает source errors до передачи результата в SWR cache.

## Выбор подхода

| Задача | Решение | Референс |
| --- | --- | --- |
| Получить REST server state для render | Public domain hook на `useSWR` | [`get-data.md`](get-data.md) |
| Выполнить imperative GET | Public domain GET adapter без SWR | [`REST data fetching`](../../application/data-fetching/rest.md#императивный-get) |
| Выполнить `POST`, `PUT`, `PATCH`, `DELETE` | Public domain mutation adapter без SWR | [`REST data fetching`](../../application/data-fetching/rest.md#mutations) |
| Получать входящие realtime updates | Public domain hook на `useSWRSubscription` | [`subscriptions.md`](subscriptions.md) |
| Отправить предметную socket command | Public domain adapter/action | [`subscriptions.md`](subscriptions.md#socket-transport) |

## Границы

- Remote fetcher `useSWR` выполняет только HTTP `GET` через domain GET adapter.
- Не используй `useSWRMutation` для REST mutations.
- Mutation adapter не зависит от SWR; cache синхронизирует явный domain lifecycle owner.
- Не создавай в hook `fetch`, `HttpClient`, API client, URL, auth headers или transport error policy.
- Не сохраняй DTO и source errors в domain cache.
- Не копируй SWR data в React state, Context или Zustand без отдельной локальной семантики; применяй правила [`State management`](../../application/state-management/README.md).
- Для private data включай стабильную auth identity в key, но не используй JWT или cookie.
- Не добавляй SWR параллельно существующей data-fetching library без migration boundary.
- Не используй SSR, React Server Components и server preload: этот референс предназначен только для React + Vite SPA.

## Примеры

Запускаемый `demo-app` является источником актуальных GET-примеров:

- [`current-session`](../../../demo-app/src/domains/authentication/hooks/use-get-current-session/) показывает публичные
  данные, стандартный `SWRResponse`, поле `error` и общий ключ сессии;
- [`current-user`](../../../demo-app/src/domains/user/hooks/use-get-current-user/) показывает приватный ключ со стабильным
  `userId`, условный запуск и тот же стандартный `SWRResponse`;
- [полный сценарий](../../../demo-app/README.md) связывает OpenAPI, API-клиент, предметные адаптеры, SWR и автономный MSW.

В `demo-app` пока нет реализации подписок. Нормативный встроенный пример и правила очистки находятся в
[`subscriptions.md`](subscriptions.md); не считай его подтверждённым запускаемым сценарием демо.

Для API SWR, не описанного этими референсами, используй официальную [документацию SWR](https://swr.vercel.app/).
