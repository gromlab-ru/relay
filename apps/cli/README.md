# CLI

Команды и пользовательский вывод находятся в `src/commands`, `src/presentation`
и `src/queries`. Последний каталог содержит CLI-адаптеры чтения и байтовой пагинации.

Операции с документами импортируются из `#core/*`. Команда `server` лениво загружает
Nest bootstrap через `#server`. Все команды публикуются одним bin `tasks-cli`.

Разработка: `npm run dev:cli -- <аргументы>` из корня репозитория.
Пользовательский интерфейс: `npx @gromlab/tasks-cli <аргументы>`.

Тесты приложения: `apps/cli/test`, запуск — `npm run test:cli`.
Dev CLI использует условие `tasks-source` для Core. Nest всегда запускается
из сборки с decorator metadata; перед `dev:cli -- server` выполните `npm run build`.
