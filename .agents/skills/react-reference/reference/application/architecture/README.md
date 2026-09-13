# Архитектура React SPA

React SPA строится по Unit Architecture. Перед проектированием или изменением архитектурной границы загрузи skill
`unit-architecture`. Этот раздел не заменяет общую архитектурную модель и закрепляет только решения выбранного
React-проекта.

Если skill недоступен, используй документацию публичного репозитория
[`gromlab-ru/unit-architecture`](https://github.com/gromlab-ru/unit-architecture). Сначала прочитай обзор и архитектурную
модель, затем применяй проектные уточнения этого раздела. Не заменяй отсутствующий skill собственными предположениями об
архитектуре.

## Порядок работы

1. Прочитай [`архитектурный профиль`](project-profile.md): он определяет роли, фасеты, сегменты и группы проекта.
2. Выбери роль по [`обзору юнитов`](units/README.md).
3. Открой документ выбранной роли и определи владельца, контракт и границу ответственности.
4. Перейди к прикладной области или библиотеке только после определения места кода.
5. Проверь публичные пути и зависимости по Unit Architecture.

## Роли юнитов

| Ответственность | Документ |
| --- | --- |
| Выбор одной из пяти ролей и граница React-компонента | [`units/README.md`](units/README.md) |
| Блочные продуктовые UI-проекции | [`units/compositions.md`](units/compositions.md) |
| Предметные контракты, адаптеры и ожидаемые ошибки | [`units/domains/README.md`](units/domains/README.md) |
| Технические возможности и жизненный цикл ресурсов | [`units/infra.md`](units/infra.md) |
| Универсальные визуальные возможности | [`units/ui.md`](units/ui.md) |
| Чистый детерминированный фундамент | [`units/shared.md`](units/shared.md) |

## Проектные соглашения

[`Архитектурный профиль React SPA`](project-profile.md) является единственным владельцем следующих решений:

- фасеты `index.ts` и `lazy.ts`;
- алиасы `app/*`, `compositions/*`, `domains/*`, `infra/*`, `ui/*` и `shared/*`;
- общий и профильный словарь сегментов;
- группы `layouts`, `route-boundaries`, `screens` и `widgets`;
- прямое подключение экранов и каркасов в `app/router` и отдельное поведение маршрутных веток в
  `compositions/route-boundaries`.

## Связанные области

| Задача | Документ |
| --- | --- |
| Полная структура и сборка каркаса | [`Структура приложения`](../structure/README.md) |
| Создание страницы от сценария до URL | [`Создание страниц`](../pages/README.md) |
| Создание и размещение React-компонента | [`Создание компонентов`](../components/README.md) |
| Разбор макета и декомпозиция интерфейса | [`Вёрстка по макету`](../markup/README.md) |
| Маршруты, экраны и разделение сборки | [`Маршрутизация`](../routing/README.md) |
| Получение и изменение данных | [`Data Fetching`](../data-fetching/README.md) |
| Состояние React, Zustand и SWR | [`State Management`](../state-management/README.md) |
| Настройка алиасов в TypeScript и Vite | [`Platform`](../platform/module-aliases.md) |

## Рабочий пример

Запускаемое [`demo-app`](../../../demo-app/) показывает согласованные решения, но не задаёт обязательное дерево каждого
юнита. Используй конкретного владельца как точку входа:

- [`domains/authentication/`](../../../demo-app/src/domains/authentication/) — сессия, вход и выход;
- [`domains/user/`](../../../demo-app/src/domains/user/) — профиль текущего пользователя;
- [`infra/backend-api/`](../../../demo-app/src/infra/backend-api/) — общий клиент серверного API;
- [`shared/errors/`](../../../demo-app/src/shared/errors/) — общий контракт неизвестного сбоя;
- [`app/router/`](../../../demo-app/src/app/router/) определяет дерево URL;
- [`compositions/route-boundaries/`](../../../demo-app/src/compositions/route-boundaries/) задаёт отдельное поведение веток;
- [`compositions/screens/`](../../../demo-app/src/compositions/screens/) — завершённые экранные сценарии.

Не копируй `demo-app` целиком без подтверждённой ответственности, потребителей и публичного контракта.
