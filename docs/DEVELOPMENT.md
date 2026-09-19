# Разработка Relay

При любых работах обязательны [агентский протокол](development/PROTOCOL.md),
[правила документации](development/DOCUMENTATION.md) и [досье работы](work/README.md).
Этот документ — практическая инструкция окружения; [навигатор разработки](development/README.md)
собирает все действующие правила.

Перед изменениями обязательны [единые правила интерфейсов](development/INTERFACE-STANDARD.md)
и `AGENTS.md` владельца. Markdown, русская документация, человекочитаемый CLI и понятные
MCP-операции — часть готовности, а не последующая косметическая доработка.

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
Исходники продуктового скилла находятся в `src-skills/relay`, готовый пакет — в `skills/relay`.
Сборка: `pnpm run skills:build`; проверка актуальности: `pnpm run skills:check`.
Подробности — [устройство и установка скиллов](development/SKILLS.md).

## Запуск

- Vite: http://127.0.0.1:5173.
- API: http://127.0.0.1:4700/api/v1/health.
- Swagger: http://127.0.0.1:4700/api/docs.

`dev` запускает API и web через Turbo. По умолчанию backend открывает
`apps/playground/coffee-shop/.relay/config.json`; Web автоматически открывает кофейню.
Два пустых демопроекта инициализируются командой `pnpm --filter @relay/playground run init`.
Для работы с кофейней и P2P-арендой через один Server используйте workspace-запуск ниже;
подробности — в [README playground](../apps/playground/README.md).
Для проверки мутаций используйте отдельный временный проект с абсолютным `RELAY_CONFIG`.

```bash
RELAY_CONFIG=apps/playground/relay.workspace.json pnpm run dev
RELAY_PORT=3001 RELAY_API_URL=http://127.0.0.1:3001 RELAY_WEB_PORT=5174 pnpm run dev
```

Это независимые примеры запуска. `RELAY_ACTOR` определяет серверного автора.
Standalone-сервер по умолчанию использует `human` для дополнений из UI.
Рабочий продукт предназначен для оркестратора и субагентов на одном хосте.

CLI из исходников запускается отдельно, без Turbo-логов в stdout:

```bash
pnpm --silent run dev:cli --version
pnpm --silent run playground coffee-shop list --format json
```

`dev:cli` сохраняет рабочий каталог вызова. Условие `tasks-source` позволяет
CLI и backend использовать исходники библиотек через tsx. Web использует compiled
SDK; его dev-скрипт сначала собирает `@relay/rest-sdk`.

MCP запускается отдельным процессом, например:

```bash
pnpm run dev:mcp --server-url http://127.0.0.1:4700
```

`dev:mcp` сначала собирает зависимости, затем выполняет точку входа через tsx.
MCP обращается к уже запущенному Relay Server через SDK.
По умолчанию MCP слушает http://127.0.0.1:4710/mcp; `--config` принимает оба вида конфигов.

## Структура

| Workspace                                                         | Ответственность                                                      |
| ----------------------------------------------------------------- | -------------------------------------------------------------------- |
| [apps/cli](../apps/cli/README.md)                                 | Команды, выбор проекта, терминал и публикация                        |
| [apps/mcp](../apps/mcp/README.md)                                 | MCP-инструменты, общий Relay Server через HTTP и отдельный npm-пакет |
| [packages/project-runtime](../packages/project-runtime/README.md) | Реестр, разрешение конфигов, общий Backend для CLI/MCP               |
| [apps/server](../apps/server/README.md)                           | Standalone-точка входа и управление dev-процессом                    |
| [apps/web](../apps/web/README.md)                                 | React, Mantine, SWR, dnd-kit; профиль Unit Architecture              |
| [apps/playground](../apps/playground/README.md)                   | Демонстрационные данные и CLI-сценарии                               |
| [packages/core](../packages/core)                                 | Domain, application, файловое хранение и блокировки                  |
| [packages/contracts](../packages/contracts/README.md)             | Переносимые REST/SSE-контракты                                       |
| [packages/rest-sdk](../packages/rest-sdk/README.md)               | Сгенерированный ESM-клиент OpenAPI                                   |
| [packages/server-runtime](../packages/server-runtime/README.md)   | Общая NestJS/Fastify-реализация                                      |
| [packages/typescript-config](../packages/typescript-config)       | Общие строгие настройки Node-пакетов                                 |

Слои и инварианты описаны в [архитектуре](ARCHITECTURE.md).
Сервер использует Core, а не CLI. SDK используется CLI, MCP и web. Межпакетных
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
| `pnpm run dev:mcp <args>` / `start:mcp <args>`                       | Разработка / запуск собранного MCP                              |
| `pnpm run build:mcp` / `test:mcp`                                    | Сборка и интеграционные проверки MCP                            |
| `pnpm run package:check:mcp`                                         | Сборка независимого MCP npm-архива                              |
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
| `pnpm run skills:build` / `skills:check` / `skills:test`             | Сборка, проверка актуальности и тесты пакета скилла Relay       |
| `pnpm run format` / `format:check`                                   | Форматирование и его проверка                                   |
| `pnpm run check`                                                     | Документация, форматирование, lint, типы, сборки и тесты        |
| `pnpm run package:check`                                             | Три независимые npm-установки, local/workspace, API, Web и MCP  |
| `pnpm run clean`                                                     | Удаление результатов сборки workspaces с сохранением кеша Turbo |

Локальные инструменты доступны через `pnpm --filter <workspace> run <script>`.
Корневые команды Turbo предварительно собирают необходимые зависимости.

## Проверки

Тесты расположены у владельцев: CLI — `apps/cli/test`, Core — `packages/core/test`,
API/SSE — `packages/server-runtime/test`, standalone/dev — `apps/server/test`.
MCP — `apps/mcp/test`, реестр и маршрутизация — `packages/project-runtime/test`.
Contracts проверяет совместимость типов с Core. CI запускает проверки на Node.js 22 и 24.

Для web действуют [инструкции приложения](../apps/web/AGENTS.md): Unit Architecture,
React Reference, генерация новых TSX, lint/typecheck/build и сценарии через изолированный
headless agent-browser. Автотесты frontend не добавляются по принятому решению.
Зафиксированная браузерная приёмка — [VERIFICATION.md](../apps/web/VERIFICATION.md).

## Документация и поставка

Корневой `README.md` — витрина GitHub; README каждого публичного приложения входит в его npm-пакет. Пользовательская документация
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
MCP упаковывается отдельно с Core, Project Runtime, REST SDK и Server Runtime в JavaScript,
со своим README и CHANGELOG. Общие проверки метаданных и публикации находятся в `scripts/release`.
[Добавление команды](development/EXTENDING.md) · [Релизный процесс](development/RELEASING.md).
