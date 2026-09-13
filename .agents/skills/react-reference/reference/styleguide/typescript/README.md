# TypeScript

Применяй этот документ к `.ts` и TypeScript-частям `.tsx`. Он определяет TypeScript-конструкции, typing, narrowing,
именование значений и типов, проверки во время выполнения и JSDoc. Проектные правила форматирования, файлов и границ
модулей определяет [общий styleguide](../README.md).

## Объявления и функции

- Используй `const` по умолчанию.
- Используй `let` только когда переменная действительно переназначается.
- Не используй `var`.
- Не изменяй входной object или array, если mutation не является явной частью контракта.
- Декомпозируй функцию, когда она одновременно решает несколько независимых задач.
- Не скрывай важный side effect за именем, похожим на чистое вычисление.
- Не добавляй generic, если функция не связывает несколько типов и обычный конкретный тип выражает контракт точнее.

```ts
/**
 * Возвращает отображаемое имя пользователя.
 */
const getDisplayName = (user: User): string => user.displayName
```

## Ранние возвраты и ветвление

- Используй ранние возвраты для отсутствующих данных, ошибок, запрещённых состояний и других guard conditions.
- Сначала обрабатывай исключающие условия, затем размещай основной сценарий функции.
- Не добавляй `else` после ветки с безусловным `return` или `throw`.
- Не оборачивай основной сценарий в несколько уровней `if`, если вложенность можно заменить guard clauses.
- Используй guard clauses для narrowing `null`, `undefined` и неподходящих вариантов union.
- После проверки полагайся на control-flow narrowing, а не обходи её через `as` или non-null assertion `!`.
- Не добавляй ранние возвраты механически, если линейное условие читается проще.

```ts
/**
 * Возвращает имя доступного активного пользователя.
 */
const getUserName = (user?: User): string => {
  if (!user) {
    return 'Гость'
  }

  if (!user.isActive) {
    return 'Неактивный пользователь'
  }

  return user.name
}
```

## Именование значений

- Переменные и функции называй в `camelCase`.
- Классы, types и interfaces называй в `PascalCase`.
- Custom hooks называй в форме `useSomething`.
- Arrays называй во множественном числе.
- Списки идентификаторов называй `*Ids`.
- Словари и maps называй `*ById`, `*Map` или `*Dict`.
- Boolean-значения начинай с `is`, `has`, `can` или `should`.
- Внутренние handlers называй `handle*`.
- Callback-параметры и properties называй `on*`.
- Функция должна называться по выполняемому действию или возвращаемому значению.
- Type guard называй через `is*`, assertion function через `assert*`.
- Избегай общих имён `data`, `item`, `value`, `result`, если роль можно выразить точнее.

```ts
const userIds: string[] = ['u1', 'u2']
const usersById: Record<string, User> = {}
const isReady = true

/**
 * Обрабатывает отправку формы.
 *
 * Запускает сохранение подготовленных данных.
 */
const handleSubmit = (): void => {
  // ...
}
```

## Типизация функций и API

- Типизируй параметры функций и компонентов.
- Для публичных функций указывай возвращаемый тип.
- Для локальной реализации используй inference, когда тип очевиден и не является контрактом.
- Не дублируй выводимый тип локальной переменной явной аннотацией без причины.
- Не используй широкий тип, если контракт допускает точный literal union или конкретную структуру.
- Не открывай internal type через публичную сигнатуру случайно.
- Асинхронный публичный контракт выражай как `Promise<Result>` с конкретным типом результата.
- Callback типизируй по его назначению, а не через общий `Function`.

```ts
/**
 * Загружает пользователя по идентификатору.
 */
export const getUser = async (userId: string): Promise<User> => {
  const response = await userApi.getUser(userId)

  return response.user
}
```

## Type и interface

- Используй `type` для props, DTO, view models, unions, mapped types и композиции.
- Используй `interface` для расширяемых контрактов и declaration merging.
- Не смешивай `type` и `interface` для одной категории сущностей без причины.
- Не создавай отдельный alias, если он не добавляет смысл и используется один раз в очевидной позиции.
- Не используй `enum`, если нужен обычный runtime-набор строковых или числовых значений.

```ts
/** Свойства карточки пользователя. */
export type UserCardProps = {
  /** Отображаемый пользователь. */
  user: User
  /** Вызывается при выборе пользователя. */
  onSelect: (userId: string) => void
}

/** Хранилище строковых значений. */
export interface StorageAdapter {
  /** Возвращает сохранённое значение. */
  get(key: string): Promise<string | null>
  /** Сохраняет значение по ключу. */
  set(key: string, value: string): Promise<void>
}
```

## Type-only imports и exports

- Импортируй сущность только для типов через `import type`.
- Экспортируй только тип через `export type`.
- Не меняй value import на type import, если сущность нужна в runtime.
- При включённом `verbatimModuleSyntax` не полагайся на удаление ошибочного value import компилятором.

```ts
import { createUser } from './create-user'
import type { User } from './user.type'

export { UserCard } from './user-card'
export type { UserCardProps } from './types/user-card-props.type'
```

## Unknown, any и assertions

- Не используй `any` как обычный тип.
- Оставляй `any` только на неизбежной интеграционной границе с объяснимой причиной.
- Принимай внешние и недоверенные данные как `unknown`, затем сужай тип runtime-проверкой.
- Не используй `as` для обхода type checker.
- Assertion допустим после runtime-валидации или на границе с явно описанной причиной.
- Не используй non-null assertion `!`, если наличие значения можно доказать guard clause.
- Используй `as const` для литеральных конфигураций и enum-like объектов.
- Вместо `@ts-ignore` используй `@ts-expect-error` с объяснением причины, если suppression действительно необходим.
- Удаляй suppression вместе с устранением несовместимости.

## Runtime-данные и predicates

TypeScript types не проверяют runtime-данные. Валидируй ответы API, storage, URL, user input, parsed JSON и другие
внешние значения до использования.

- Для повторяемой проверки создавай именованный predicate с type predicate `value is Type`.
- Базовые predicates ограничивай проверками nullish, primitives, strings, arrays, records и literal unions.
- Domain guards, например `isOrder` или `isCity`, размещай рядом с владельцем данных.
- Для массива из внешнего `unknown` проверяй и сам array, и каждый его element.
- Перед чтением fields object-like `unknown` проверь, что это record, затем наличие собственного property.
- Не смешивай отсутствие значения с falsy-значениями: `0`, `false` и `''` могут быть валидными.
- Прямой `.length` используй, когда нужен размер, индексный цикл или проверка длины string.

```ts
/**
 * Проверяет runtime-значение на соответствие заказу.
 */
const isOrder = (value: unknown): value is Order => {
  return isRecord(value) && hasOwn(value, 'id') && isString(value.id)
}

if (isArrayOf(response.data, isOrder)) {
  // response.data: Order[]
}
```

Если проект не предоставляет эквивалентную базовую библиотеку, используй готовую реализацию из
[`value-predicates/README.md`](value-predicates/README.md). Основной код импортирует её только через public API.

## Константы и literal types

- Обычную локальную переменную, объявленную через `const`, называй в `camelCase`.
- Переиспользуемую константу верхнего уровня называй в `SCREAMING_SNAKE_CASE`.
- Связанный набор стабильных runtime-значений группируй в объект с `as const`.
- Ключи enum-like объекта называй в `SCREAMING_SNAKE_CASE`.
- Runtime-значения сохраняют формат контракта и не обязаны повторять регистр ключей.
- Выводи literal union из объекта, а не дублируй значения вручную.
- Не переименовывай непрозрачные значения внешнего API ради code style.
- Error codes, statuses, modes, event types и feature flags являются частными случаями этого паттерна.

```ts
/**
 * Поддерживаемые состояния оплаты.
 */
export const PAYMENT_STATUS = {
  /**
   * Оплата ожидает подтверждения.
   */
  PENDING: 'pending',
  /**
   * Оплата подтверждена.
   */
  PAID: 'paid',
  /**
   * Оплата завершилась ошибкой.
   */
  FAILED: 'failed'
} as const

/** Состояние оплаты. */
export type PaymentStatus = (typeof PAYMENT_STATUS)[keyof typeof PAYMENT_STATUS]
```

## JSDoc

Каждая именованная TypeScript-функция и каждый класс имеют многострочный JSDoc непосредственно перед объявлением.
Правило распространяется на function declarations, именованные function expressions, arrow functions в именованной
переменной, handlers и custom hooks.

Каждый `type`, `interface`, `enum` и каждое их поле или значение имеют однострочный JSDoc вида `/** Описание. */`.
Размещай комментарий непосредственно перед объявлением, полем или значением, без переносов внутри `/** ... */`.
Правило действует также для внутренних псевдонимов и полей.

Константу документируй, если это публичный контракт, предметное ограничение, неочевидное значение или переиспользуемая
конфигурация.

Правило относится к исходному коду команды, включая заготовки `@gromlab/create`, которые после создания редактируются
по [`инструкции генерации TSX`](../../application/components/tsx-generation.md). Не редактируй ради JSDoc файлы, полностью
принадлежащие другим генераторам: их оформление определяется инструментом, а каталог заменяется при повторном создании.

- Описывай назначение и ограничения сущности, а не синтаксис реализации.
- Не дублируй TypeScript-сигнатуру через `@param`, `@returns` и `@type`.
- Добавляй важную механику и результат только когда они неочевидны из имени и сигнатуры.
- Не документируй обычные локальные variables и очевидные inline callbacks.
- Не используй фиксированный шаблон и не раздувай простое описание обязательными секциями.

```ts
/** Фильтры списка заказов. */
export type OrderFilters = {
  /** Идентификатор владельца заказов. */
  userId?: string
  /** Статус заказа для фильтрации. */
  status?: OrderStatus
}
```

## Проверка

- Functions, values, collections, booleans, handlers и types названы по роли.
- Для неизменяемых bindings используется `const`, а `let` применяется только при переназначении.
- Guard conditions обеспечивают narrowing без необоснованных assertions и non-null assertions.
- Public contracts типизированы явно, локальные annotations не дублируют inference.
- `type` и `interface` используются последовательно по назначению.
- Type-only imports и exports оформлены явно.
- `any`, `unknown`, assertions и suppressions имеют конкретное обоснование.
- Runtime-данные проверяются predicates до использования, domain guards принадлежат владельцам.
- Runtime-наборы значений объявлены один раз, а literal types выведены из них.
- Именованные функции, классы и TypeScript-контракты имеют достаточный JSDoc.
- Типы, интерфейсы, перечисления и их поля или значения используют однострочный JSDoc вида `/** Описание. */`.
