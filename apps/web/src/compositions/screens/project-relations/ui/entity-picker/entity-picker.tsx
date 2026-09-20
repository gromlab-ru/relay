import { useState } from "react";
import { Button, Select, Stack, Text } from "@mantine/core";
import type { ComboboxItem } from "@mantine/core";
import { useDebouncedValue } from "@mantine/hooks";
import { relationAddress } from "domains/relations";
import { useEntities, useEntitySummary, entityKindLabel } from "domains/entities";
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
  const [page, setPage] = useState({ offset: 0, version: undefined as string | undefined });
  const selected = value === undefined ? localValue : value;
  const selection = useEntitySummary(projectId, selected === "" ? null : selected);
  const selectedNode = selection.data;
  const selectedAddress = selectedNode ? relationAddress(selectedNode.ref) : selected;
  const selectedLabel = selectedNode
    ? `${selectedNode.key} · ${selectedNode.title} (${entityKindLabel(selectedNode.ref.kind)})`
    : selectedOption?.value === selected
      ? selectedOption.label
      : selected;
  const [debouncedSearch] = useDebouncedValue(search === selectedLabel ? "" : search, 200);
  const response = useEntities(projectId, { q: debouncedSearch, limit: 40, ...page });
  const optionsData = (response.data?.items ?? []).map((node) => ({
    value: relationAddress(node.ref),
    label: `${node.key} · ${node.title} (${entityKindLabel(node.ref.kind)})`,
  }));
  if (selectedAddress && !optionsData.some((option) => option.value === selectedAddress))
    optionsData.unshift({
      value: selectedAddress,
      label: selectedLabel ?? selectedAddress,
    });
  const nextOffset = response.data?.nextOffset;
  const hasMore =
    nextOffset !== undefined &&
    nextOffset !== null &&
    (response.data?.total ?? 0) > page.offset + 40;
  const errorMessage = response.error?.message ?? selection.error?.message;
  const hasError = errorMessage !== undefined;
  const emptyMessage = response.isLoading ? "Загружаем сущности…" : "Сущностей не найдено";
  /** Сбрасывает продолжение при изменении серверного поиска. */
  const handleSearch = (text: string): void => {
    setSearch(text);
    setPage({ offset: 0, version: undefined });
  };
  /** Начинает новую страницу после ошибки сети или изменения снимка, сохраняя выбор. */
  const handleRefresh = (): void => {
    setPage({ offset: 0, version: undefined });
    void response.mutate().catch(() => undefined);
    void selection.mutate().catch(() => undefined);
  };
  return (
    <Stack gap={4}>
      <Select
        {...fieldProps}
        searchable
        clearable
        data={optionsData}
        value={selectedAddress}
        searchValue={search}
        onSearchChange={handleSearch}
        nothingFoundMessage={emptyMessage}
        filter={({ options }) => options}
        onChange={(address, option) => {
          setLocalValue(address);
          setSelectedOption(option);
          onChange?.(address, option);
        }}
      />
      {hasError && (
        <Stack gap={4}>
          <Text size="xs" c="red" role="alert">
            {errorMessage}
          </Text>
          <Button size="compact-xs" variant="subtle" onClick={handleRefresh}>
            Обновить варианты
          </Button>
        </Stack>
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
