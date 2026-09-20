import clsx from "clsx";
import { useState } from "react";
import { Alert, Anchor, Button, MultiSelect, SegmentedControl, Stack, Text } from "@mantine/core";
import { useDebouncedValue } from "@mantine/hooks";
import { Link } from "react-router-dom";
import { useProjectId, useProjectBasePath } from "domains/project";
import {
  useProductEntities,
  useProductTargetSearch,
  ProductKey,
  productEntityPath,
} from "domains/product";
import type { ProductTargetLink } from "domains/product";
import { isEmptyArray } from "shared/value-predicates";
import type { ProductLinksProps } from "./types/product-links-props.type";
import styles from "./styles/product-links.module.css";

/**
 * Выбирает и показывает постоянные продуктовые цели планов и этапов.
 *
 * Используется для:
 *  - поиска по читаемым ключам без загрузки полного продукта
 */
export const ProductLinks = (props: ProductLinksProps) => {
  const { value, onChange, className, ...rootAttrs } = props;
  const projectId = useProjectId();
  const base = useProjectBasePath();
  const [kind, setKind] = useState<ProductTargetLink["kind"]>("feature");
  const [search, setSearch] = useState("");
  const [debounced] = useDebouncedValue(search, 200);
  const linked = useProductEntities(
    projectId,
    isEmptyArray(value) ? null : { refs: value.map((entry) => entry.id), limit: 100 },
  );
  const candidates = useProductTargetSearch(
    projectId,
    onChange === undefined ? null : { kind, q: debounced, active: "true" },
  );
  const entries = [
    ...new Map(
      [...(linked.data?.items ?? []), ...candidates.items].map((entry) => [entry.id, entry]),
    ).values(),
  ];
  const optionItems = entries.map((entry) => ({
    value: entry.id,
    label: `${entry.key ?? entry.id} · ${entry.title}`,
    disabled: !entry.active,
  }));
  const linkItems = value.map((link) => {
    const entry = entries.find((item) => item.id === link.id);
    return {
      ...link,
      key: entry?.key,
      title: entry?.title ?? link.id,
      href: `${base}/product${productEntityPath(entry ?? link)}`,
    };
  });
  const isEditable = onChange !== undefined;
  const hasError = linked.error !== undefined || candidates.error !== undefined;
  const handleChange = (ids: string[]) => {
    const links: ProductTargetLink[] = ids.flatMap((id) => {
      const existing = value.find((entry) => entry.id === id);
      if (existing !== undefined) return [existing];
      const entry = entries.find((item) => item.id === id);
      if (
        entry === undefined ||
        (entry.kind !== "feature" && entry.kind !== "scenario" && entry.kind !== "implementation")
      )
        return [];
      return [{ id: entry.id, kind: entry.kind }];
    });
    onChange?.(links);
  };
  return (
    <div {...rootAttrs} className={clsx(styles.root, className)}>
      <Stack gap="xs">
        <Text size="sm" fw={600}>
          Продуктовые цели
        </Text>
        {isEditable && (
          <>
            <SegmentedControl
              value={kind}
              onChange={(next) => setKind(next as ProductTargetLink["kind"])}
              data={[
                { value: "feature", label: "Фичи" },
                { value: "scenario", label: "Сценарии" },
                { value: "implementation", label: "Реализации" },
              ]}
            />
            <MultiSelect
              label="Связи с продуктом"
              placeholder="Введите ключ или название"
              searchable
              searchValue={search}
              onSearchChange={setSearch}
              value={value.map((entry) => entry.id)}
              data={optionItems}
              onChange={handleChange}
              filter={({ options }) => options}
              maxValues={100}
              nothingFoundMessage="Целей не найдено"
              clearable
            />
            {candidates.hasMore && (
              <Button
                variant="subtle"
                size="xs"
                onClick={() => void candidates.setSize(candidates.size + 1)}
              >
                Показать ещё цели
              </Button>
            )}
          </>
        )}
        {hasError && (
          <Alert color="red">
            Не удалось загрузить продуктовые цели.{" "}
            <Button
              variant="subtle"
              onClick={() => {
                void linked.mutate();
                void candidates.mutate();
              }}
            >
              Повторить
            </Button>
          </Alert>
        )}
        {linkItems.map((entry) => (
          <Anchor
            component={Link}
            to={entry.href}
            key={entry.id}
            c="var(--mantine-color-text)"
            size="sm"
          >
            <ProductKey value={entry.key} /> · {entry.title}
          </Anchor>
        ))}
      </Stack>
    </div>
  );
};
