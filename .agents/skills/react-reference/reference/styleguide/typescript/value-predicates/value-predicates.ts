/**
 * Исключает только null и undefined из типа значения.
 *
 * Сохраняет валидные falsy-значения, включая 0, false и пустую строку.
 */
export const isDefined = <T>(value: T | null | undefined): value is T => {
  return value != null
}

/**
 * Проверяет, что значение равно null или undefined.
 *
 * Не считает отсутствующими другие falsy-значения.
 */
export const isNotDefined = <T>(value: T | null | undefined): value is null | undefined => {
  return value == null
}

/**
 * Сужает unknown-значение до string.
 *
 * Проверяет только runtime-тип без требований к содержимому строки.
 */
export const isString = (value: unknown): value is string => {
  return typeof value === 'string'
}

/**
 * Сужает unknown-значение до конечного number.
 *
 * Исключает NaN, Infinity и значения других runtime-типов.
 */
export const isNumber = (value: unknown): value is number => {
  return typeof value === 'number' && Number.isFinite(value)
}

/**
 * Сужает unknown-значение до boolean.
 *
 * Принимает только литеральные значения true и false.
 */
export const isBoolean = (value: unknown): value is boolean => {
  return typeof value === 'boolean'
}

/**
 * Проверяет, что значение является непустой непробельной строкой.
 *
 * Считает строку из одних пробельных символов пустой.
 */
export const isNonEmptyString = (value: unknown): value is string => {
  return typeof value === 'string' && value.trim().length > 0
}

/**
 * Проверяет, что значение является массивом без проверки элементов.
 *
 * Для проверки формы элементов используй isArrayOf.
 */
export const isArray = (value: unknown): value is unknown[] => {
  return Array.isArray(value)
}

/**
 * Проверяет массив и каждый его элемент переданным type guard.
 *
 * Сужает unknown до массива элементов подтверждённого типа.
 */
export const isArrayOf = <T>(value: unknown, isItem: (item: unknown) => item is T): value is T[] => {
  return Array.isArray(value) && value.every(isItem)
}

/**
 * Считает null, undefined и массив без элементов пустым списком.
 *
 * Предназначен для UI-условий с единым empty state.
 */
export const isEmptyArray = (value: readonly unknown[] | null | undefined): boolean => {
  return !Array.isArray(value) || value.length === 0
}

/**
 * Сужает существующий массив до non-empty tuple.
 *
 * Гарантирует наличие первого элемента после успешной проверки.
 */
export const isNonEmptyArray = <T>(value: readonly T[] | null | undefined): value is readonly [T, ...T[]] => {
  return Array.isArray(value) && value.length > 0
}

/**
 * Проверяет object-like значение, исключая null и массивы.
 *
 * Не проверяет конкретные поля полученной записи.
 */
export const isRecord = (value: unknown): value is Record<PropertyKey, unknown> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Проверяет наличие собственного свойства объекта и сужает его тип.
 *
 * Используется после проверки object-like значения через isRecord.
 */
export const hasOwn = <K extends PropertyKey>(value: object, key: K): value is Record<K, unknown> => {
  return Object.prototype.hasOwnProperty.call(value, key)
}

/**
 * Проверяет вхождение значения в readonly-список допустимых литералов.
 *
 * Сужает unknown до union элементов переданного списка.
 */
export const isOneOf = <T extends readonly unknown[]>(value: unknown, values: T): value is T[number] => {
  return values.some((item) => item === value)
}
