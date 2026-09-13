# Tasks

Локальный трекер задач с CLI, REST API и веб-доской. Приложения работают с одним
JSON-хранилищем: ревизии, зависимости задач, блокировки и история реализованы в общем Core.

Репозиторий организован как **Turborepo + npm workspaces**. Пользователям поставляется
один npm-пакет `@gromlab/tasks-cli`, включающий CLI, backend и собранный frontend.

## Быстрый старт

Для разработки рекомендуется Node.js 24 и npm 11.16.0. Поддерживаемый минимум
репозитория: Node.js 22.12.

```bash
npm ci
npm run dev
```

- Web: <http://127.0.0.1:5173>.
- API: <http://127.0.0.1:3000/api/v1/health>.
- Swagger: <http://127.0.0.1:3000/api/docs>.

`dev` запускает API и Vite через Turbo. По умолчанию backend использует демонстрационные
данные `apps/playground`; действия в интерфейсе изменяют эти данные. Для своего проекта
задайте абсолютный путь `TASKS_CONFIG`, например:

```bash
TASKS_CONFIG=/absolute/path/to/project/tasks.config.json npm run dev
```

`TASKS_PORT` меняет порт API, `TASKS_API_URL` задаёт адрес API для Vite,
`TASKS_WEB_PORT` меняет порт Vite, `TASKS_ACTOR` задаёт автора серверных изменений.
Например, совместный запуск на других портах:

```bash
TASKS_PORT=3001 TASKS_API_URL=http://127.0.0.1:3001 TASKS_WEB_PORT=5174 npm run dev
```

## Команды

Все команды выполняются из корня репозитория:

| Команда                                                                                     | Назначение                                                  |
| ------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| `npm run dev` / `npm run dev:app`                                                           | API и web в режиме разработки                               |
| `npm run dev:server`                                                                        | Только backend с наблюдением за исходниками                 |
| `npm run dev:web`                                                                           | Только Vite; API должен работать отдельно                   |
| `npm run --silent dev:cli -- <args>`                                                        | CLI из исходников, рабочий каталог не меняется              |
| `npm run --silent playground -- <args>`                                                     | CLI на демонстрационных данных                              |
| `npm run build`                                                                             | Сборка всех приложений и библиотек                          |
| `npm run build:cli`                                                                         | CLI, встроенный web и необходимые библиотеки                |
| `npm run build:server` / `npm run build:web`                                                | Выборочная сборка приложения                                |
| `npm start`                                                                                 | Сборка и запуск backend с готовым UI на порту 3000          |
| `npm run --silent start:cli -- <args>`                                                      | Собранный CLI; сначала выполнить build:cli                  |
| `npm run lint` / `npm run typecheck`                                                        | Проверки workspaces                                         |
| `npm test`                                                                                  | Все автоматизированные тесты с нужными сборками             |
| `npm run test:cli` / `npm run test:server` / `npm run test:core` / `npm run test:contracts` | Выборочные тесты                                            |
| `npm run format` / `npm run format:check`                                                   | Форматирование и его проверка                               |
| `npm run check`                                                                             | Форматирование, lint, типы, сборки и тесты                  |
| `npm run clean`                                                                             | Удалить локальные результаты сборки, сохранив кеш Turbo     |
| `npm run package:check`                                                                     | Собрать npm-архив и проверить его установку вне репозитория |

`dev:cli` является одноразовым запуском команды, а не частью общей dev-сессии:

```bash
npm run --silent dev:cli -- --version
npm run --silent playground -- list --format json
```

Существующие команды `dev:ui`, `lint:web`, `typecheck:web`, `build:core` и
`build:contracts` также доступны. Локальные инструменты приложения запускаются
через npm workspaces, например `npm run generate:api --workspace=@tasks/web`.

## Структура

| Workspace                                                      | Ответственность                                          |
| -------------------------------------------------------------- | -------------------------------------------------------- |
| [`apps/cli`](apps/cli/README.md)                               | Commander, терминал, сборка и публикация продукта        |
| [`apps/server`](apps/server/README.md)                         | Standalone backend, dev-настройки и управление процессом |
| [`apps/web`](apps/web/README.md)                               | React, Vite, Mantine и канбан-доска                      |
| [`apps/playground`](apps/playground/README.md)                 | Приватный демонстрационный проект и CLI-сценарии         |
| `packages/core`                                                | Предметные операции и файловое хранилище                 |
| [`packages/contracts`](packages/contracts/README.md)           | Переносимые контракты REST и SSE                         |
| [`packages/server-runtime`](packages/server-runtime/README.md) | Общая NestJS-реализация для CLI и standalone backend     |
| `packages/typescript-config`                                   | Общие строгие настройки TypeScript                       |

CLI и standalone backend используют `@tasks/server-runtime`, который зависит от Core
и Contracts. Web зависит только от Contracts, не от серверного кода. Зависимости объявляются
в манифестах потребителей; межпакетные импорты проходят через `exports`.

Каждый workspace собирается в собственный `dist`. Turbo управляет порядком сборки
и кешированием. Сборка CLI дополнительно зависит от сборки web на уровне задач,
а не через зависимость одного приложения от другого. В разработке условие
`tasks-source` позволяет backend и CLI использовать исходники библиотек без ручной сборки.

## Установка продукта

Из каталога пользовательского проекта:

```bash
npx @gromlab/tasks-cli init
npx @gromlab/tasks-cli create "Первая задача" --actor human
npx @gromlab/tasks-cli server --actor human --open
```

При публикации приватные workspace-библиотеки включаются в готовый JavaScript,
а frontend копируется в дистрибутив. Пользователю не нужны TypeScript, Vite или Turbo.
Проверенный архив находится в `apps/cli/.artifacts/npm/`.

## Документация

- [Руководство CLI](apps/cli/README.md) и [справочник команд](apps/cli/docs/CLI.md).
- [Архитектура](docs/ARCHITECTURE.md) и [план продукта](docs/PLAN.md).
- [Формат хранения](packages/core/docs/FORMAT.md) и [контракт API](packages/contracts/docs/API.md).
- [Спецификация интерфейса](apps/web/UI_SPEC.md).
- [Релизы](apps/cli/docs/RELEASING.md) и [история изменений](apps/cli/CHANGELOG.md).

Корневой пакет приватный. Метаданные релиза находятся в `apps/cli/package.json`;
CI публикует тот же архив, который прошёл проверку установки.
