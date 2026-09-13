# Playground

Учебный проект «Личный кабинет»: шесть задач, три комментария и один отчёт.
Все описанные результаты — демонстрационные данные.

## Посмотреть оформление

Из этой папки (или `npm run --silent playground -- <args>` из корня):

```bash
npm run --silent tasks -- list
npm run --silent tasks -- list --all
npm run --silent tasks -- list --status done
npm run --silent tasks -- tree 1
npm run --silent tasks -- links 6
npm run --silent tasks -- get 3 --full
npm run --silent tasks -- log list 3
npm run --silent tasks -- group list
```

Команда `tasks` запускает исходники TypeScript через **Node.js** с `tsx`.
Изменения кода доступны при следующем запуске. Зависимости устанавливаются
командой `npm ci` в корне репозитория.

Эквивалент прямого вызова:

```bash
npm exec -- tsx --tsconfig ../cli/tsconfig.dev.json --conditions=tasks-source ../cli/src/main.ts list
```

Условие `tasks-source` выбирает исходники приватных пакетов без предварительной сборки.
Корневой `npm run dev` запускает API и web с этим демонстрационным проектом по умолчанию;
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
npm run --silent tasks -- --config "$TASKS_DEMO/tasks.config.json" list --ready
npm run --silent tasks -- --config "$TASKS_DEMO/tasks.config.json" claim 5 --status in_progress --actor human
npm run --silent tasks -- --config "$TASKS_DEMO/tasks.config.json" comment add 5 --text "Начал писать инструкцию" --actor human
npm run --silent tasks -- --config "$TASKS_DEMO/tasks.config.json" get 5 --full
npm run --silent tasks -- --config "$TASKS_DEMO/tasks.config.json" create "Новая демонстрационная задача" --group docs --actor human
# Следующий ID — 7.
```

Для проверки UI на той же копии передайте `TASKS_CONFIG="$TASKS_DEMO/tasks.config.json"`
корневой команде `npm run dev`.

Справка с объяснениями и примерами:

```bash
npm run --silent tasks -- create --help
npm run --silent tasks -- log add --help
```

Проверка целостности:

```bash
npm run --silent tasks -- validate
```
