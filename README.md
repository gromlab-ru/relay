# @gromlab/tasks-cli

Локальный трекер для AI-оркестратора, субагентов и человека.
**Одна задача — один JSON со всем контекстом.**

Описание, комментарии и короткие отчёты хранятся внутри задачи. Многострочный
Markdown записывается массивами строк для удобной отладки JSON и выводится
через CLI с настоящими переносами, пустыми строками и отступами.

## Возможности

- Задачи, группы, теги, подзадачи и зависимости с проверкой циклов.
- Произвольные статусы в конфигурации проекта.
- Назначение оркестратором и атомарный захват задачи агентом.
- Проверка `revision` для защиты от устаревших изменений.
- Многострочные описания, комментарии, саммари и отчёты в одном файле задачи.
- Выборочное чтение контекста, поиск по отчётам и пагинация.
- Текстовый вывод по умолчанию; `--format json` для машинной обработки.
- Атомарная запись JSON и проверка целостности после Git-слияния.

## Запуск из исходников

Требуется Node.js **22+**; для проверок слияния нужен Git.

```bash
npm ci
npm run build
node dist/cli/main.js --help
node dist/cli/main.js init
export TASKS_ACTOR=orchestrator
```

Создание задачи без подготовки отдельного файла с описанием:

```bash
node dist/cli/main.js create --title "Реализовать API" --group backend --stdin <<'MD'
## Что сделать

- Добавить POST /users.
- Зафиксировать контракт ошибок.

## Проверка

Интеграционные тесты должны проходить.
MD
```

Подставьте ID из ответа в следующие команды:

```bash
node dist/cli/main.js description <task-id>
node dist/cli/main.js get <task-id>
node dist/cli/main.js get <task-id> --full
node dist/cli/main.js list --ready --format json
node dist/cli/main.js config get
```

Для разработки доступен `npm run dev -- <command>`. Другой проект выбирается
через `--config /path/to/project/tasks.config.json`; `init` создаёт конфиг
и хранилище рядом с ним.

## npm-пакет

Целевой запуск опубликованного пакета:

```bash
npx @gromlab/tasks-cli init
npx @gromlab/tasks-cli list --ready
```

Проверка будущего релизного архива и запуск из него:

```bash
npm run package:check
npm exec --yes --package ./.artifacts/npm/gromlab-tasks-cli-0.1.0.tgz -- tasks-cli --help
```

## Хранилище

```text
tasks.config.json
.tasks/
  .gitignore
  .runtime/
  tasks/<task-id>.json
```

JSON задачи содержит `description`, `summary`, `comments`, `logs` и остальные
поля карточки. Добавление комментария или отчёта атомарно изменяет этот файл
и увеличивает его `revision`. Служебная `.runtime` исключается из Git.

Процессы CLI координируются через общее хранилище. В разных worktree указывайте
один и тот же абсолютный `--config`. Изменения независимых задач объединяются
через Git; изменения одной задачи могут конфликтовать. После слияния запускайте
`validate`. Эксклюзивность `claim` относится к общей папке данных.

## Проверки и релизы

```bash
npm run check
npm run package:check
```

GitHub Actions проверяет Node.js 22/24 и собирает проверенный npm-архив.
Тег `v<version>` запускает релиз: обычные версии публикуются в `latest`,
предварительные — в `next`. Версия тега сверяется с обоими манифестами.
Порядок первой локальной публикации и настройки OIDC: [релизы](docs/RELEASING.md).

## Документация

- [Техническое задание](docs/SPEC.md)
- [Команды CLI](docs/CLI.md)
- [Формат самодостаточного JSON](docs/FORMAT.md)
- [Архитектура и гарантии](docs/ARCHITECTURE.md)
- [Публикация в npm](docs/RELEASING.md)
- [История версий](CHANGELOG.md)
