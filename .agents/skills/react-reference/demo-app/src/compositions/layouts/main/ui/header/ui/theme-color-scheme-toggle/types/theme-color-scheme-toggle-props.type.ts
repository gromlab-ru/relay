import type { ComponentPropsWithoutRef } from 'react'

/**
 * Параметры переключателя цветовой схемы.
 */
export type ThemeColorSchemeToggleParams = object

/**
 * Атрибуты корневой кнопки переключателя.
 */
type RootAttrs = Omit<ComponentPropsWithoutRef<'button'>, 'aria-label' | 'children' | 'onClick'>

/**
 * Свойства переключателя цветовой схемы.
 */
export type ThemeColorSchemeToggleProps = RootAttrs & ThemeColorSchemeToggleParams
