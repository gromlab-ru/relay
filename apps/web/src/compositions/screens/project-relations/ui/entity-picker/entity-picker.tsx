import { useState } from "react";
import { Button, Select, Stack, Text } from "@mantine/core";
import type { ComboboxItem } from "@mantine/core";
import { useDebouncedValue } from "@mantine/hooks";
import { relationAddress, useRelations } from "domains/relations";
import type { EntityPickerProps } from "./types/entity-picker-props.type";

/**
 * Выбирает сущность проекта по названию, ключу или адресу.
 *
 * Используется для:
 *  - ввода начала и конца связи и корня контекста
 */
export const EntityPicker = (props: EntityPickerProps) => {
  const { projectId, value, defaultValue, onChange, ...fieldProps } = props;
  const [localValue, setLocalValue] = useState<string | null>(defaultValue ?? null);
  const [selectedOption, setSelectedOption] = useState<ComboboxItem | null>(null);
  const [search, setSearch] = useState("");
  const [debouncedSearch] = useDebouncedValue(search, 200);
  const [page, setPage] = useState({ offset: 0, version: undefined as string | undefined });
  const response = useRelations(projectId, { q: debouncedSearch, limit: 40, ...page });
  const selected = value === undefined ? localValue : value;
  const selection = useRelations(
    projectId,
    selected ? { root: selected, depth: 0, limit: 1 } : null,
  );
  const selectedNode = selection.data?.nodes[0];
  const selectedLabel = selectedNode
    ? `${selectedNode.key} · ${selectedNode.title} (${selectedNode.ref.kind})`
    : selected;
  const optionsData = (response.data?.nodes ?? []).map((node) => ({
    value: relationAddress(node.ref),
    label: `${node.key} · ${node.title} (${node.ref.kind})`,
  }));
  if (selected && !optionsData.some((option) => option.value === selected))
    optionsData.unshift({
      value: selected,
      label:
        selectedOption?.value === selected ? selectedOption.label : (selectedLabel ?? selected),
    });
  const nextOffset = response.data?.nextOffset;
  const hasMore =
    nextOffset !== undefined &&
    nextOffset !== null &&
    (response.data?.totalNodes ?? 0) > page.offset + 40;
  const hasError = response.error !== undefined;
  /** Сбрасывает продолжение при изменении серверного поиска. */
  const handleSearch = (text: string): void => {
    setSearch(text);
    setPage({ offset: 0, version: undefined });
  };
  return (
    <Stack gap={4}>
      <Select
        {...fieldProps}
        searchable
        clearable
        data={optionsData}
        value={selected}
        searchValue={search}
        onSearchChange={handleSearch}
        nothingFoundMessage="Сущностей не найдено"
        filter={({ options }) => options}
        onChange={(address, option) => {
          setLocalValue(address);
          setSelectedOption(option);
          onChange?.(address, option);
        }}
      />
      {hasError && (
        <Text size="xs" c="red" role="alert">
          {response.error?.message}
        </Text>
      )}
      {hasMore && (
        <Button
          size="compact-xs"
          variant="subtle"
          onClick={() => setPage({ offset: nextOffset, version: response.data?.version })}
        >
          Следующая страница вариантов
        </Button>
      )}
    </Stack>
  );
};
