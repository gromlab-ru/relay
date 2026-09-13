import type { ComponentPropsWithoutRef } from 'react'

/**
 * Параметры экрана кабинета.
 */
export type AccountScreenParams = object

/**
 * Атрибуты корневого элемента кабинета.
 */
type RootAttrs = Omit<ComponentPropsWithoutRef<'section'>, 'children'>

/**
 * Свойства экрана кабинета.
 */
export type AccountScreenProps = RootAttrs & AccountScreenParams
