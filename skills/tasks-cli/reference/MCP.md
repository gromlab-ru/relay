# MCP: один проект и реестр

[К основному алгоритму](../SKILL.md)

## Подготовка оркестратором

Для одной базы запусти `npx @gromlab/tasks-mcp` в каталоге с `tasks.config.json`.
Явный путь: `npx @gromlab/tasks-mcp --config /work/app/tasks.config.json`.
Подключи всех агентов к Streamable HTTP URL `http://127.0.0.1:3010/mcp`.

Для нескольких проектов создай `tasks.orchestrator.json`:

```json
{
  "version": 1,
  "projects": {
    "frontend": { "path": "../frontend" },
    "backend": { "path": "../backend" }
  },
  "mcp": { "port": 3010 }
}
```

Пути относительны к реестру на хосте MCP. Каждый каталог содержит проектный конфиг.
Поле `config` переопределяет файл относительно `path`; `serverUrl` задаёт готовый REST API
и имеет приоритет над `server.url` проекта. Remote-only запись может содержать только URL.
При отсутствии URL MCP сам запускает API на свободном порту и использует существующий REST SDK.

Оба конфига находятся автоматически вверх от каталога запуска. При двух файлах рядом
реестр имеет приоритет. `--config` переопределяет `TASKS_CONFIG`. Порт: `--port` →
`TASKS_MCP_PORT` → `mcp.port` → 3010. Изменение порта требует перезапуска.

## Выбор проекта и регистрация

- `projects_list({})` показывает режим и проекты. В режиме `project` опускай `project`.
- В режиме `registry` передавай точное имя в каждом вызове, даже если проект пока один.
- `project_register({ project, path?, config?, serverUrl?, replace? })` сохраняет запись.
- `project_unregister({ project })` удаляет регистрацию, сохраняя задачи и файлы.
- Повтор одной регистрации идемпотентен; для замены требуется `replace: true`.
- Оркестратор отвечает за конфиг. Реестр перечитывается при каждом вызове; перезапуск
  и повторное обнаружение инструментов после добавления проекта не требуются.

## Рабочие инструменты

| Задача                            | Инструмент                                                                    |
| --------------------------------- | ----------------------------------------------------------------------------- |
| Конфиг, обзор, проверка           | `project_config`, `project_overview`, `project_validate`                      |
| Список, группы                    | `tasks_list`, `project_groups`                                                |
| Карточка                          | `task_get({ project?, id, full?, fields? })`                                  |
| Описание или summary              | `task_markdown({ project?, id, field })`                                      |
| Связи и дерево                    | `task_links`, `task_tree`                                                     |
| Создание                          | `task_create({ project?, title, actor, ...поля })`                            |
| Назначение и summary              | `task_update({ project?, id, actor, patch, ifRevision? })`                    |
| Статусы и назначения оркестратора | `task_status`, `task_claim`, `task_release`                                   |
| Зависимости оркестратора          | `task_dependency({ project?, id, dependencyId, action, actor, ifRevision? })` |
| Комментарии                       | `comment_add`, `comment_get`, `comments_list`                                 |
| Отчёты                            | `log_add`, `log_get`, `logs_list`                                             |

Получай точные схемы через MCP tools/list. Субагент читает выданную задачу и пишет отчёты;
создание задач, выбор работы, назначения, статусы и зависимости принадлежат оркестратору.
Автор задаётся в каждом запросе; окружение `TASKS_ACTOR` его не подменяет.

```text
task_get({ project: "backend", id: 12 })
log_add({ project: "backend", id: 12, actor: "backend-agent", kind: "progress", requestId: "step-1", text: "API реализован, запускаю проверки" })
task_update({ project: "backend", id: 12, actor: "backend-agent", patch: { summary: "Осталась проверка ошибок" } })
```

`requestId` обязателен в `comment_add`/`log_add`. Повторяй ключ, проект, ID, автора и все
поля без изменений; новый шаг получает новый ключ. Создание и другие мутации автоматически
не повторяются: при неопределённом результате сначала перечитай состояние.

## Чтение и ошибки

Ответ: `structuredContent` с `{ ok, data, meta }`, продублированный JSON-текстом в `content`.
Ошибка операции содержит `isError: true`, `error.code`, `error.message`, иногда `error.details`.
`meta.project` — имя или null; одинаковый ID в разных проектах означает разные задачи.

Списки имеют `limit` 1–100 (по умолчанию 20), `cursor`, `meta.hasMore` и `meta.nextCursor`.
Повторяй проект и фильтры на каждой странице. `maxBytes` ограничивает весь MCP-результат,
включая обе копии; по умолчанию `output.maxBytes` проекта, обычно 16384.
Для большого контекста используй `fields`, `task_markdown`, `log_get` или `comment_get`.

`PROJECT_REQUIRED` — пропущено имя; `PROJECT_NOT_FOUND` — проверь реестр;
`REGISTRY_REQUIRED` — передано имя при прямом конфиге или вызвана регистрация в этом режиме.
Некорректный JSON исправляет оркестратор; следующий запрос читает исправленную версию.
`SERVER_UNAVAILABLE` при явном URL требует восстановления API; сохраняй контекст и ключ записи.

[Конфигурация](CONFIGURATION.md) · [Восстановление](RECOVERY.md)
