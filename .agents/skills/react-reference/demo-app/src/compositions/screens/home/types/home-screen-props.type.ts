import type { ComponentPropsWithoutRef } from 'react'

/**
 * Параметры стартового экрана.
 */
export type HomeScreenParams = object

/**
 * Атрибуты корневого элемента стартового экрана.
 */
type RootAttrs = Omit<ComponentPropsWithoutRef<'section'>, 'children'>

/**
 * Свойства стартового экрана.
 */
export type HomeScreenProps = RootAttrs & HomeScreenParams
