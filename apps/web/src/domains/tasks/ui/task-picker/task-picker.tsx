import clsx from "clsx";
import { useState } from "react";
import { MultiSelect } from "@mantine/core";
import { useDebouncedValue } from "@mantine/hooks";
import { useGetBoard } from "../../hooks/use-get-board/use-get-board.hook";
import type { TaskPickerProps } from "./types/task-picker-props.type";
import styles from "./styles/task-picker.module.css";

/**
 * Находит задачи по ID и тексту для выбора родительства и зависимостей.
 *
 * Используется для:
 *  - редактирования связей с читаемыми названиями
 */
export const TaskPicker = (props: TaskPickerProps) => {
  const {
    label,
    value,
    onChange,
    known = [],
    excludeId,
    single,
    disabled,
    className,
    ...rootAttrs
  } = props;
  const [search, setSearch] = useState("");
  const [query] = useDebouncedValue(search, 250);
  const board = useGetBoard({ search: query }, undefined, 30);
  const choices = new Map(
    [...known, ...(board.data?.items ?? [])]
      .filter((task) => task.id !== excludeId)
      .map((task) => [
        String(task.id),
        { value: String(task.id), label: `#${task.id} · ${task.title}` },
      ]),
  );
  for (const id of value)
    if (!choices.has(String(id))) choices.set(String(id), { value: String(id), label: `#${id}` });
  const options = [...choices.values()];
  const limit = single ? 1 : undefined;
  const nothingFound = board.isLoading ? "Ищем задачи…" : "Совпадений нет";
  return (
    <div {...rootAttrs} className={clsx(styles.root, className)}>
      <MultiSelect
        label={label}
        placeholder="Найти по названию или ID"
        searchable
        clearable
        data={options}
        value={value.map(String)}
        onChange={(ids) => onChange(ids.map(Number))}
        searchValue={search}
        onSearchChange={setSearch}
        maxValues={limit}
        disabled={disabled}
        nothingFoundMessage={nothingFound}
        filter={({ options: items }) => items}
        error={board.error?.message}
      />
    </div>
  );
};
