# Value Predicates

Базовая библиотека runtime predicates для безопасной работы с `unknown`, `null`, primitives, arrays и objects.
Используй её, когда проекту нужны повторяемые базовые проверки, а эквивалентной общей библиотеки ещё нет.

## Подключение

Скопируй каталог в общий library-слой проекта:

```text
shared/lib/value-predicates/
├── index.ts
└── value-predicates.ts
```

Адаптируй только абсолютный путь к архитектуре проекта. Сохрани `index.ts` как public API и импортируй predicates
через корень модуля:

```ts
import { hasOwn, isArrayOf, isRecord, isString } from 'shared/lib/value-predicates'
```

Не импортируй `value-predicates.ts` глубоким путём и не создавай второй набор эквивалентных helpers.

## Состав библиотеки

| Группа | Predicates |
| --- | --- |
| Nullish | `isDefined`, `isNotDefined` |
| Primitives | `isString`, `isNumber`, `isBoolean` |
| Strings | `isNonEmptyString` |
| Arrays | `isArray`, `isArrayOf`, `isEmptyArray`, `isNonEmptyArray` |
| Objects | `isRecord`, `hasOwn` |
| Literal unions | `isOneOf` |

Библиотека содержит только универсальные проверки runtime-формы. Не добавляй сюда domain guards для DTO, API models
и бизнес-сущностей. Размещай `isOrder`, `isCity` и аналогичные predicates рядом с владельцем соответствующих данных.

## Выбор predicate

| Сценарий | Predicate |
| --- | --- |
| Исключить `null` и `undefined`, сохранив `0`, `false` и `''` | `isDefined` |
| Проверить `null` или `undefined` | `isNotDefined` |
| Проверить конечный number | `isNumber` |
| Проверить непустую непробельную string | `isNonEmptyString` |
| Проверить непустой typed array | `isNonEmptyArray` |
| Показать empty state для `null`, `undefined` или `[]` | `isEmptyArray` |
| Проверить array из внешнего `unknown` | `isArrayOf(value, itemGuard)` |
| Прочитать property неизвестного object | `isRecord` + `hasOwn` + predicate поля |
| Проверить значение literal union | `isOneOf` |

Прямой `.length` допустим, когда нужен числовой размер, проверка длины string или индексный цикл. Для boolean-решения
о пустом списке используй `isEmptyArray` или `isNonEmptyArray`.

## Domain guard

Собирай domain predicate из базовых проверок рядом с владельцем данных:

```ts
/**
 * Проверяет runtime-значение на соответствие заказу.
 */
const isOrder = (value: unknown): value is Order => {
  return (
    isRecord(value) &&
    hasOwn(value, 'id') &&
    isString(value.id) &&
    hasOwn(value, 'title') &&
    isString(value.title)
  )
}

if (isArrayOf(response.data, isOrder)) {
  // response.data: Order[]
}
```

Не заменяй runtime-проверку assertion через `as`. Type guard должен проверить каждое поле, на котором основан
суженный тип.

## Проверка

- Библиотека добавлена только при отсутствии эквивалентного общего решения.
- Consumers импортируют predicates через `shared/lib/value-predicates`.
- Базовые predicates не содержат domain knowledge.
- Domain guards размещены рядом с владельцами данных.
- `unknown` сужается runtime-проверкой до чтения и использования полей.
- Валидные falsy-значения не смешиваются с `null` и `undefined`.
