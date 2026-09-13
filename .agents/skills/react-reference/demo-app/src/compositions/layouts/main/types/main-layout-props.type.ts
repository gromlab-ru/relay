import type { ComponentPropsWithoutRef } from 'react'

/**
 * Параметры основного каркаса.
 */
export type MainLayoutParams = object

/**
 * Атрибуты корневого элемента основного каркаса.
 */
type RootAttrs = Omit<ComponentPropsWithoutRef<'div'>, 'children'>

/**
 * Свойства основного каркаса.
 */
export type MainLayoutProps = RootAttrs & MainLayoutParams
