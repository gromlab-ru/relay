# Справочник CLI

[Документация](../README.md) → Справочники → CLI

Все команды запускаются как `npx @gromlab/tasks-cli <команда>`.
С реестром проектов: `npx @gromlab/tasks-cli <проект> <команда>` или
`npx @gromlab/tasks-cli --project <проект> <команда>`. Имя требуется и для реестра
с одной записью. `--config` принимает проектный конфиг либо реестр; правила поиска
описаны в [конфигурации](CONFIGURATION.md).
В синтаксисе `<id>` — числовой ID из ответа, квадратные скобки обозначают
необязательную часть. Чтение не требует автора; запись требует `--actor` или `TASKS_ACTOR`.
Примеры используют оркестратора для постановки и приёмки, субагента — для выполнения.

Основной процесс использует явное назначение оркестратором. Субагент читает выданный ID
и пишет отчёты/summary; задачи, статусы и зависимости он самостоятельно не меняет.
`claim` остаётся технической возможностью CLI, но не шагом штатного процесса субагента.

## Карта команд

| Область    | Команды                                                                                                                                   |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Проект     | [init](#init), [config get](#config-get), [group list](#group-list), [validate](#validate), [migrate](#migrate), [server](#server)        |
| Реестр     | [projects init](#projects-init), [projects list](#projects-list), [projects add](#projects-add), [projects remove](#projects-remove)      |
| Задачи     | [create](#create), [list](#list), [get](#get), [update](#update), [description](#description), [summary](#summary), [overview](#overview) |
| Назначения | [status](#status), [assign](#assign), [claim](#claim), [release](#release)                                                                |
| Связи      | [deps add](#deps-add), [deps remove](#deps-remove), [links](#links), [tree](#tree)                                                        |
| Обсуждение | [comment add](#comment-add), [comment list](#comment-list), [comment get](#comment-get)                                                   |
| Отчёты     | [log add](#log-add), [log list](#log-list), [log get](#log-get), [log search](#log-search)                                                |

Дополнительно: [общие параметры](#общие-параметры), [поля create/update](#поля-create-и-update),
[HTTP-режим](#http-режим-и-local), [вывод](OUTPUT.md), [ошибки](ERRORS.md).

## Общие параметры

| Параметр              | Значение                                                         |
| --------------------- | ---------------------------------------------------------------- |
| `--config <path>`     | Явный конфиг; приоритет над `TASKS_CONFIG` и поиском вверх       |
| `--project <name>`    | Имя проекта из реестра; альтернатива префиксу перед командой     |
| `--server-url <url>`  | HTTP(S) origin без пути; приоритет над окружением и `server.url` |
| `--local`             | Прямой Core с игнорированием HTTP-настроек                       |
| `--actor <id>`        | Автор записи; приоритет над `TASKS_ACTOR`                        |
| `--format <format>`   | `text` или `json`; по умолчанию `output.format`                  |
| `--color <mode>`      | `auto`, `always`, `never`; по умолчанию `auto`                   |
| `--max-bytes <bytes>` | `1024–16777216`; по умолчанию `output.maxBytes`, обычно 16384    |
| `-h, --help`          | Справка, аргументы, параметры и примеры                          |
| `-V, --version`       | Версия CLI                                                       |

Общие параметры можно указывать вместе с вложенной командой.
`--help` работает без конфига. CLI без аргументов и группы `config`, `group`, `deps`,
`comment`, `log` показывают справку. Справка и версия всегда текстовые.

```bash
npx @gromlab/tasks-cli --help
npx @gromlab/tasks-cli create --help
npx @gromlab/tasks-cli log add --help
```

<a id="http-режим-и-local"></a>

### HTTP-режим и --local

Выбор: `--local` → `--server-url` → `TASKS_SERVER_URL` → `server.url` → Core.
В режиме реестра `TASKS_SERVER_URL` игнорируется, а `projects.<имя>.serverUrl`
имеет приоритет над `server.url` проектного конфига.
Рабочие команды используют оба транспорта. В HTTP настройки проекта определяет
сервер; файлы ввода читает вызывающий агент. `server` всегда локален;
`init` и `migrate` при настроенном HTTP требуют явного локального режима.
Подробности: [конфигурация](CONFIGURATION.md), [оркестрация](../guides/ORCHESTRATION.md).

## Проект

### projects init

**Синтаксис:** `projects init`. Создаёт `tasks.orchestrator.json` с пустым реестром
и `mcp.port: 3010`. `--config` или `TASKS_CONFIG` задаёт путь нового файла.
Существующий файл не заменяется. Автор не требуется.

### projects list

**Синтаксис:** `projects list`. Возвращает `data.items` с именами, путями и URL,
а также `meta.configPath` реестра. Читает настройки без открытия всех баз.

### projects add

**Синтаксис:** `projects add <name> [path] [--project-config <path>] [--server-url <url>] [--replace]`.
`path` относительно реестра; `--project-config` относительно каталога проекта.
Для remote-only достаточно `--server-url`. Повтор той же записи идемпотентен;
замена требует `--replace`. Регистрация не создаёт базу; для новой базы вызовите
`<проект> init`. Пример: `tasks-cli projects add backend ../backend`.

### projects remove

**Синтаксис:** `projects remove <name>`. Удаляет регистрацию, сохраняя файлы и задачи.
Возвращает `{ project, removed }`; повтор даёт `removed: false`.
Все команды `projects` выбирают реестр через `--config`, окружение или поиск вверх.

### init

**Синтаксис:** `init [--storage <path>]`.

Создаёт конфиг и каталог базы. `--storage` по умолчанию `.tasks`, путь разрешается
относительно конфига. `--config` задаёт место нового конфига. Автор не требуется.
Результат: `{ configPath, storageDir }`; существующий конфиг даёт `ALREADY_INITIALIZED`.
При явном HTTP в аргументах/окружении используйте `--local`.

```bash
npx @gromlab/tasks-cli init
npx @gromlab/tasks-cli --local init --config /work/project/tasks.config.json --storage .tasks
```

Примеры показывают разные способы инициализации. Далее: [create](#create), [первый проект](../GETTING_STARTED.md).

### config get

**Синтаксис:** `config get`. Собственных параметров нет.

Возвращает конфигурацию в `data` и пути в `meta.configPath`, `meta.storagePath`.
В HTTP это конфигурация сервера. Ошибки: `CONFIG_NOT_FOUND`, ошибки схемы и IO.
Изменения настроек выполняются в `tasks.config.json`.

```bash
npx @gromlab/tasks-cli config get --format json
```

См. [полную конфигурацию](CONFIGURATION.md).

### group list

**Синтаксис:** `group list [--limit <count>] [--cursor <cursor>] [--all]`.

Группы возникают из поля `group`. Возвращает страницу групп со счётчиками `total`,
успешных `completed` и всех конечных `terminal`; порядок — по имени.
Лимит `1–100`, по умолчанию `output.defaultLimit`. `--all` требует полный ответ
в бюджете и несовместим с `--limit`/`--cursor`.
Ошибки: `INVALID_CURSOR`, `RESPONSE_TOO_LARGE`.

```bash
npx @gromlab/tasks-cli group list --all
```

См. [list](#list) для задач группы.

### validate

**Синтаксис:** `validate`. Собственных параметров нет.

Проверяет схемы всех документов, ID, имена файлов, вложенные записи, статусы, ссылки
и циклы. Успех содержит счётчики `tasks`, `comments`, `logs`.
Нарушения дают `VALIDATION_FAILED` или ошибку чтения; диагностика содержит детали.

```bash
npx @gromlab/tasks-cli validate --format json
```

См. [Git и слияние](../guides/GIT.md).

### migrate

**Синтаксис:** `migrate`. Нужен автор; при HTTP нужен `--local`.

Переводит UUID-документы v1 в v2 и старую вложенную структуру в `.tasks/*.json`.
Возвращает `migrated`, `total`, при переносе — `backupPath`, `mappingPath`,
а при изменении структуры — `flattened`. Повтор на актуальной базе не меняет данные.
Прерванный перенос продолжается повтором команды. Ошибка состояния — `MIGRATION_CONFLICT`.

```bash
npx @gromlab/tasks-cli --local migrate --actor orchestrator
```

См. [порядок миграции и резервную копию](../guides/MIGRATION.md).

### server

**Синтаксис:** `server [--port <number>] [--open]`. Нужен автор.

Запускает UI, REST, Swagger и SSE на `127.0.0.1`. `--port`: `0–65535`; приоритет
над `TASKS_PORT`, `server.port`, затем `3000`. `0` выбирает свободный порт.
`--open` открывает доску в браузере. Команда работает до `Ctrl+C`.
В JSON первое сообщение содержит `{ url, actor, pid }`.
Автор сервера подписывает дополнения из UI; CLI-агенты передают собственных авторов.
При занятом порте выберите другой порт и обновите URL клиентов.

```bash
npx @gromlab/tasks-cli server --actor human --open
```

См. [веб-доску](../guides/WEB.md), [оркестрацию](../guides/ORCHESTRATION.md), [API](API.md).

## Задачи

### Поля create и update

| Параметр                    | Поведение                                                            |
| --------------------------- | -------------------------------------------------------------------- |
| `--title <text>`            | Однострочное название; у `create` альтернатива позиционному названию |
| `--description <text>`      | Markdown-описание; пустая строка очищает                             |
| `--description-file <path>` | UTF-8 файл описания; `-` означает stdin                              |
| `--stdin`                   | Прочитать описание из stdin                                          |
| `--summary <text>`          | Актуальное состояние задачи; пустая строка очищает                   |
| `--summary-file <path>`     | UTF-8 файл саммари; `-` означает stdin                               |
| `--status <status>`         | Ключ статуса из конфига                                              |
| `--group <name>`            | Основная группа                                                      |
| `--clear-group`             | Снять группу; несовместим с `--group`                                |
| `--parent <id>`             | ID родителя                                                          |
| `--clear-parent`            | Снять родителя; несовместим с `--parent`                             |
| `--tags <tags>`             | Заменить набор тегов, значения через запятую; `""` очищает           |
| `--depends-on <ids>`        | Заменить набор зависимостей; ID через запятую; `""` очищает          |
| `--assignee <actor>`        | Назначить исполнителя                                                |

Для каждого текста выбирается один источник. Один stdin нельзя использовать
для нескольких полей. Ввод проверяется как UTF-8; CRLF/CR нормализуются в LF.
Неуказанные поля при `update` сохраняются. Для снятия исполнителя используйте `release`.
Лимиты полей — в [выводе и размерах](OUTPUT.md#ограничения-хранения).

### create

**Синтаксис:** `create [title] [поля]`. Нужен автор.

Обязательно название: позиционно или `--title`, одновременно оба нельзя.
По умолчанию статус — `defaultStatus`; описание и summary пусты, ссылки/теги
пусты, группа/родитель/исполнитель — `null`. Новый ID равен `max(id) + 1`.
Результат: `{ id, revision: 1 }`. Создание не имеет ключа идемпотентности.
Ошибки: `TITLE_REQUIRED`, `CONFLICTING_OPTIONS`, `VALIDATION_ERROR`, ошибки графа.

```bash
npx @gromlab/tasks-cli create "API пользователей" --group backend --actor orchestrator
```

Далее: [get](#get), [claim](#claim), [сквозной сценарий](../guides/WORKFLOW.md).

### list

**Синтаксис:** `list [фильтры] [--limit <count>] [--cursor <cursor>]`.

| Параметр             | Поведение                                                              |
| -------------------- | ---------------------------------------------------------------------- |
| `--all`              | Включить конечные статусы; совместим с лимитом и курсором              |
| `--status <status>`  | Точный статус; переопределяет фильтр незавершённых                     |
| `--group <name>`     | Точная группа                                                          |
| `--assignee <actor>` | Точный исполнитель                                                     |
| `--parent <id>`      | Непосредственные дети                                                  |
| `--tag <tag>`        | Наличие тега                                                           |
| `--sort <order>`     | `id` (по умолчанию) или `board`                                        |
| `--search <text>`    | Название, описание и summary без учёта регистра                        |
| `--ready`            | Только свободные задачи в `readyStatuses` с выполненными зависимостями |
| `--limit <count>`    | Максимум задач `1–100`; без флага число ограничено байтовым бюджетом   |
| `--cursor <cursor>`  | Продолжение с теми же фильтрами                                        |

По умолчанию выбираются неконечные статусы, включая заблокированные задачи.
Фильтры объединяются через И. JSON возвращает плоский `data.items`; текст группирует
страницу по группам. `--sort board` использует порядок колонок и карточек.
Ошибки: `UNKNOWN_STATUS`, `INVALID_CURSOR`, `RESPONSE_TOO_LARGE`.

```bash
npx @gromlab/tasks-cli list --ready --group backend --format json
npx @gromlab/tasks-cli list --all --limit 20
```

См. [пагинацию](OUTPUT.md#страницы) и [claim](#claim).

### get

**Синтаксис:** `get <id> [--full] [--fields <fields>]`.

Возвращает сохранённые поля и вычисляемые `blockedBy`, `ready`, `commentCount`,
`logCount`. Без `--full` словари `comments` и `logs` исключены. `--fields` выбирает
поля через запятую, в том числе сами словари, независимо от `--full`.
Ошибки: `TASK_NOT_FOUND`, `UNKNOWN_FIELD`, `RESPONSE_TOO_LARGE`.

```bash
npx @gromlab/tasks-cli get 1 --fields id,status,summary,revision --format json
npx @gromlab/tasks-cli get 1 --full --max-bytes 262144
```

См. [формат задачи](FORMAT.md), [description](#description), [summary](#summary).

### update

**Синтаксис:** `update <id> [поля] [--if-revision <revision>]`. Нужен автор.

Применяет только переданные [поля](#поля-create-и-update). Нужно хотя бы одно изменение.
`--if-revision` — положительное безопасное целое; при отсутствии используется актуальный
документ под блокировкой. Результат: `{ id, revision }`; неизменённый документ сохраняет ревизию.
Ошибки: `EMPTY_UPDATE`, `REVISION_CONFLICT`, ошибки ввода, схемы и графа.

```bash
npx @gromlab/tasks-cli update 1 --summary "Контракт готов" --actor backend-agent
```

См. [конкурентность](../concepts/TASKS.md#ревизии-и-параллельные-изменения).

### description

**Синтаксис:** `description <id>`. Собственных параметров нет.

Читает только описание. JSON: `{ id, description: string[] }`, текст: Markdown.
Ошибки: `TASK_NOT_FOUND`, `RESPONSE_TOO_LARGE`.

```bash
npx @gromlab/tasks-cli description 1
```

Изменение: [update](#update) с `--description` или файловым источником.

### summary

**Синтаксис:** `summary <id>`. Собственных параметров нет.

Читает актуальное саммари задачи. JSON: `{ id, summary: string[] }`, текст: Markdown.
Ошибки: `TASK_NOT_FOUND`, `RESPONSE_TOO_LARGE`.

```bash
npx @gromlab/tasks-cli summary 1
```

Изменение: [update](#update) с `--summary`; история: [log list](#log-list).

### overview

**Синтаксис:** `overview [id] [--limit <count>] [--review-status <statuses>]`.

Сводка одного снимка: весь проект или задача и её потомки.
`--limit` — до `1–100` строк каждого раздела, по умолчанию `5`.
`--review-status` — неконечные статусы проверки через запятую; по умолчанию `review`,
если он определён и неконечный. Курсора нет, полные счётчики сохраняются.
Результат включает `counts`, `leafCounts`, `progress`, `ready`, `review`, `blockers`.
Ошибки: `INVALID_REVIEW_STATUS`, `UNKNOWN_STATUS`, `TASK_NOT_FOUND`, `RESPONSE_TOO_LARGE`.

```bash
npx @gromlab/tasks-cli overview --format json
npx @gromlab/tasks-cli overview 1 --limit 10
```

Полный контракт и расчёты — [обзор проекта](OVERVIEW.md).

## Назначения

Эти команды возвращают `{ id, revision }`, требуют автора и поддерживают
`--if-revision <revision>`. Автор описывает, кто сделал запись; исполнитель хранится отдельно.

### status

**Синтаксис:** `status <id> <status> [--if-revision <revision>]`.

Меняет статус, сохраняя исполнителя. Успешное завершение требует удовлетворённых
зависимостей. Ошибки: `UNKNOWN_STATUS`, `TASK_BLOCKED`, `REVISION_CONFLICT`.

```bash
npx @gromlab/tasks-cli status 1 done --actor orchestrator
```

См. [семантику статусов](../concepts/TASKS.md#статусы).

### assign

**Синтаксис:** `assign <id> <assignee> [--if-revision <revision>]`.

Явное назначение оркестратором, включая замену исполнителя и заблокированные задачи.
Статус сохраняется. Для конкурентного захвата свободной работы используйте `claim`.
Ошибки: `TASK_NOT_FOUND`, `VALIDATION_ERROR`, `REVISION_CONFLICT`.

```bash
npx @gromlab/tasks-cli assign 1 backend-agent --actor orchestrator
```

### claim

**Синтаксис:** `claim <id> [--status <status>] [--if-revision <revision>]`.

Атомарно назначает свободную доступную задачу автору. Без `--status` сохраняет статус;
с ним назначение и переход выполняются вместе. Успешен только один конкурентный захват.
Ошибки: `TASK_ASSIGNED`, `TASK_BLOCKED`, `TASK_NOT_READY`, `REVISION_CONFLICT`.

```bash
npx @gromlab/tasks-cli claim 1 --status in_progress --actor backend-agent
```

См. [list --ready](#list). В основном процессе используйте
[назначение оркестратором](../guides/ORCHESTRATION.md#назначение-задач).

### release

**Синтаксис:** `release <id> [--force] [--if-revision <revision>]`.

Снимает исполнителя и сохраняет статус. `--force` разрешает снять чужое назначение.
Ошибки: `ASSIGNEE_MISMATCH`, `REVISION_CONFLICT`.

```bash
npx @gromlab/tasks-cli release 1 --force --actor orchestrator
```

См. [передачу работы](../guides/WORKFLOW.md#продолжение-и-передача-работы).

## Связи

### deps add

**Синтаксис:** `deps add <id> <dependency> [--if-revision <revision>]`. Нужен автор.

Первый ID — зависимая задача, второй — ожидаемая. Атомарно добавляет одну связь,
сохраняя остальные. Результат: `{ id, revision }`.
Ошибки: `TASK_NOT_FOUND`, `DEPENDENCY_CYCLE`, `TASK_BLOCKED`, `REVISION_CONFLICT`.

```bash
npx @gromlab/tasks-cli deps add 3 2 --actor orchestrator
```

Здесь задача `3` ждёт задачу `2`. См. [links](#links).

### deps remove

**Синтаксис:** `deps remove <id> <dependency> [--if-revision <revision>]`. Нужен автор.

Удаляет одну зависимость, сохраняя остальные. Результат: `{ id, revision }`.
Ошибки: `TASK_NOT_FOUND`, `REVISION_CONFLICT`, нарушения оставшегося графа.

```bash
npx @gromlab/tasks-cli deps remove 3 2 --actor orchestrator
```

### links

**Синтаксис:** `links <id>`. Собственных параметров нет.

Возвращает родителя, детей, прямые зависимости, обратные зависимости и текущие блокеры.
Ошибка: `TASK_NOT_FOUND`; для большого ответа возможен `RESPONSE_TOO_LARGE`.

```bash
npx @gromlab/tasks-cli links 3
```

См. [разницу связей](../concepts/TASKS.md#связи-и-готовность).

### tree

**Синтаксис:** `tree <id> [--depth <depth>]`.

Дерево подзадач: корень на глубине `0`, `--depth` от `0` до `100`, по умолчанию `3`.
JSON содержит плоский список с глубиной; при отсечении дерева есть `meta.truncated`.
Ошибки: `TASK_NOT_FOUND`, `RESPONSE_TOO_LARGE`.

```bash
npx @gromlab/tasks-cli tree 1 --depth 2
```

См. [overview](#overview) для сводки дерева.

## Комментарии

### comment add

**Синтаксис:** `comment add <task-id> (--text <text> | --stdin | --file <path>) [--request-id <id>]`.

Нужен автор и ровно один источник непустого тела. `--file -` читает stdin.
Добавляет Markdown-комментарий до 64 КиБ; результат `{ id, taskId }`.
Ревизия задачи увеличивается, кроме повтора существующей записи с тем же ключом.
Ключ: `1–128` ASCII-символов, начинается с буквы/цифры, далее разрешены также `.`, `_`, `:`, `-`.
Без флага CLI генерирует UUID. Ошибки: `INPUT_SOURCE_REQUIRED`, `CONFLICTING_OPTIONS`,
`INPUT_TOO_LARGE`, `TASK_NOT_FOUND`, `IDEMPOTENCY_CONFLICT`.

```bash
npx @gromlab/tasks-cli comment add 1 --text "Добавьте проверку ошибок" --actor orchestrator
```

См. [повтор записи](../guides/ORCHESTRATION.md#повтор-отчёта).

### comment list

**Синтаксис:** `comment list <task-id> [--author <actor>] [--limit <count>] [--cursor <cursor>] [--all]`.

Страница кратких комментариев от новых к старым, с полными ID для чтения.
Автор сравнивается точно. Лимит `1–100`, по умолчанию `output.defaultLimit`.
`--all` требует полный ответ и несовместим с `--limit`/`--cursor`.
Ошибки: `TASK_NOT_FOUND`, `INVALID_CURSOR`, `RESPONSE_TOO_LARGE`.

```bash
npx @gromlab/tasks-cli comment list 1 --author orchestrator --limit 5
```

### comment get

**Синтаксис:** `comment get <task-id> <comment-id>`.

Полная запись с Markdown-телом. ID вида `cmt_…` берётся из ответа добавления или списка
и должен принадлежать указанной задаче. Ошибки: `COMMENT_NOT_FOUND`, `RESPONSE_TOO_LARGE`.

```bash
npx @gromlab/tasks-cli comment get 1 "<comment-id>"
```

## Отчёты

### log add

**Синтаксис:** `log add <task-id> (--text <text> | --stdin | --file <path>) [параметры]`.

Нужен автор и ровно один источник непустого тела до 256 КиБ. `--file -` читает stdin.

| Параметр            | Значение по умолчанию / поведение                             |
| ------------------- | ------------------------------------------------------------- |
| `--kind <kind>`     | `progress`; также `decision`, `execution`, `error`, `summary` |
| `--title <text>`    | Пустая строка; однострочный заголовок                         |
| `--summary <text>`  | Пустой текст; краткое содержание отчёта                       |
| `--session-id <id>` | `null`; связь записей сессии                                  |
| `--request-id <id>` | UUID на вызов; стабильный ключ повторяемой записи             |

Результат `{ id, taskId }`. Запись увеличивает ревизию задачи; повтор с прежним ключом,
автором и содержимым возвращает исходную запись. Правила ключа такие же, как у `comment add`.
Ошибки: ошибки ввода, `TASK_NOT_FOUND`, `IDEMPOTENCY_CONFLICT`.

```bash
npx @gromlab/tasks-cli log add 1 --kind progress --session-id wave-1 \
  --request-id backend-step-1 --text "Контракт готов" --actor backend-agent
```

### log list

**Синтаксис:** `log list <task-id> [фильтры] [--limit <count>] [--cursor <cursor>] [--all]`.

| Параметр            | Значение                  |
| ------------------- | ------------------------- |
| `--author <actor>`  | Точный автор              |
| `--kind <kind>`     | Один из пяти типов отчёта |
| `--session-id <id>` | Сессия агента             |
| `--since <date>`    | Создано не раньше даты    |
| `--until <date>`    | Создано не позже даты     |

Даты: `YYYY-MM-DD` или ISO 8601 с часовым поясом. Фильтры объединяются через И.
Возвращает страницу кратких отчётов от новых к старым. Лимит `1–100`, по умолчанию
`output.defaultLimit`. `--all` — полный ответ, несовместим с лимитом и курсором.
Ошибки: `INVALID_DATE`, `INVALID_CURSOR`, `TASK_NOT_FOUND`, `RESPONSE_TOO_LARGE`.

```bash
npx @gromlab/tasks-cli log list 1 --kind summary --limit 5
```

### log get

**Синтаксис:** `log get <task-id> <log-id>`.

Полный отчёт с заголовком, автором и Markdown. ID вида `log_…` берётся из добавления,
списка или поиска. Ошибки: `LOG_NOT_FOUND`, `RESPONSE_TOO_LARGE`.

```bash
npx @gromlab/tasks-cli log get 1 "<log-id>" --max-bytes 524288
```

### log search

**Синтаксис:** `log search <task-id> --query <text> [фильтры и страницы log list]`.

Буквальный поиск в теле с учётом регистра; `--query` обязателен. Возвращает страницу
совпавших отчётов с ID, номером первой подходящей строки, числом подходящих строк
и фрагментом. Поддерживает все фильтры и страницы `log list`.
Ошибки: `INVALID_ARGUMENT`, `INVALID_DATE`, `INVALID_CURSOR`, `RESPONSE_TOO_LARGE`.

```bash
npx @gromlab/tasks-cli log search 1 --query "Контракт" --kind progress
```

Далее: [вывод](OUTPUT.md), [ошибки](ERRORS.md), [сценарии оркестрации](../guides/ORCHESTRATION.md).
