import { useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { Button, TextInput } from "@mantine/core";
import { Plus, Rocket, Search } from "lucide-react";
import { isEmptyArray } from "shared/value-predicates";
import { ReleaseCard } from "./ui/release-card/release-card";
import type { ReleaseCatalogProps } from "./types/release-catalog-props.type";
import styles from "./styles/release-catalog.module.css";

/**
 * Показывает будущие и состоявшиеся выпуски отдельно от планирования работ.
 *
 * Используется для:
 *  - выбора релиза по версии, статусу и готовности его состава
 */
export const ReleaseCatalog = (props: ReleaseCatalogProps) => {
  const { releases, work, basePath, onCreate } = props;
  const [searchParams, setSearchParams] = useSearchParams();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const query = searchParams.get("q") ?? "";
  const status = searchParams.get("status") ?? "all";
  const limit = Math.max(12, Number(searchParams.get("limit")) || 12);
  const filterItems = [
    { value: "all", label: "Все релизы", count: releases.length },
    {
      value: "planned",
      label: "Запланированные",
      count: releases.filter((release) => release.status === "planned").length,
    },
    {
      value: "released",
      label: "Выпущенные",
      count: releases.filter((release) => release.status === "released").length,
    },
    {
      value: "cancelled",
      label: "Отменённые",
      count: releases.filter((release) => release.status === "cancelled").length,
    },
  ];
  const matchedItems = releases.filter(
    (release) =>
      (status === "all" || release.status === status) &&
      `${release.title} ${release.version} ${release.key}`
        .toLocaleLowerCase("ru")
        .includes(query.toLocaleLowerCase("ru")),
  );
  const releaseItems = matchedItems.slice(0, limit);
  const isEmpty = isEmptyArray(releaseItems);
  const hasFilters = query !== "" || status !== "all";
  const hasMore = matchedItems.length > limit;
  const emptyTitle = hasFilters ? "Релизы не найдены" : "Запланируйте первый выпуск";
  const emptyDescription = hasFilters
    ? "Измените запрос или сбросьте фильтры."
    : "Выберите планы работ, которые войдут в релиз. Они могут ещё выполняться.";
  const emptyAction = hasFilters ? "Сбросить фильтры" : "Создать релиз";

  useEffect(() => {
    document.title = "Релизы · Relay";
    headingRef.current?.focus({ preventScroll: true });
  }, []);

  /**
   * Сохраняет поиск, статус и продолжение в URL каталога.
   */
  const handleFilter = (name: string, value: string) =>
    setSearchParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        if (value === "" || value === "all") next.delete(name);
        else next.set(name, value);
        if (name !== "limit") next.delete("limit");
        return next;
      },
      { replace: name === "q" },
    );

  return (
    <div className={styles.root}>
      <header className={styles.heading}>
        <div>
          <h1 ref={headingRef} tabIndex={-1} className={styles.title}>
            Релизы
          </h1>
          <p className={styles.subtitle}>Соберите планы в выпуск и запланируйте его заранее.</p>
        </div>
        <Button leftSection={<Plus size={15} />} onClick={onCreate}>
          Создать релиз
        </Button>
      </header>
      <div className={styles.filters} role="group" aria-label="Статус релиза">
        {filterItems.map((filter) => (
          <button
            key={filter.value}
            type="button"
            className={styles.filter}
            aria-pressed={status === filter.value}
            onClick={() => handleFilter("status", filter.value)}
          >
            {filter.label}
            <span>{filter.count}</span>
          </button>
        ))}
      </div>
      <div className={styles.toolbar}>
        <TextInput
          className={styles.search}
          aria-label="Поиск релизов"
          placeholder="Название, версия или ключ"
          leftSection={<Search size={14} />}
          value={query}
          onChange={(event) => handleFilter("q", event.currentTarget.value)}
        />
        <span className={styles.count} role="status">
          Найдено: {matchedItems.length}
        </span>
      </div>
      {isEmpty && (
        <div className={styles.empty}>
          <Rocket size={30} strokeWidth={1.4} />
          <h2>{emptyTitle}</h2>
          <p>{emptyDescription}</p>
          <Button
            variant="default"
            onClick={() => {
              if (hasFilters) setSearchParams({});
              else onCreate();
            }}
          >
            {emptyAction}
          </Button>
        </div>
      )}
      <div className={styles.grid}>
        {releaseItems.map((release) => (
          <ReleaseCard key={release.id} release={release} work={work} basePath={basePath} />
        ))}
      </div>
      {hasMore && (
        <Button
          variant="default"
          className={styles.more}
          onClick={() => handleFilter("limit", String(limit + 12))}
        >
          Показать ещё · {releaseItems.length} из {matchedItems.length}
        </Button>
      )}
    </div>
  );
};
