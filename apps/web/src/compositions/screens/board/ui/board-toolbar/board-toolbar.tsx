import clsx from "clsx";
import { useState } from "react";
import { ActionIcon, Button, Checkbox, Popover, Select, Stack, TextInput } from "@mantine/core";
import { ListFilter, Search, X } from "lucide-react";
import { BOARD_FILTERS_SCHEMA } from "domains/tasks";
import { isRecordOf, statusLabel, useLifecycle } from "domains/lifecycle";
import { isNonEmptyArray } from "shared/value-predicates";
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
  const lifecycle = useLifecycle();
  const planItems =
    lifecycle.data?.records
      .filter((record) => isRecordOf(record, "plan"))
      .map((record) => ({ value: record.id, label: record.fields.title })) ?? [];
  const stageItems =
    lifecycle.data?.records
      .filter(
        (record) =>
          isRecordOf(record, "stage") &&
          (filters.planId === "" || record.fields.planId === filters.planId),
      )
      .map((record) => ({ value: record.id, label: record.fields.title })) ?? [];
  const typeItems = ["task", "feature", "bug", "research", "debt"].map((value) => ({
    value,
    label: statusLabel(value),
  }));
  const count = [
    filters.assignee,
    filters.tag,
    filters.blocked,
    filters.unassigned,
    filters.planId,
    filters.stageId,
    filters.type,
  ].filter(Boolean).length;
  const hasFilters = count > 0 || filters.search !== "";
  const isMine = filters.assignee === actor;
  const mineAssignee = isMine ? "" : actor;
  const filterLabel = count > 0 ? `Фильтры · ${count}` : "Фильтры";
  const totalLabel = board === undefined ? "Загружаем…" : `Задач: ${board.total}`;
  const activeFilterItems = [
    filters.planId &&
      `План: ${planItems.find((plan) => plan.value === filters.planId)?.label ?? filters.planId}`,
    filters.stageId &&
      `Этап: ${stageItems.find((stage) => stage.value === filters.stageId)?.label ?? filters.stageId}`,
    filters.type && `Вид: ${statusLabel(filters.type)}`,
    filters.assignee && `Исполнитель: ${filters.assignee}`,
    filters.tag && `Тег: ${filters.tag}`,
    filters.blocked && "Заблокированные",
    filters.unassigned && "Без исполнителя",
  ]
    .filter(Boolean)
    .map(String);
  const hasActiveFilters = isNonEmptyArray(activeFilterItems);
  return (
    <div {...rootAttrs} className={clsx(styles.root, className)}>
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
        <Select
          aria-label="План на доске"
          placeholder="Все планы"
          clearable
          searchable
          data={planItems}
          value={filters.planId || null}
          onChange={(planId) => onChange({ ...filters, planId: planId ?? "", stageId: "" })}
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
                label="Этап плана"
                placeholder="Все этапы"
                clearable
                searchable
                data={stageItems}
                value={filters.stageId || null}
                onChange={(stageId) => onChange({ ...filters, stageId: stageId ?? "" })}
              />
              <Select
                label="Вид работы"
                placeholder="Все задачи"
                clearable
                data={typeItems}
                value={filters.type || null}
                onChange={(type) =>
                  onChange(BOARD_FILTERS_SCHEMA.parse({ ...filters, type: type ?? "" }))
                }
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
                label="Назначены мне"
                checked={isMine}
                onChange={() =>
                  onChange({
                    ...filters,
                    assignee: mineAssignee,
                    unassigned: false,
                  })
                }
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
            onClick={() =>
              onChange(
                BOARD_FILTERS_SCHEMA.parse({ group: filters.group, ungrouped: filters.ungrouped }),
              )
            }
          >
            <X size={15} />
          </ActionIcon>
        )}
        <span className={styles.total}>{totalLabel}</span>
      </div>
      {hasActiveFilters && (
        <div className={styles.activeFilters} role="group" aria-label="Активные фильтры">
          {activeFilterItems.map((label) => (
            <span key={label}>{label}</span>
          ))}
        </div>
      )}
    </div>
  );
};
