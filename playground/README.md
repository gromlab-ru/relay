# Playground

Учебный проект «Личный кабинет»: шесть задач, три комментария и один отчёт.
Все описанные результаты — демонстрационные данные.

## Посмотреть оформление

Из этой папки:

```bash
npm run --silent tasks -- list
npm run --silent tasks -- tree 1
npm run --silent tasks -- links 6
npm run --silent tasks -- get 3 --full
npm run --silent tasks -- log list 3
npm run --silent tasks -- group list
```

Команда `tasks` запускает через **npx** собранный npm-архив **0.2.0** из
`.artifacts/npm/`. Для пересборки выполните `npm run package:check` в корне
репозитория. Это проверка новой сборки до её публикации в npm.

Эквивалент прямого вызова:

```bash
npx --yes --package ../.artifacts/npm/gromlab-tasks-cli-0.2.0.tgz tasks-cli list
```

В терминале цвета включаются автоматически. Можно явно передать
`--color always` или `--color never`. Машинный вывод: `--format json`.

## Задачи

| Номер | Задача                           | Исходное состояние                 |
| ----- | -------------------------------- | ---------------------------------- |
| 1     | Запустить личный кабинет         | В работе, родитель остальных задач |
| 2     | Согласовать контракт API профиля | Выполнена                          |
| 3     | Реализовать API профиля          | В работе; есть комментарий и отчёт |
| 4     | Сверстать экран профиля          | На проверке; есть комментарий      |
| 5     | Написать инструкцию пользователя | Свободна и доступна для захвата    |
| 6     | Подключить экран к API           | Ожидает завершения задач 3 и 4     |

Номера сохранены в документах задач и принимаются во всех командах.
Данные находятся в `.tasks/tasks/`, конфигурация — в `tasks.config.json`.

## Попробовать самому

```bash
npm run --silent tasks -- list --ready
npm run --silent tasks -- claim 5 --actor human
npm run --silent tasks -- status 5 in_progress --actor human
npm run --silent tasks -- comment add 5 --text "Начал писать инструкцию" --actor human
npm run --silent tasks -- get 5 --full
```

Проверка целостности:

```bash
npm run --silent tasks -- validate
```
