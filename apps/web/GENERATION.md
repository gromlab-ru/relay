# Журнал создания TSX

## Визуализация контекста — 23 сентября 2026

Из `apps/web` выполнены:

```bash
pnpm run create ui-unit relation-context src/compositions/screens
pnpm run create ui-unit context-canvas src/compositions/screens/relation-context/ui
pnpm run create ui-component context-inspector src/compositions/screens/relation-context/ui
pnpm run create ui-component context-list src/compositions/screens/relation-context/ui
pnpm run create ui-component context-explorer src/compositions/screens/relation-context/ui
pnpm run create ui-component context-node src/compositions/screens/relation-context/ui/context-canvas/ui
pnpm run create ui-component context-edge src/compositions/screens/relation-context/ui/context-canvas/ui
pnpm run create ui-component context-ports-sync src/compositions/screens/relation-context/ui/context-canvas/ui
```

Экран переименован в `relation-context.screen.tsx`, оставлен только lazy-фасет.
Canvas — вложенный юнит экрана, владеет раскладкой и камерой. Карточка и линия —
внутренние компоненты Canvas; инспектор, список и координация — внутренняя реализация
экрана. Компоненты не создают отношения, адаптер и согласованный снимок принадлежат
`domains/relations`. [Досье и проверки](../../docs/work/context-visualization/README.md).

## Библиотека документов — 22 сентября 2026

На первом этапе генератором созданы `document-relations`, его `relation-picker`,
`entity-documents`, `library-navigation` и `document-context`; фактический запуск
зафиксирован в [журнале работы](../../docs/work/project-knowledge-library/JOURNAL.md).
`entity-picker` перенесён из исследователя в общий widget целиком без повторной генерации.
В этом продолжении выполнена команда
`pnpm --filter @relay/web run create ui-unit entity-context src/compositions/widgets`,
но созданный виджет удалён после уточнения границ: просмотр графа не входит в библиотеку.
Последующие правки прикреплений и мобильного читателя изменяли существующие TSX.

## Инфраструктура проекта — 22 сентября 2026

`pnpm --filter @relay/web run create ui-unit infrastructure src/compositions/screens`.
Экран адаптирован в `infrastructure.screen.tsx`: самостоятельная заглушка раздела
через `ui/state-panel`, единственный фасет `lazy.ts`. Начальные props и CSS удалены.

## Исследователь связей — 22 сентября 2026

Из корня выполнены команды `pnpm --filter @relay/web run create ui-component` для
`entity-browser` и `relation-explorer` с владельцем `src/compositions/screens/project-relations/ui`.
Оба компонента внутренние, без фасетов; каталог и группы связываются экраном через callbacks.

## Прогресс карточек приложений — 22 сентября 2026

`pnpm --filter @relay/web run create ui-component application-progress src/compositions/screens/product-applications/ui`.
Внутренний компонент экрана без фасета: два индикатора, загрузка и повтор ошибки.
Сводные данные и синхронизация принадлежат `domains/board-tasks`.

## Проектные фичи и сценарии — 21 сентября 2026

`pnpm --filter @relay/web run create ui-unit product-requirement src/compositions/widgets`.
Общий виджет владеет описанием требования, задачами, контекстом, зависимостями и
реализациями; используется страницами фичи и сценария. Компонент зависимостей первого
этапа перенесён целиком в `compositions/widgets/product-dependencies` и получил фасет;
перенос существующего TSX не требует повторной генерации. Глубокие прежние импорты удалены.

## Страницы реализаций приложений — 21 сентября 2026

Из корня выполнены:

```bash
pnpm --filter @relay/web run create ui-component implementation-details src/compositions/screens/product-entity/ui
pnpm --filter @relay/web run create ui-component implementation-dependencies src/compositions/screens/product-entity/ui
```

Оба компонента — внутренняя реализация product-entity без фасетов. Полное требование
и зависимости загружаются через domains/product и domains/relations; список задач
предоставляет существующий product-tasks. Стили и свойства адаптированы к сценарию чтения.

## Удаление сущностей — 21 сентября 2026

`pnpm --filter @relay/web run create ui-unit entity-delete src/compositions/widgets`.
Общий виджет подтверждения обслуживает страницы продукта и окно задачи. Предметные
сценарии и данные предоставляет domains/entities; каскад вычисляется Core. Неиспользуемая
заготовка CSS удалена, DOM-атрибуты заменены контрактом сущности и перехода после удаления.

`pnpm --filter @relay/web run create ui-component deletion-list src/compositions/widgets/entity-delete/ui`
создаёт внутренний список последствий без фасета. Он используется для обеих групп диалога.

## Обсуждения и история — 21 сентября 2026

При доработке визуального представления по пользовательским скриншотам дополнительно выполнены:

```bash
pnpm --filter @relay/web run create ui-component activity-feed src/compositions/screens/project-board/ui/task-modal/ui/task-activity/ui
pnpm --filter @relay/web run create ui-component discussion-message src/compositions/screens/project-board/ui/task-modal/ui/task-activity/ui
```

ActivityFeed владеет группировкой по дням и общим Mantine Timeline; DiscussionMessage —
текстовым сообщением. Оба — внутренние компоненты TaskActivity без фасетов.

Из корня выполнены:

```bash
pnpm --filter @relay/web run create ui-unit task-activity src/compositions/screens/project-board/ui/task-modal/ui
pnpm --filter @relay/web run create ui-component comment-form src/compositions/screens/project-board/ui/task-modal/ui/task-activity/ui
pnpm --filter @relay/web run create ui-component activity-entry src/compositions/screens/project-board/ui/task-modal/ui/task-activity/ui
pnpm --filter @relay/web run create ui-component activity-change src/compositions/screens/project-board/ui/task-modal/ui/task-activity/ui
pnpm --filter @relay/web run create ui-component activity-value src/compositions/screens/project-board/ui/task-modal/ui/task-activity/ui
```

TaskModal координирует заголовок и три таба. TaskActivity владеет лентой обсуждений/истории,
форма и представления записей — внутренние компоненты без фасетов. Данные, кеш и SSE
принадлежат существующему domains/board-tasks; Markdown — общему UI.

## Критерии приёмки — 21 сентября 2026

Из корня выполнены:

```bash
pnpm --filter @relay/web run create ui-unit task-acceptance src/compositions/screens/project-board/ui/task-modal/ui/task-editor/ui
pnpm --filter @relay/web run create ui-component criterion-form src/compositions/screens/project-board/ui/task-modal/ui/task-editor/ui/task-acceptance/ui
pnpm --filter @relay/web run create ui-component criterion-row src/compositions/screens/project-board/ui/task-modal/ui/task-editor/ui/task-acceptance/ui
```

TaskAcceptance принадлежит редактору задачи; форма и строка — внутренние компоненты
без фасетов. Данные и операции принадлежат domains/board-tasks, Markdown — общему UI.

## Хлебные крошки — 20 сентября 2026

Из корня выполнено:

```bash
pnpm --filter @relay/web run create ui-unit page-breadcrumbs src/compositions/widgets
pnpm --filter @relay/web run create ui-component project-breadcrumbs src/compositions/widgets/page-breadcrumbs/ui
pnpm --filter @relay/web run create ui-component breadcrumb-item src/compositions/widgets/page-breadcrumbs/ui
pnpm --filter @relay/web run create ui-component resolved-breadcrumb src/compositions/widgets/page-breadcrumbs/ui
pnpm --filter @relay/web run create ui-component breadcrumb-link src/compositions/widgets/page-breadcrumbs/ui
```

Общий юнит обслуживает каркас проекта, служебные состояния Relay и окно задачи.
Внутренние компоненты связывают маршрутные метаданные, адресные названия и ссылки;
ненужные CSS-заготовки удалены. Метаданные URL принадлежат `app/router`.

## Последовательные маршруты — 20 сентября 2026

Из корня выполнено:

```bash
pnpm --filter @relay/web run create ui-unit product-snapshot src/compositions/route-boundaries
pnpm --filter @relay/web run create ui-component relay-markdown-link src/compositions/screens/relay/ui
```

`product-snapshot` адаптирован в маршрутную границу с единственным lazy-фасетом.
Внутрь перенесён существующий `product-outlet` вместе с его фасетом; общий ProductLayout
отвечает только за маршрутную область и прокрутку. `relay-markdown-link` — внутренний
адаптер UI-провайдера к React Router. Неиспользуемые заготовки props и CSS удалены.

## Универсальные связи

Из корня выполнено:

```bash
pnpm --filter @relay/web run create ui-unit project-relations src/compositions/screens
pnpm --filter @relay/web run create ui-component relation-editor src/compositions/screens/project-relations/ui
pnpm --filter @relay/web run create ui-component entity-picker src/compositions/screens/project-relations/ui
pnpm --filter @relay/web run create ui-component relation-card src/compositions/screens/project-relations/ui
```

Экран подключён через lazy-фасет. Внутренние формы, поле выбора и карточка принадлежат
экрану; операции и кеш — `domains/relations`. Новый транспорт не создавался.

## Ключи продукта — 20 сентября 2026

Выполнено из корня:

```bash
pnpm --filter @relay/web run create ui-component product-key src/domains/product/ui
pnpm --filter @relay/web run create ui-unit product-entity src/compositions/screens
pnpm --filter @relay/web run create ui-component implementation-editor src/compositions/screens/product-entity/ui
pnpm --filter @relay/web run create ui-unit product-links src/compositions/widgets
```

ProductKey — внутренняя доменная проекция ключа и копирования. ProductEntity — адресный
просмотр сценария/реализации с lazy-фасетом, без загрузки полного продуктового снимка.

## Настройки проекта — 20 сентября 2026

Из корня выполнены команды закреплённого генератора:

```bash
pnpm --filter @relay/web run create ui-unit project-settings src/compositions/screens
pnpm --filter @relay/web run create ui-unit general-settings src/compositions/screens/project-settings/ui
```

Экран адаптирован в project-settings.screen.tsx с единственным lazy-фасетом.
Вложенная форма general-settings получает подтверждённый снимок, владеет вводом
и черновиком, вызывает публичные операции domains/project. Импортов родителя нет.

## Обратные задачи реализации — 19 сентября 2026

Из apps/web: `pnpm run create ui-unit product-tasks src/compositions/widgets`.
Самостоятельный виджет обслуживает страницы фич, сценариев и контрактов приложений,
получает ID цели и читает ограниченный обратный список через domains/board-tasks.
Остальные компоненты карточки и MarkdownField изменены на месте.

## Рабочее окно задачи — 19 сентября 2026

Из `apps/web` выполнено:

```bash
pnpm run create ui-unit task-context src/compositions/screens/project-board/ui/task-modal/ui/task-editor/ui
```

Вложенный юнит отвечает за временный выбор области и чтение контекста. Данные и
варианты выбора предоставляет фасет `domains/product`; готовый SDK используется
через существующий адаптер. Модалка, редактор и связи переработаны на месте.

## Канбан отдельных досок — 19 сентября 2026

Из `apps/web` выполнены:

```bash
pnpm run create ui-unit task-kanban src/compositions/screens/project-board/ui
pnpm run create ui-unit task-column src/compositions/screens/project-board/ui/task-kanban/ui
pnpm run create ui-unit task-card src/compositions/screens/project-board/ui/task-kanban/ui/task-column/ui
pnpm run create ui-unit task-modal src/compositions/screens/project-board/ui
pnpm run create ui-unit task-editor src/compositions/screens/project-board/ui/task-modal/ui
pnpm run create ui-unit task-relations src/compositions/screens/project-board/ui/task-modal/ui/task-editor/ui
```

Вложенные фасеты доступны родителям. Предметные данные предоставляет `domains/board-tasks`.
После первой пользовательской оценки существующие сгенерированные компоненты переработаны:
широкое центральное окно чтения, редактор уже созданной задачи, формы связей по действию,
sortable-карточки и согласованная подгрузка как на прежней доске.

## Множественные доски — 19 сентября 2026

Из `apps/web` выполнено:

```bash
pnpm run create ui-unit project-board src/compositions/screens
```

Экран переименован в `project-board.screen.tsx`, подключён через `lazy.ts`.
Он показывает назначение и колонки доски по slug. Каталог и чтение принадлежат
`domains/boards`; навигация расширена у существующего владельца каркаса проекта.
Неиспользуемые начальные props и статический фасет удалены.

## Библиотека документов — 18 сентября 2026

Из `apps/web` выполнены:

```bash
pnpm run create ui-unit product-documents src/compositions/screens
pnpm run create ui-unit product-document src/compositions/screens
pnpm run create ui-unit product-document-editor src/compositions/screens
pnpm run create ui-component documentation-scopes src/domains/product-demo/ui
pnpm run create ui-unit document-card src/compositions/screens/product-documents/ui
pnpm run create ui-unit documentation-form src/compositions/screens/product-document-editor/ui
pnpm run create ui-unit document-scope-picker src/compositions/screens/product-document-editor/ui/documentation-form/ui
```

Экраны переименованы в `product-documents.screen.tsx`, `product-document.screen.tsx`
и `product-document-editor.screen.tsx`, подключены через собственные `lazy.ts`.
Карточка, форма и выбор моковых областей принадлежат ближайшим экранным владельцам.
`documentation-scopes.tsx` — внутренняя доменная проекция, опубликованная через
`domains/product-demo`. Данные, примеры областей и локальное сохранение находятся
в том же домене. Неиспользуемые типы и стили начальных экранов удалены.

## Состав реализации приложения — 18 сентября 2026

Для единого оформления обоих деревьев дополнительно выполнено:

```bash
pnpm run create ui-unit product-tree-row src/compositions/widgets
```

`src/compositions/widgets/product-tree-row/product-tree-row.tsx` владеет строкой и линиями
двухуровневого дерева. Стили перенесены от `product-features/ui/feature-row`; тот стал
адаптером данных каталога. `application-feature` использует ту же строку для заголовка
вклада, перехода в редактор и отдельной ссылки на исходное описание.

Из `apps/web` выполнены:

```bash
pnpm run create ui-unit application-features src/compositions/screens/product-application/ui
pnpm run create ui-unit product-application-scope src/compositions/screens
pnpm run create ui-component application-feature src/compositions/screens/product-application/ui/application-features/ui
pnpm run create ui-unit application-scope-form src/compositions/screens/product-application-scope/ui
pnpm run create ui-unit scope-tree src/compositions/screens/product-application-scope/ui/application-scope-form/ui
pnpm run create ui-unit scope-editor src/compositions/screens/product-application-scope/ui/application-scope-form/ui
pnpm run create ui-component scope-node src/compositions/screens/product-application-scope/ui/application-scope-form/ui/scope-tree/ui
```

`product-application-scope.tsx` переименован в `product-application-scope.screen.tsx`,
экран подключён через `lazy.ts`. Сгенерированные типы и стили без потребителей удалены.
`application-features` владеет чтением состава; `application-scope-form` — вводом,
черновиком и сохранением. `scope-tree` и `scope-editor` получают проекции и callbacks
от формы. Внутренние `application-feature` и `scope-node` не имеют фасетов.
Операции и целостность ссылок принадлежат `domains/product-demo`.

Прежний `link-fields` удалён: общие редакторы больше не переписывают состав приложения.

## Дерево фич и сценарии — 18 сентября 2026

Из `apps/web` выполнены:

```bash
pnpm run create ui-component product-readiness src/domains/product-demo/ui
pnpm run create ui-unit feature-scenarios src/compositions/screens/product-feature/ui
pnpm run create ui-component scenario-section src/compositions/screens/product-feature/ui/feature-scenarios/ui
```

Созданы и адаптированы:

- `src/domains/product-demo/ui/product-readiness/product-readiness.tsx` — внутренний индикатор
  готовности, опубликованный через фасет домена.
- `src/compositions/screens/product-feature/ui/feature-scenarios/feature-scenarios.tsx` —
  вложенный юнит страницы фичи, владеющий её подразделами и добавлением сценария.
- `src/compositions/screens/product-feature/ui/feature-scenarios/ui/scenario-section/scenario-section.tsx` —
  внутреннее отображение отдельного описания, постоянной ссылки и перехода к редактору.

Дерево использует Mantine Tree и существующий `feature-row`; редактор сценария расширяет
существующий `document-form`. Расчёт статуса принадлежит `domains/product-demo`.

## Вложенная навигация продукта

Из `apps/web` выполнено:

```bash
pnpm run create ui-unit project-navigation src/compositions/layouts/project/ui
```

Создан `src/compositions/layouts/project/ui/project-navigation/project-navigation.tsx`.
Юнит принадлежит существующему `ProjectLayout`, показывает дерево разделов и получает
корень маршрутов проекта и действие завершения выбора. Используется в постоянном
сайдбаре и мобильном Drawer. Через `index.ts` опубликован только компонент.

Навигация и стили адаптированы к Mantine и теме Relay. Дерево URL находится в
`app/router`; подразделы продукта открываются в общем каркасе выбранного проекта.

Для подключения общей области данных и состояний подразделов выполнены:

```bash
pnpm run create ui-unit product src/compositions/layouts
pnpm run create ui-unit product-controls src/compositions/layouts/product/ui
pnpm run create ui-unit product-outlet src/compositions/layouts/product/ui
```

`product.tsx` переименован в `product.layout.tsx` и подключён через `lazy.ts`.
Страницы и редакторы восстановлены из реализации предыдущего прототипа, где они
были созданы следующими командами, а затем адаптированы к проектным URL:

```bash
pnpm run create ui-unit product-passport src/compositions/screens
pnpm run create ui-unit product-features src/compositions/screens
pnpm run create ui-unit product-feature src/compositions/screens
pnpm run create ui-unit product-applications src/compositions/screens
pnpm run create ui-unit product-application src/compositions/screens
pnpm run create ui-unit product-work src/compositions/screens
pnpm run create ui-unit product-editor src/compositions/screens
pnpm run create ui-unit product-page src/compositions/widgets
pnpm run create ui-unit product-contributions src/compositions/widgets
pnpm run create ui-unit product-work-list src/compositions/widgets
pnpm run create ui-component product-demo-provider src/domains/product-demo/providers
pnpm run create ui-component product-status src/domains/product-demo/ui
pnpm run create ui-unit feature-row src/compositions/screens/product-features/ui
pnpm run create ui-unit document-form src/compositions/screens/product-editor/ui
pnpm run create ui-component link-fields src/compositions/screens/product-editor/ui/document-form/ui
pnpm run create ui-unit work-plan src/compositions/widgets/product-work-list/ui
```

У экранов сохранены файлы `product-*.screen.tsx` и фасеты `lazy.ts`.
Внутренние компоненты домена и `link-fields` не имеют собственных фасетов.
Модель моков принадлежит `domains/product-demo`, экземпляр и локальное хранение
теперь ограничены текущим проектом. Отдельный демокаркас удалён.

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
