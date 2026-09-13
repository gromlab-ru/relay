import type { ComponentPropsWithoutRef } from 'react'

/**
 * Параметры верхней панели основного каркаса.
 */
export type HeaderParams = object

/**
 * Атрибуты корневого элемента верхней панели.
 */
type RootAttrs = Omit<ComponentPropsWithoutRef<'header'>, 'children'>

/**
 * Свойства верхней панели основного каркаса.
 */
export type HeaderProps = RootAttrs & HeaderParams
