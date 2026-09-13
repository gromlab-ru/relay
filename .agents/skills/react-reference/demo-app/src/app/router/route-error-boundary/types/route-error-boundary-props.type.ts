import type { ComponentPropsWithoutRef } from 'react'

/**
 * Параметры границы ошибки маршрута.
 */
export type RouteErrorBoundaryParams = object

/**
 * Атрибуты корневого элемента страницы ошибки.
 */
type RootAttrs = Omit<ComponentPropsWithoutRef<'main'>, 'children'>

/**
 * Свойства границы ошибки маршрута.
 */
export type RouteErrorBoundaryProps = RootAttrs & RouteErrorBoundaryParams
