import clsx from "clsx";
import { useState } from "react";
import { ActionIcon, Button, Checkbox, Popover, Select, Stack, TextInput } from "@mantine/core";
import { ListFilter, Search, X } from "lucide-react";
import { BOARD_FILTERS_SCHEMA } from "domains/tasks";
import type { BoardToolbarProps } from "./types/board-toolbar-props.type";
import styles from "./styles/board-toolbar.module.css";

/**
 * Помогает найти нужную работу и показывает действующие ограничения выборки.
 *
 * Используется для:
 *  - поиска по всему содержимому задач и фильтрации доски
 */
export const BoardToolbar = (props: BoardToolbarProps) => {
  const { filters, board, actor, onChange, className, ...rootAttrs } = props;
  const [isOpen, setOpen] = useState(false);
  const count = [
    filters.group,
    filters.assignee,
    filters.tag,
    filters.blocked,
    filters.unassigned,
  ].filter(Boolean).length;
  const hasFilters = count > 0 || filters.search !== "";
  const isMine = filters.assignee === actor;
  const isAll = !isMine && !filters.blocked;
  const filterLabel = count > 0 ? `Фильтры · ${count}` : "Фильтры";
  const totalLabel = board === undefined ? "Загружаем…" : `${board.total} задач`;
  return (
    <div {...rootAttrs} className={clsx(styles.root, className)}>
      <div className={styles.tabs} role="group" aria-label="Быстрые фильтры">
        <button
          type="button"
          className={clsx(styles.tab, isAll && styles._active)}
          aria-pressed={isAll}
          onClick={() => onChange({ ...filters, assignee: "", blocked: false, unassigned: false })}
        >
          Все задачи
        </button>
        <button
          type="button"
          className={clsx(styles.tab, isMine && styles._active)}
          aria-pressed={isMine}
          onClick={() =>
            onChange({ ...filters, assignee: actor, blocked: false, unassigned: false })
          }
        >
          Мои
        </button>
        <button
          type="button"
          className={clsx(styles.tab, filters.blocked && styles._active)}
          aria-pressed={filters.blocked}
          onClick={() => onChange({ ...filters, blocked: true, assignee: "" })}
        >
          Заблокированные
        </button>
      </div>
      <div className={styles.tools}>
        <TextInput
          className={styles.search}
          aria-label="Найти задачу"
          placeholder="Найти задачу…"
          leftSection={<Search size={15} />}
          value={filters.search}
          onChange={(event) => onChange({ ...filters, search: event.currentTarget.value })}
          size="sm"
        />
        <Popover
          opened={isOpen}
          onChange={setOpen}
          position="bottom-end"
          width={290}
          shadow="md"
          trapFocus
        >
          <Popover.Target>
            <Button
              variant="default"
              size="sm"
              leftSection={<ListFilter size={14} />}
              onClick={() => setOpen(!isOpen)}
            >
              {filterLabel}
            </Button>
          </Popover.Target>
          <Popover.Dropdown>
            <Stack gap="sm">
              <Select
                label="Группа"
                placeholder="Все группы"
                clearable
                searchable
                data={board?.groups ?? []}
                value={filters.group || null}
                onChange={(group) => onChange({ ...filters, group: group ?? "" })}
              />
              <Select
                label="Исполнитель"
                placeholder="Все исполнители"
                clearable
                searchable
                data={board?.assignees ?? []}
                value={filters.assignee || null}
                onChange={(assignee) =>
                  onChange({ ...filters, assignee: assignee ?? "", unassigned: false })
                }
              />
              <Select
                label="Тег"
                placeholder="Все теги"
                clearable
                searchable
                data={board?.tags ?? []}
                value={filters.tag || null}
                onChange={(tag) => onChange({ ...filters, tag: tag ?? "" })}
              />
              <Checkbox
                label="Без исполнителя"
                checked={filters.unassigned}
                onChange={(event) =>
                  onChange({ ...filters, unassigned: event.currentTarget.checked, assignee: "" })
                }
              />
              <Checkbox
                label="Есть блокирующие зависимости"
                checked={filters.blocked}
                onChange={(event) => onChange({ ...filters, blocked: event.currentTarget.checked })}
              />
              <Button variant="light" onClick={() => setOpen(false)}>
                Готово
              </Button>
            </Stack>
          </Popover.Dropdown>
        </Popover>
        {hasFilters && (
          <ActionIcon
            aria-label="Сбросить фильтры"
            onClick={() => onChange(BOARD_FILTERS_SCHEMA.parse({}))}
          >
            <X size={15} />
          </ActionIcon>
        )}
        <span className={styles.total}>{totalLabel}</span>
      </div>
      {hasFilters && (
        <div className={styles.activeFilters} aria-label="Активные фильтры">
          {[
            filters.group && `Группа: ${filters.group}`,
            filters.assignee && `Исполнитель: ${filters.assignee}`,
            filters.tag && `Тег: ${filters.tag}`,
            filters.blocked && "Заблокированные",
            filters.unassigned && "Без исполнителя",
          ]
            .filter(Boolean)
            .map((label) => (
              <span key={String(label)}>{label}</span>
            ))}
        </div>
      )}
    </div>
  );
};
