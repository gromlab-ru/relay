# Relay

**Общий контекст проекта для людей и AI-агентов: паспорт, планы, задачи, проверки и релизы.**

Relay хранит задачи рядом с кодом в `.relay/tasks`. CLI поддерживает прямую работу
с файлами и REST API. Один сервер предоставляет API, SSE и веб-доску; MCP подключает
агентов к этому серверу.

Веб-приложение включает отдельные разделы: обзор, паспорт, планы, доску задач,
требования и знания, работу агентов и проверки, релизы, историю и передачу контекста.
Проектные документы хранятся в `.relay/project`. Workspace даёт переключение между
независимыми проектами. [Полный рабочий цикл](docs/guides/LIFECYCLE.md).

Для агентов: [скилл Relay](skills/relay/SKILL.md) с самостоятельным начальным руководством,
ролевыми алгоритмами и справочниками. Исходники — `src-skills/relay`, сборка —
`pnpm run skills:build`, проверка актуальности — `pnpm run skills:check`.

| Компонент            | npm-пакет               | Команда        |
| -------------------- | ----------------------- | -------------- |
| Терминальный клиент  | `@gromlab/relay-cli`    | `relay-cli`    |
| Сервер и готовый Web | `@gromlab/relay-server` | `relay-server` |
| MCP-адаптер          | `@gromlab/relay-mcp`    | `relay-mcp`    |

Требуется Node.js 22+. Репозиторий: <https://github.com/gromlab-ru/relay>.

## Один проект — local

В каталоге проекта:

```bash
npx @gromlab/relay-cli init
npx @gromlab/relay-cli create "Первая задача" --actor human
npx @gromlab/relay-server --open
```

Сервер открывает веб-доску на `http://127.0.0.1:3000`. Задачи находятся в:

```text
проект/
└── .relay/
    ├── config.json
    ├── tasks/
    │   └── 1.json
    ├── project/
    │   └── passport.json
    └── runtime/
```

Без `server.url` CLI работает через Core. Чтобы использовать HTTP, задайте URL в
`.relay/config.json` либо передайте `--server-url`. Флаг `--local` выбирает прямой
доступ в режиме local. При ошибке HTTP CLI сообщает об отказе сервера.

## Несколько проектов — workspace

У каждого проекта собственная `.relay`. В общем каталоге создайте `relay.workspace.json`:

```json
{
  "version": 1,
  "mode": "workspace",
  "server": { "port": 3000, "url": "http://127.0.0.1:3000" },
  "projects": {
    "a": { "path": "./A" },
    "b": { "path": "./B" }
  }
}
```

Из общего каталога:

```bash
npx @gromlab/relay-server --open
npx @gromlab/relay-cli a list
npx @gromlab/relay-cli b get 1
```

Сервер обслуживает обе базы через один порт. Web показывает переключатель проектов.
Рабочие команды CLI в workspace всегда используют HTTP; проект выбирается префиксом
или `--project`. Реестр может быть пустым или содержать один проект.

Пустой реестр создаёт `relay-cli projects init`. После запуска сервера регистрации
можно менять через `relay-cli projects add a ./A` и `relay-cli projects remove a`.
Регистрация ссылается на предварительно инициализированный проект; удаление регистрации
сохраняет его данные.

## Автоматический выбор контекста

CLI и сервер ищут конфиг вверх от текущего каталога. В ближайшем каталоге приоритет
у `relay.workspace.json`, затем у `.relay/config.json`. Явный `--config` имеет приоритет
над `RELAY_CONFIG` и автоматическим поиском.

Запуск внутри `A/src` выбирает проект A, запуск в общем каталоге — workspace.
Проектный HTTP-клиент может также работать только по URL и ID проекта, без локальных файлов.

## MCP

Сначала запустите Relay Server, затем:

```bash
npx @gromlab/relay-mcp --server-url http://127.0.0.1:3000
```

Streamable HTTP доступен на `http://127.0.0.1:3010/mcp`. Инструмент `projects_list`
возвращает актуальный режим и проекты. В workspace передавайте `project`:

```text
task_get({ project: "a", id: 1 })
```

В local проект можно опустить. MCP получает реестр и выполняет операции через сервер.
Назначение задач, авторы, ревизии, комментарии и отчёты сохраняют общие правила Core.

## Документация и разработка

- [Архитектура](docs/ARCHITECTURE.md).
- [Конфигурация и режимы](docs/reference/CONFIGURATION.md).
- [CLI](docs/reference/CLI.md), [MCP](docs/reference/MCP.md), [REST](docs/reference/API.md).
- [Сборка, первая локальная публикация и CI](docs/development/RELEASING.md).

```bash
pnpm install --frozen-lockfile
pnpm run dev
pnpm run check
pnpm run package:check
```

`dev` открывает локальный демонстрационный проект. Для workspace:

```bash
RELAY_CONFIG=apps/playground/relay.workspace.json pnpm run dev
```

`package:check` создаёт три npm-архива и проверяет их в независимых установках:
local, workspace A/B, CLI, серверная статика и MCP.
