import cl from 'clsx'
import type { {{name.pascalCase}}Props } from './types/{{name.kebabCase}}-props.type'
import styles from './styles/{{name.kebabCase}}.module.css'

/**
 * <Назначение компонента {{name.pascalCase}} в одной строке>.
 *
 * Используется для:
 *  - <сценарий применения>
 */
export const {{name.pascalCase}} = (props: {{name.pascalCase}}Props) => {
  const { children, className, ...rootAttrs } = props

  return (
    <div {...rootAttrs} className={cl(styles.root, className)}>
      {children}
    </div>
  )
}
