import type { ComponentPropsWithoutRef } from 'react'

/**
 * Параметры состояния ожидания маршрута.
 */
export type RoutePendingParams = object

/**
 * Атрибуты корневого элемента состояния ожидания.
 */
type RootAttrs = Omit<ComponentPropsWithoutRef<'div'>, 'children'>

/**
 * Свойства состояния ожидания маршрута.
 */
export type RoutePendingProps = RootAttrs & RoutePendingParams
