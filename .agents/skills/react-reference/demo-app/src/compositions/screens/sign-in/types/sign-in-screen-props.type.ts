import type { ComponentPropsWithoutRef } from 'react'

/**
 * Параметры экрана входа.
 */
export type SignInScreenParams = object

/**
 * Атрибуты корневого элемента экрана входа.
 */
type RootAttrs = Omit<ComponentPropsWithoutRef<'section'>, 'children'>

/**
 * Свойства экрана входа.
 */
export type SignInScreenProps = RootAttrs & SignInScreenParams
