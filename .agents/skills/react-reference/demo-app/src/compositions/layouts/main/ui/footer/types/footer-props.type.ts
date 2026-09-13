import type { ComponentPropsWithoutRef } from 'react'

/**
 * Параметры нижней панели основного каркаса.
 */
export type FooterParams = object

/**
 * Атрибуты корневого элемента нижней панели.
 */
type RootAttrs = Omit<ComponentPropsWithoutRef<'footer'>, 'children'>

/**
 * Свойства нижней панели основного каркаса.
 */
export type FooterProps = RootAttrs & FooterParams
