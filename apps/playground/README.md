# Playground

Учебный проект «Личный кабинет»: шесть задач, три комментария и один отчёт.
Все описанные результаты — демонстрационные данные.

## Посмотреть оформление

Из этой папки (или `pnpm --silent run playground <args>` из корня):

```bash
pnpm --silent run tasks list
pnpm --silent run tasks list --all
pnpm --silent run tasks list --status done
pnpm --silent run tasks tree 1
pnpm --silent run tasks links 6
pnpm --silent run tasks get 3 --full
pnpm --silent run tasks log list 3
pnpm --silent run tasks group list
```

Команда `tasks` запускает исходники TypeScript через **Node.js** с `tsx`.
Изменения кода доступны при следующем запуске. Зависимости устанавливаются
командой `pnpm install --frozen-lockfile` в корне репозитория.

Эквивалент прямого вызова:

```bash
pnpm exec tsx --tsconfig ../cli/tsconfig.dev.json --conditions=tasks-source ../cli/src/main.ts list
```

Условие `tasks-source` выбирает исходники приватных пакетов без предварительной сборки.
Корневой `pnpm run dev` запускает API и web с этим демонстрационным проектом по умолчанию;
CLI запускается отдельно через `playground` или `dev:cli` с явным `--config`.

В терминале цвета включаются автоматически. Можно явно передать
`--color always` или `--color never`. Машинный вывод: `--format json`.
Задачи показываются отдельными секциями по группам. В `tasks.config.json`
для `review` задан `color: "blue"`; измените это поле и снова вызовите список,
чтобы увидеть другой цвет. Возможные значения перечисляет `config --help`.

В исходных данных `list` показывает пять незавершённых задач. `list --all`
включает выполненную задачу 2 — всего шесть; `list --status done` показывает
только её. Возле задачи 6 указаны блокеры `#3` и `#4`.
Для большой выборки CLI выдаёт курсор продолжения; число задач можно явно
ограничить через `--limit`, в том числе вместе с `--all`.

## Задачи

| ID  | Задача                           | Исходное состояние                 |
| --- | -------------------------------- | ---------------------------------- |
| 1   | Запустить личный кабинет         | В работе, родитель остальных задач |
| 2   | Согласовать контракт API профиля | Выполнена                          |
| 3   | Реализовать API профиля          | В работе; есть комментарий и отчёт |
| 4   | Сверстать экран профиля          | На проверке; есть комментарий      |
| 5   | Написать инструкцию пользователя | Свободна и доступна для захвата    |
| 6   | Подключить экран к API           | Ожидает завершения задач 3 и 4     |

ID — единственные идентификаторы задач, сохранённые как числа в формате v2.
Файлы находятся в `.tasks/1.json` … `6.json`, конфигурация — в `tasks.config.json`.

## Попробовать самому

Следующий блок выполняется из `apps/playground` и изменяет только временную копию данных:

```bash
TASKS_DEMO="$(mktemp -d)"
cp -R .tasks tasks.config.json "$TASKS_DEMO/"
pnpm --silent run tasks --config "$TASKS_DEMO/tasks.config.json" list --ready
pnpm --silent run tasks --config "$TASKS_DEMO/tasks.config.json" claim 5 --status in_progress --actor human
pnpm --silent run tasks --config "$TASKS_DEMO/tasks.config.json" comment add 5 --text "Начал писать инструкцию" --actor human
pnpm --silent run tasks --config "$TASKS_DEMO/tasks.config.json" get 5 --full
pnpm --silent run tasks --config "$TASKS_DEMO/tasks.config.json" create "Новая демонстрационная задача" --group docs --actor human
# Следующий ID — 7.
```

Для проверки UI на той же копии передайте `TASKS_CONFIG="$TASKS_DEMO/tasks.config.json"`
корневой команде `pnpm run dev`.

Справка с объяснениями и примерами:

```bash
pnpm --silent run tasks create --help
pnpm --silent run tasks log add --help
```

Проверка целостности:

```bash
pnpm --silent run tasks validate
```
