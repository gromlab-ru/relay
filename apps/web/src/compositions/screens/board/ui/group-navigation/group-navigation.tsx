import clsx from "clsx";
import { useEffect, useRef } from "react";
import type { GroupNavigationProps } from "./types/group-navigation-props.type";
import styles from "./styles/group-navigation.module.css";

/**
 * Показывает группы проекта и их полный размер независимо от фильтров карточек.
 *
 * Используется для:
 *  - быстрого перехода между областями работы, включая задачи без группы
 */
export const GroupNavigation = (props: GroupNavigationProps) => {
  const { groups, selectedGroup, onSelect, className, ...rootAttrs } = props;
  const listRef = useRef<HTMLDivElement>(null);
  const selectedRef = useRef<HTMLButtonElement>(null);
  const groupsData = groups ?? [];
  const groupItems = groupsData.map(({ group, count }) => ({
    group,
    count,
    label: group ?? "Без группы",
    key: JSON.stringify(group),
    isSelected: group === selectedGroup,
    ref: group === selectedGroup ? selectedRef : undefined,
  }));
  const hasMissingGroup =
    groups !== undefined &&
    selectedGroup !== undefined &&
    !groupsData.some(({ group }) => group === selectedGroup);
  if (hasMissingGroup) {
    groupItems.push({
      group: selectedGroup,
      count: 0,
      label: selectedGroup ?? "Без группы",
      key: JSON.stringify(selectedGroup),
      isSelected: true,
      ref: selectedRef,
    });
  }
  const isAll = selectedGroup === undefined;
  const allRef = isAll ? selectedRef : undefined;
  const totalLabel =
    groups === undefined ? "…" : groups.reduce((total, group) => total + group.count, 0);
  const groupCount = groupItems.length;

  useEffect(() => {
    const list = listRef.current;
    const selected = selectedRef.current;
    if (list === null || selected === null) return;
    // Открытие прямой ссылки раскрывает выбранную группу, не двигая страницу по вертикали.
    list.scrollLeft = selected.offsetLeft;
  }, [selectedGroup, groupCount]);

  return (
    <nav {...rootAttrs} className={clsx(styles.root, className)} aria-label="Группы задач">
      <div className={styles.list} ref={listRef}>
        <button
          ref={allRef}
          type="button"
          className={clsx(styles.item, isAll && styles._active)}
          aria-pressed={isAll}
          onClick={() => onSelect(undefined)}
        >
          Все группы
          <span className={styles.count}>{totalLabel}</span>
        </button>
        {groupItems.map(({ group, count, label, key, isSelected, ref }) => (
          <button
            key={key}
            ref={ref}
            type="button"
            className={clsx(styles.item, isSelected && styles._active)}
            aria-pressed={isSelected}
            title={label}
            onClick={() => onSelect(group)}
          >
            <span className={styles.label}>{label}</span>
            <span className={styles.count}>{count}</span>
          </button>
        ))}
      </div>
    </nav>
  );
};
