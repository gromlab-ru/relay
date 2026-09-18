import clsx from "clsx";
import { AppWindow, Box, GitBranch, Link2, Sparkles } from "lucide-react";
import { isEmptyArray } from "shared/value-predicates";
import { DOCUMENTATION_SCOPE_MOCKS } from "../../config/documentation.config";
import type { DocumentationScopesProps } from "./types/documentation-scopes-props.type";
import styles from "./styles/documentation-scopes.module.css";

/**
 * Показывает визуальные примеры областей документа, не создавая переходов к сущностям.
 *
 * Используется для:
 *  - компактных меток в каталоге и полного контекста при чтении
 */
export const DocumentationScopes = (props: DocumentationScopesProps) => {
  const { scopeIds, limit = scopeIds.length, isDetailed = false, className, ...rootAttrs } = props;
  const scopeItems = DOCUMENTATION_SCOPE_MOCKS.filter((scope) => scopeIds.includes(scope.id));
  const visibleItems = scopeItems.slice(0, limit).map((scope) => ({
    ...scope,
    Icon:
      scope.group === "application"
        ? AppWindow
        : scope.kind === "Продукт"
          ? Box
          : scope.kind === "Фича"
            ? Sparkles
            : GitBranch,
    label:
      scope.group === "application" && scope.kind !== "Приложение"
        ? `${scope.path.split(" / ")[0]} · ${scope.name}`
        : scope.name,
  }));
  const remainingCount = scopeItems.length - visibleItems.length;
  const hasMore = remainingCount > 0;
  const hasNoScopes = isEmptyArray(scopeItems);
  return (
    <div {...rootAttrs} className={clsx(styles.root, isDetailed && styles._detailed, className)}>
      {visibleItems.map((scope) => (
        <span
          key={scope.id}
          className={styles.scope}
          title={`${scope.kind}: ${scope.path} / ${scope.name}`}
        >
          <scope.Icon size={14} aria-hidden="true" className={styles.icon} />
          <span className={styles.text}>
            <span className={styles.name}>{scope.label}</span>
            {isDetailed && (
              <span className={styles.context}>
                {scope.kind} · {scope.path}
              </span>
            )}
          </span>
        </span>
      ))}
      {hasMore && (
        <span className={styles.more} aria-label={`Ещё связей: ${remainingCount}`}>
          +{remainingCount}
        </span>
      )}
      {hasNoScopes && (
        <span className={styles.empty}>
          <Link2 size={13} aria-hidden="true" />
          Без связей
        </span>
      )}
    </div>
  );
};
