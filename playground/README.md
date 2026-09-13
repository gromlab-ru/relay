# Playground

Учебный проект «Личный кабинет»: шесть задач, три комментария и один отчёт.
Все описанные результаты — демонстрационные данные.

## Посмотреть оформление

Из этой папки:

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
node --conditions=tasks-source --import tsx ../apps/cli/src/main.ts list
```

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

```bash
npm run --silent tasks -- list --ready
npm run --silent tasks -- claim 5 --status in_progress --actor human
npm run --silent tasks -- comment add 5 --text "Начал писать инструкцию" --actor human
npm run --silent tasks -- get 5 --full
npm run --silent tasks -- create "Новая демонстрационная задача" --group docs --actor human
# Следующий ID — 7.
```

Справка с объяснениями и примерами:

```bash
npm run --silent tasks -- create --help
npm run --silent tasks -- log add --help
```

Проверка целостности:

```bash
npm run --silent tasks -- validate
```
