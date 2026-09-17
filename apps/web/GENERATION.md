# Журнал создания TSX

## Жизненный цикл проекта

Из `apps/web` выполнены команды закреплённого генератора:

```bash
pnpm run create ui-unit project src/compositions/layouts
pnpm run create ui-unit overview src/compositions/screens
pnpm run create ui-unit passport src/compositions/screens
pnpm run create ui-unit plans src/compositions/screens
pnpm run create ui-unit knowledge src/compositions/screens
pnpm run create ui-unit activity src/compositions/screens
pnpm run create ui-unit releases src/compositions/screens
pnpm run create ui-unit history src/compositions/screens
pnpm run create ui-unit project-editor src/compositions/widgets
pnpm run create ui-unit project-record src/compositions/widgets
pnpm run create ui-unit task-lifecycle src/compositions/widgets
pnpm run create ui-component lifecycle-sync src/domains/lifecycle/providers
pnpm run create ui-component record-field src/compositions/widgets/project-editor/ui
pnpm run create ui-component stage-detail src/compositions/screens/plans/ui
pnpm run create ui-unit project-page src/compositions/widgets
pnpm run create ui-unit project-tasks src/compositions/widgets
```

Каркас переименован в `project.layout.tsx`, экраны — в `*.screen.tsx`. Общие сценарии
имеют подтверждённых потребителей в нескольких разделах. `record-field` и `stage-detail`
остались внутренними компонентами ближайших владельцев; провайдер синхронизации
принадлежит `domains/lifecycle`. Неиспользуемые заготовки типов и стилей удалены.
Разделы кроме начального обзора подключаются через `lazy.ts`: доска и её DnD,
история, планы и сопровождение загружаются при открытии соответствующего маршрута.

## Режимы Relay

Из `apps/web` выполнены команды:

```bash
pnpm run create ui-component project-scope src/domains/project/providers
pnpm run create ui-unit relay src/compositions/screens
```

Созданы `src/domains/project/providers/project-scope/project-scope.tsx` и
`src/compositions/screens/relay/relay.screen.tsx` (переименован после генерации).
Провайдер принадлежит домену проекта, экран — выбору проекта и маршрутизации.

Все команды выполнены из `apps/web` через закреплённый CLI:
`npm run create -- ...` (`npx --yes @gromlab/create@0.2.0 --skip-update`).
Общие формы находятся в `.templates`. После генерации типы, разметка, стили и
фасеты адаптированы к ответственности компонентов.

Текущий запуск из корня репозитория: `pnpm --filter @relay/web run create ...`
(`pnpm dlx @gromlab/create@0.2.0 --skip-update`).
Исторические команды ниже приведены без изменений; их пути относятся к `apps/web`.

| Аргументы после `npm run create --`                                                           | Реализация                                                                                           |
| --------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `ui-component theme-provider src/ui/themes/providers`                                         | `src/ui/themes/providers/theme-provider/theme-provider.tsx`                                          |
| `ui-component data-provider src/infra/query-cache/providers`                                  | `src/infra/query-cache/providers/data-provider/data-provider.tsx`                                    |
| `ui-component tasks-sync src/domains/tasks/providers`                                         | `src/domains/tasks/providers/tasks-sync/tasks-sync.tsx`                                              |
| `ui-unit board src/compositions/screens`                                                      | `src/compositions/screens/board/board.screen.tsx` (переименован после генерации)                     |
| `ui-unit workspace-header src/compositions/screens/board/ui`                                  | `src/compositions/screens/board/ui/workspace-header/workspace-header.tsx`                            |
| `ui-unit board-toolbar src/compositions/screens/board/ui`                                     | `src/compositions/screens/board/ui/board-toolbar/board-toolbar.tsx`                                  |
| `ui-unit kanban src/compositions/screens/board/ui`                                            | `src/compositions/screens/board/ui/kanban/kanban.tsx`                                                |
| `ui-unit kanban-column src/compositions/screens/board/ui/kanban/ui`                           | `src/compositions/screens/board/ui/kanban/ui/kanban-column/kanban-column.tsx`                        |
| `ui-component draggable-card src/compositions/screens/board/ui/kanban/ui/kanban-column/ui`    | `src/compositions/screens/board/ui/kanban/ui/kanban-column/ui/draggable-card/draggable-card.tsx`     |
| `ui-unit task-panel src/compositions/screens/board/ui`                                        | `src/compositions/screens/board/ui/task-panel/task-panel.tsx`                                        |
| `ui-unit task-editor src/compositions/screens/board/ui/task-panel/ui`                         | `src/compositions/screens/board/ui/task-panel/ui/task-editor/task-editor.tsx`                        |
| `ui-unit task-relations src/compositions/screens/board/ui/task-panel/ui`                      | `src/compositions/screens/board/ui/task-panel/ui/task-relations/task-relations.tsx`                  |
| `ui-unit task-history src/compositions/screens/board/ui/task-panel/ui`                        | `src/compositions/screens/board/ui/task-panel/ui/task-history/task-history.tsx`                      |
| `ui-unit conflict-review src/compositions/screens/board/ui/task-panel/ui/task-editor/ui`      | `src/compositions/screens/board/ui/task-panel/ui/task-editor/ui/conflict-review/conflict-review.tsx` |
| `ui-unit create-task src/compositions/screens/board/ui`                                       | `src/compositions/screens/board/ui/create-task/create-task.tsx`                                      |
| `ui-component task-card src/domains/tasks/ui`                                                 | `src/domains/tasks/ui/task-card/task-card.tsx`                                                       |
| `ui-component task-picker src/domains/tasks/ui`                                               | `src/domains/tasks/ui/task-picker/task-picker.tsx`                                                   |
| `ui-unit markdown-view src/ui`                                                                | `src/ui/markdown-view/markdown-view.tsx`                                                             |
| `ui-unit markdown-field src/ui`                                                               | `src/ui/markdown-field/markdown-field.tsx`                                                           |
| `ui-unit state-panel src/ui`                                                                  | `src/ui/state-panel/state-panel.tsx`                                                                 |
| `ui-component route-error src/app/router`                                                     | `src/app/router/route-error/route-error.tsx`                                                         |
| `ui-component history-record src/compositions/screens/board/ui/task-panel/ui/task-history/ui` | `src/compositions/screens/board/ui/task-panel/ui/task-history/ui/history-record/history-record.tsx`  |
| `ui-component markdown-checkbox src/ui/markdown-view/ui`                                      | `src/ui/markdown-view/ui/markdown-checkbox/markdown-checkbox.tsx`                                    |

Системные исключения React Reference:

- `src/app/main.tsx` — только запуск React;
- `src/app/app.tsx` — только подключение публичных провайдеров и маршрутизатора;
- `src/app/router/app-router.tsx` — только дерево URL и готовые компоненты.

Панель задачи и создание используют `lazy.ts` вместо начального `index.ts`:
их код и Markdown-редактор загружаются при открытии соответствующего сценария.

## Навигация по группам

Из `apps/web` выполнено:

```bash
pnpm run create ui-unit group-navigation src/compositions/screens/board/ui
```

Создан `src/compositions/screens/board/ui/group-navigation/group-navigation.tsx`.
Юнит принадлежит доске, принимает размеры групп и callback выбора. Через `index.ts`
опубликован только компонент.

## Ссылки Markdown

Из `apps/web` выполнено:

```bash
pnpm run create ui-unit markdown-link src/ui
pnpm run create ui-component task-link src/compositions/screens/board/ui
pnpm run create ui-component markdown-link-provider src/ui/markdown-link/providers
```

- `src/ui/markdown-link/markdown-link.tsx` — универсальное отображение ссылки через настроенный компонент.
- `src/ui/markdown-link/providers/markdown-link-provider/markdown-link-provider.tsx` — настройка ссылок для дерева React, включая порталы.
- `src/compositions/screens/board/ui/task-link/task-link.tsx` — внутренняя реализация маршрутизации ссылок доски через `Link` React Router.

Настройка навигации находится у доски. UI-компонент получает её через Provider;
Markdown-предпросмотр использует тот же контракт. Ненужные CSS Modules удалены.
