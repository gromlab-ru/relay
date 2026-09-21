# Relay Web

[Продуктовый контракт](../../docs/product/applications/web/README.md) ·
[Состояние реализации](../../docs/engineering/implementation/applications.md) ·
[Протокол](../../docs/development/PROTOCOL.md).

[Карта страниц и маршрутов](ROUTING.md) — действующие URL, переходы, совместимость и контекст.

React SPA на TypeScript/Vite: Mantine, SWR, dnd-kit, Markdown и CodeMirror.
Действующие разделы — продукт, доски и задачи, связи, настройки проекта.
Обзор, планы, релизы и история показывают «В разработке».
Прежняя числовая доска и скрытые страницы удалены вместе с их доменами и запросами.

## Разработка

Из корня репозитория, Node.js 24:

```bash
pnpm install --frozen-lockfile
pnpm run dev
```

Отдельный Web: `pnpm run dev:web`; API запускается `pnpm run dev:server`.
Vite по умолчанию слушает 5173 и проксирует `/api` на 4700. `RELAY_API_URL` меняет
адрес API, `RELAY_WEB_PORT` — порт Web. Серверный npm-дистрибутив содержит готовый
`apps/web/dist`, отдельный Vite нужен только при разработке.

## Архитектура

Область React SPA — `apps/web/src`; Unit Architecture, фасеты `index.ts` и `lazy.ts`,
алиасы слоёв без `@`. Вложенные юниты доступны непосредственному родителю;
ребёнок не импортирует родителя или соседних детей. Граф зависимостей ацикличен.
Группы `compositions/screens`, `layouts`, `widgets` содержат экраны, каркасы и самостоятельные области.
Внутренние сегменты `ui`, `hooks`, `types`, `styles`, `helpers`, `config`, `adapters`
колоцируются у владельца; фасет объявляет отдельный юнит.

| Владелец                                 | Ответственность                                               |
| ---------------------------------------- | ------------------------------------------------------------- |
| app/router                               | Вложенные URL и техническая интеграция                        |
| compositions/screens/relay               | Выбор проекта и область ProjectScope                          |
| compositions/layouts/project             | Общая шапка, навигация и Outlet                               |
| compositions/widgets/page-breadcrumbs    | Путь страницы, адресные названия и адаптивное меню родителей  |
| domains/project                          | Настройки, постоянный ID, путь по slug и индикатор соединения |
| domains/workspace                        | Режим и реестр сервера                                        |
| domains/product                          | Постоянные продуктовые данные, операции и кеш                 |
| domains/product-demo                     | Адаптер действующего продуктового интерфейса                  |
| domains/boards, domains/board-tasks      | Каталог досок, канбан и записи задач                          |
| domains/entities, domains/relations      | Общий каталог, резолвер, отношения и контекст                 |
| compositions/screens/project-board       | Канбан и центральное окно задачи                              |
| infra/tasks-api                          | Неизменяемые проектные клиенты общего SDK                     |
| infra/workspace-events                   | Разделяемый EventSource и восстановление подключения          |
| ui/kanban-dnd                            | Универсальные helpers переноса                                |
| ui/markdown-*, ui/themes, ui/state-panel | Markdown, темы и состояния интерфейса                         |

Алиасы определены в tsconfig, Vite читает их через resolve.tsconfigPaths. Браузерный
ESNext/Bundler-профиль не наследует NodeNext серверных пакетов. SDK принадлежит
[rest-sdk](../../packages/rest-sdk/README.md), вручную не редактируется.
Новые TSX создаются генератором по [инструкции](GENERATION.md).

## Поведение и проверка

Постоянный маршрут задачи — `/projects/:project/boards/:boardSlug/:taskId`.
Перенос сохраняет ID, модальное окно и связи; старые адреса новых задач `/tasks/:id`
канонизируются. Пустое создание сразу сохраняет задачу. Колонки подгружают по 40,
локальная проекция DnD согласуется с сервером. Черновики изолированы по проекту и вкладке;
ошибка или внешняя запись не затирают ввод. Общие helpers переноса сохраняются.

```bash
pnpm run lint:web
pnpm run typecheck:web
pnpm run build:web
```

Корневые команды собирают зависимости через Turbo. Для прямых команд workspace
сначала соберите Contracts и SDK. Автотесты Web не добавляются: сценарии проверяются
через agent-browser в собственной headless-сессии и на временной базе.
Обе темы, ширины 1440/1024/768/390, клавиатура, ошибки сети и конфликты — по [AGENTS.md](AGENTS.md).
При SSE ожидайте конкретный результат, а не networkidle. Закрывайте только свои процессы.
Результаты приёмки фиксируются в досье; сборка не заменяет браузерную проверку.
