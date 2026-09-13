import type { ComponentPropsWithoutRef } from 'react'

/**
 * Параметры экрана неизвестного адреса.
 */
export type NotFoundScreenParams = object

/**
 * Атрибуты корневого элемента экрана.
 */
type RootAttrs = Omit<ComponentPropsWithoutRef<'section'>, 'children'>

/**
 * Свойства экрана неизвестного адреса.
 */
export type NotFoundScreenProps = RootAttrs & NotFoundScreenParams
