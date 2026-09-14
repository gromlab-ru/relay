# Разработка Tasks

[Документация](README.md) → Разработка

## Содержание

- [Окружение](#окружение)
- [Запуск](#запуск)
- [Структура](#структура)
- [Команды](#команды)
- [Проверки](#проверки)
- [Документация и поставка](#документация-и-поставка)

## Окружение

Монорепозиторий использует Turborepo и pnpm workspaces. Для разработки рекомендуется
**Node.js 24** и **pnpm 11.18.0**; минимум репозитория — Node.js 22.13.
Пользовательский пакет поддерживает Node.js 22+.

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm run dev
```

Состав workspaces задаёт `pnpm-workspace.yaml`, зависимости фиксирует общий lockfile.
Внутренние зависимости объявлены как `workspace:*`, импорты проходят через `exports`.
Установка выполняется явно; запуск скриптов не устанавливает зависимости автоматически.

Для агентской разработки установите четыре внешних скилла из `skills-lock.json`:

```bash
pnpm run skills:install
```

Команда использует закреплённый `npx skills@1.5.26` (Node.js 22.20+, рекомендуется 24).
Весь каталог проектных копий `.agents/skills` исключён из Git без исключений.
Исходники продуктового скилла принадлежат версионируемому `skills/tasks-cli`.
Подробности — [устройство и установка скиллов](development/SKILLS.md).

## Запуск

- Vite: http://127.0.0.1:5173.
- API: http://127.0.0.1:3000/api/v1/health.
- Swagger: http://127.0.0.1:3000/api/docs.

`dev` запускает API и web через Turbo. По умолчанию backend открывает
`apps/playground/tasks.config.json`; действия в UI изменяют демонстрационные данные.
Для проверки мутаций используйте отдельный временный проект с абсолютным `TASKS_CONFIG`.

```bash
TASKS_CONFIG=/absolute/path/to/project/tasks.config.json pnpm run dev
TASKS_PORT=3001 TASKS_API_URL=http://127.0.0.1:3001 TASKS_WEB_PORT=5174 pnpm run dev
```

Это независимые примеры запуска. `TASKS_ACTOR` определяет серверного автора.
Standalone-сервер по умолчанию использует `human` для дополнений из UI.
Рабочий продукт предназначен для оркестратора и субагентов на одном хосте.

CLI из исходников запускается отдельно, без Turbo-логов в stdout:

```bash
pnpm --silent run dev:cli --version
pnpm --silent run playground list --format json
```

`dev:cli` сохраняет рабочий каталог вызова. Условие `tasks-source` позволяет
CLI и backend использовать исходники библиотек через tsx. Web использует compiled
SDK; его dev-скрипт сначала собирает `@tasks/rest-sdk`.

## Структура

| Workspace                                                       | Ответственность                                         |
| --------------------------------------------------------------- | ------------------------------------------------------- |
| [apps/cli](../apps/cli/README.md)                               | Команды, терминал, локальный/HTTP-адаптеры и публикация |
| [apps/server](../apps/server/README.md)                         | Standalone-точка входа и управление dev-процессом       |
| [apps/web](../apps/web/README.md)                               | React, Mantine, SWR, dnd-kit; профиль Unit Architecture |
| [apps/playground](../apps/playground/README.md)                 | Демонстрационные данные и CLI-сценарии                  |
| [packages/core](../packages/core)                               | Domain, application, файловое хранение и блокировки     |
| [packages/contracts](../packages/contracts/README.md)           | Переносимые REST/SSE-контракты                          |
| [packages/rest-sdk](../packages/rest-sdk/README.md)             | Сгенерированный ESM-клиент OpenAPI                      |
| [packages/server-runtime](../packages/server-runtime/README.md) | Общая NestJS/Fastify-реализация                         |
| [packages/typescript-config](../packages/typescript-config)     | Общие строгие настройки Node-пакетов                    |

Слои и инварианты описаны в [архитектуре](ARCHITECTURE.md).
Сервер использует Core, а не CLI. SDK используется CLI и web. Межпакетных
TypeScript project references и корневых алиасов исходников нет. Каждый workspace
собирается в свой `dist`; порядок и кеширование задаёт Turbo.

## Команды

Из корня репозитория, аргументы скриптам — сразу после имени, без дополнительного `--`:

| Команда                                                              | Назначение                                                      |
| -------------------------------------------------------------------- | --------------------------------------------------------------- |
| `pnpm run dev` / `dev:app`                                           | API и web                                                       |
| `pnpm run dev:server`                                                | Backend с наблюдением за исходниками                            |
| `pnpm run dev:web` / `dev:ui`                                        | Vite; API запускается отдельно                                  |
| `pnpm --silent run dev:cli <args>`                                   | CLI из исходников                                               |
| `pnpm --silent run playground <args>`                                | CLI на демопроекте                                              |
| `pnpm run build`                                                     | Все workspaces                                                  |
| `pnpm run build:cli` / `build:server` / `build:web`                  | Выборочная сборка с зависимостями                               |
| `pnpm run build:core` / `build:contracts`                            | Сборка библиотек                                                |
| `pnpm start`                                                         | Сборка и запуск standalone-сервера с UI                         |
| `pnpm --silent run start:cli <args>`                                 | Собранный CLI после `build:cli`                                 |
| `pnpm run lint` / `typecheck`                                        | Проверки workspaces                                             |
| `pnpm test`                                                          | Все автоматизированные тесты с необходимыми сборками            |
| `pnpm run test:cli` / `test:server` / `test:core` / `test:contracts` | Выборочные тесты                                                |
| `pnpm run docs:check`                                                | Ссылки, файлы и якоря документации                              |
| `pnpm run format` / `format:check`                                   | Форматирование и его проверка                                   |
| `pnpm run check`                                                     | Документация, форматирование, lint, типы, сборки и тесты        |
| `pnpm run package:check`                                             | Самодостаточный npm-архив и установка вне репозитория           |
| `pnpm run clean`                                                     | Удаление результатов сборки workspaces с сохранением кеша Turbo |

Локальные инструменты доступны через `pnpm --filter <workspace> run <script>`.
Корневые команды Turbo предварительно собирают необходимые зависимости.

## Проверки

Тесты расположены у владельцев: CLI — `apps/cli/test`, Core — `packages/core/test`,
API/SSE — `packages/server-runtime/test`, standalone/dev — `apps/server/test`.
Contracts проверяет совместимость типов с Core. CI запускает проверки на Node.js 22 и 24.

Для web действуют [инструкции приложения](../apps/web/AGENTS.md): Unit Architecture,
React Reference, генерация новых TSX, lint/typecheck/build и сценарии через изолированный
headless agent-browser. Автотесты frontend не добавляются по принятому решению.
Зафиксированная браузерная приёмка — [VERIFICATION.md](../apps/web/VERIFICATION.md).

## Документация и поставка

Корневой `README.md` — единая витрина GitHub/npm. Пользовательская документация
принадлежит `docs`, README workspaces описывают их разработку.
Точные параметры должны соответствовать `CommandDefinition` и `--help`.
Проверка CLI сопоставляет справочник с зарегистрированными командами и параметрами.

`docs:check` разбирает Markdown и проверяет локальные ссылки, изображения и якоря,
включая заголовки с повторяющимися именами. Сеть для этой проверки не требуется.
При переносе страницы обновляйте внутренние ссылки и сохраняйте переход со старого адреса.

`package:check` включает корневой README и `docs` в stage CLI. Ссылки в npm README
получают абсолютные GitHub-адреса тега `v<версия>`, изображения — raw-адреса этого тега.
Документы внутри архива сохраняют локальные переходы между включёнными файлами;
ссылки на исходники ведут в GitHub. Публичные URL новой документации доступны после
публикации соответствующего Git-тега.

Подготовка архива использует dev-инструменты; готовый npm-пакет содержит только
production-зависимости, CLI и готовый web. Публикуется именно проверенный `.tgz`.
[Добавление команды](development/EXTENDING.md) · [Релизный процесс](development/RELEASING.md).
