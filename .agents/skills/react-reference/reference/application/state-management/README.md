# State management в React

Этот раздел помогает выбрать источник истины, владельца lifecycle и React-механизм доступа к состоянию. Он является самостоятельной application-областью и не определяет способ выполнения REST-запросов. Архитектурного владельца и публичный фасет определяй по [`architecture/README.md`](../architecture/README.md).

## Главное правило

Не используй термин «глобальное состояние» как основание для выбора библиотеки. Сначала определи:

1. Что состояние означает для продукта или UI.
2. Какой юнит владеет этой ответственностью.
3. Где находится источник истины: React subtree, shared client-only store, REST API или realtime transport.
4. Каким consumers нужны данные и как долго они должны жить.
5. Кто создаёт, изменяет, сбрасывает и уничтожает состояние.

Один смысл должен иметь один источник истины. Не синхронизируй вручную несколько writable stores с одинаковыми данными.

## Выбор механизма

| Состояние | Механизм | Что получаем |
| --- | --- | --- |
| Значение принадлежит одному component subtree | React state или reducer | Состояние колоцировано с lifecycle consumer и не требует внешнего store |
| Несколько частей SPA используют общий client-only state | Zustand | Единые actions, точечные subscriptions и явная область жизни без копирования state по React tree |
| Данные получены через domain GET adapter и отражают состояние API | Public domain SWR hook | Cache, request state, deduplication и revalidation в одном lifecycle server state |
| Нужен последний transient realtime snapshot | `useSWRSubscription` | Subscription разделяется по key и очищается после последнего consumer |
| Realtime обновляет восстановимое REST-состояние | SWR GET-cache и subscription sync | GET остаётся bootstrap, а одна клиентская проекция восстанавливается после reconnect |
| Важна обработка каждого события | Queue, reducer или специализированный event store | Сохраняется event semantics, которую latest-value cache обеспечить не может |

Если источником истины является REST API или realtime protocol, способ получения и изменения данных определён в [`data fetching`](../data-fetching/README.md). Технические правила cache применяй по [`libraries/swr/get-data.md`](../../libraries/swr/get-data.md) и [`libraries/swr/subscriptions.md`](../../libraries/swr/subscriptions.md).

## React state

Используй `useState` или `useReducer`, когда состояние принадлежит одному component subtree и живёт вместе с ним: открытие dropdown, неподтверждённое значение формы, локальный выбор вкладки или временное состояние взаимодействия.

Поднимай state к ближайшему общему React owner, пока он остаётся частью той же ответственности. Большое число props само по себе не является основанием для Zustand: сначала проверь границу компонента и контракт юнита.

Не копируй props или SWR data в local state без отдельной локальной семантики. Для draft явно определи инициализацию, сохранение, конфликт и сброс относительно server value.

## Zustand

Zustand является preferred state manager для разделяемого client-only state, если React state больше не соответствует области потребления или lifecycle, а данные не являются server state.

Zustand выбран, потому что предоставляет:

- небольшой typed store без обязательной иерархии Providers;
- подписку компонента только на выбранный slice;
- actions рядом с изменяемым состоянием;
- доступ из React и вне component tree через контракт владельца;
- отдельные stores и factories для разных областей жизни вместо одного универсального store.

Store принадлежит unit owner соответствующей ответственности. Доступность import из нескольких мест не делает его общим и не отменяет публичный фасет юнита.

### Глобальный статус

Не создавай базовый store приложения только потому, что состояние читают обычный TypeScript-код и React-компоненты.
Сначала определи владельца состояния:

- доменный статус хранится в store соответствующего домена;
- состояние композиции хранится в store или Context композиционного юнита;
- техническое состояние внешней возможности принадлежит реализующему её infra-юниту;
- React подключается к store владельца через его публичный selector hook;
- обычный TypeScript использует публичное действие или getter владельца.

Если одно состояние действительно не имеет более узкого владельца, обоснуй отдельный общий юнит. Не помещай в него
server cache и не используй его как реестр несвязанных глобальных флагов.

### Контракт store

- Храни state и изменяющие его actions в одном typed контракте владельца.
- Изменяй state через actions, а не произвольные внешние вызовы `setState`.
- Выбирай в component минимальный slice вместо подписки на весь store.
- Выноси именованный selector, когда он переиспользуется или выражает правило чтения.
- Экспортируй наружу только необходимый контракт через публичный фасет unit owner.
- Не добавляй middleware, slices, persistence или devtools без соответствующей задачи.

### Область жизни

Store Zustand, созданный на уровне файла, является singleton текущего JavaScript runtime. Используй его только когда состояние должно переживать unmount отдельных consumers.

Для независимых экземпляров одного state в нескольких subtree, tabs или widgets создай store factory и явную Provider boundary. Создание, reset и уничтожение выполняет unit owner lifecycle, а не каждый component consumer.

### Persistence

Persistence изменяет lifecycle и контракт данных. До её подключения определи persisted schema, versioning, migration, hydration, очистку при logout или смене tenant и поведение при повреждённом значении. Не сохраняй credentials, secrets и чувствительные данные.

Server state не становится client-only state из-за требования переживать reload. Для REST-данных используй повторный GET и профильный cache mechanism.

## Граница Zustand и SWR

Public domain SWR hook хранит клиентскую проекцию server state. Zustand не должен зеркалировать её.

Не копируй в Zustand response GET-operation, SWR request state, канонический entity list, последнее subscription value или connection state готового transport SDK. Zustand может хранить client-only интерпретацию рядом с server state: выбранный ID, режим отображения, несохранённый draft или локальный порядок.

Предметные модели, hooks и state доступны внешним consumers только через публичный фасет домена по
[`architecture/units/domains/README.md`](../architecture/units/domains/README.md).

Если состояние принадлежит одному предметному владельцу, создавай отдельный store внутри
`domains/<name>/stores` и публикуй необходимый контракт через фасет домена. Не поднимай его в общий store ради удобного
импорта. Данные текущей сессии и другие серверные данные остаются в доменных хуках SWR.

## Защищённый 401

Потерю авторизации интерпретирует домен, который вызвал защищённую операцию:

1. HTTP transport добавляет credential и повторно выбрасывает source error без изменения состояния приложения.
2. Domain adapter знает, что операция использует Bearer-аутентификацию, и при terminal `401`, оставшемся после
   настроенной refresh/retry policy, вызывает публичное действие logout.
3. Домен авторизации синхронно удаляет credential и устанавливает `unauthenticated`.
4. `AuthGuard`, подписанный на доменный auth store, немедленно закрывает защищённый UI.
5. Auth Provider очищает запись текущей сессии и приватные SWR-ключи.

До logout сравни Bearer credential из завершившегося запроса с текущим credential auth-домена. Поздний `401` запроса
предыдущей сессии остаётся ожидаемым исходом операции, но не закрывает уже установленную новую сессию.

До завершения начальной проверки сохранённого токена используй статус `unknown`; не показывай защищённую разметку как
для подтверждённой сессии. Не импортируй доменный auth store, SWR и session keys в HTTP transport. Не применяй эту policy
автоматически к операциям входа, регистрации, refresh или другой схеме авторизации: их `401` имеет собственный смысл.

Проверяемая цепочка находится в
[`get-current-session.adapter.ts`](../../../demo-app/src/domains/authentication/adapters/get-current-session.adapter.ts),
[`logout-rejected-authentication.operation.ts`](../../../demo-app/src/domains/authentication/operations/logout-rejected-authentication.operation.ts)
и [`authentication-provider.tsx`](../../../demo-app/src/domains/authentication/providers/authentication-provider/authentication-provider.tsx).

## Context и Provider

Context используй для стабильной dependency или scoped contract в React tree, а не как универсальный mutable store. Provider оправдан, когда создаёт scope, экземпляр store, dependency или lifecycle resource. Не создавай Provider только ради сокрытия обычного import через публичный фасет.

Новые `.tsx` для `Provider` и компонентов проверки доступа, включая `AuthGuard`, создавай через `npx @gromlab/create`
по [`правилам создания TSX`](../components/tsx-generation.md). Отсутствие собственного DOM не отменяет генерацию.

## Existing state manager

- Не добавляй Zustand параллельно Redux, MobX или другому принятому state manager в рамках локальной задачи.
- Для миграции выбери границу одного unit owner и перенеси связный state-сценарий вместе с actions и consumers.
- Не оставляй две writable копии одного state на неопределённый срок.
- Если существующая библиотека решает задачу и закреплена проектом, следуй проекту.

## Проверка

- Для состояния определены смысл, unit owner, источник истины и область жизни.
- Local state не вынесен во внешний store без необходимости.
- Zustand содержит shared client-only state и не зеркалирует SWR.
- У каждого store есть предметный, композиционный или технический владелец.
- Обычный TypeScript-код и React-компоненты используют публичные фасеты store владельца.
- Terminal Bearer `401` обрабатывается вызвавшим domain adapter и закрывает UI через auth store владельца.
- HTTP-транспорт не импортирует SWR и не знает предметные ключи кеша.
- SWR используется для server state.
- Actions, reset и resource lifecycle принадлежат unit owner.
- Внешний доступ проходит через публичный фасет владельца.
- Persistence имеет schema, migration и правила очистки либо не используется.
