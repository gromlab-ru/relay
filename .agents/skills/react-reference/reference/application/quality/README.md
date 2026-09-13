# Quality React SPA

Quality объединяет правила обработки failures и проверки изменяемого кода. Общую классификацию ошибок применяй по
[`failure-handling.md`](failure-handling.md), предметные expected errors — по
[`architecture/units/domains/errors.md`](../architecture/units/domains/errors.md).

## Failure handling

- Ожидаемый результат операции отображается в контексте пользовательского действия.
- Известный source error преобразуется в предметную ошибку внутри domain adapter.
- Неизвестный технический сбой становится application defect и передаётся ближайшей подходящей boundary.
- Error boundary не заменяет локальное отображение ожидаемой ошибки формы или action.
- Transport details, DTO и raw source errors не показываются consumer.

Рабочий пример общей ошибки приложения находится в
[`demo-app/src/shared/errors/`](../../../demo-app/src/shared/errors/). Её отображение на границе маршрутов показывает
[`RouteErrorBoundary`](../../../demo-app/src/app/router/route-error-boundary/route-error-boundary.tsx).

## Проверки

Используй scripts и конфигурацию проекта. Для изменяемого кода выполняй все относящиеся к нему проверки:

1. Formatting.
2. Linting.
3. TypeScript typecheck.
4. Существующие tests, покрывающие изменяемое поведение.
5. Production build для изменений build pipeline, assets, environment или module graph.

Vitest является default test runner. Не добавляй новый testing stack и вспомогательные библиотеки без отдельной необходимости.

Не отключай правила, не ослабляй типы и не подавляй ошибки вместо исправления причины.

## Новые TSX

Для каждого нового `.tsx` в приложении проверь соблюдение [`правил создания TSX`](../components/tsx-generation.md):

- Файл создан через `npx @gromlab/create` либо соответствует одному из указанных исключений; само размещение в `app`
  исключением не является.
- У компонента есть собственная папка; самостоятельный юнит имеет фасет, внутренний компонент остаётся без фасета.
- Результат `ui-component` или `ui-unit` адаптирован в том же изменении: ненужные типы, стили и `RootAttrs` удалены.

Статическая проверка структуры не доказывает запуск CLI. В отчёте по новым `.tsx` укажи фактически выполненную команду
генерации и путь каждого файла; для исключения укажи путь и основание.
