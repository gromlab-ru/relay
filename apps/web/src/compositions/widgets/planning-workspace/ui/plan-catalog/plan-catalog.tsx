import { useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { Button, TextInput } from "@mantine/core";
import { Flag, Plus, Search, X } from "lucide-react";
import { isEmptyArray } from "shared/value-predicates";
import { PlanCard } from "./ui/plan-card/plan-card";
import type { PlanCatalogProps } from "./types/plan-catalog-props.type";
import styles from "./styles/plan-catalog.module.css";

/**
 * Показывает планы с их состояниями и позволяет выбрать нужную работу.
 *
 * Используется для:
 *  - поиска и фильтрации планов работ
 *  - открытия плана из общего списка
 */
export const PlanCatalog = (props: PlanCatalogProps) => {
  const { data: demoData, basePath, onCreate } = props;
  const [searchParams, setSearchParams] = useSearchParams();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const title = "Планы";
  const description = "От намерения — к понятному следующему шагу.";
  const createLabel = "Новый план";
  const query = searchParams.get("q") ?? "";
  const state = searchParams.get("status") ?? "all";
  const limit = Math.max(12, Number(searchParams.get("limit")) || 12);
  const catalogItems = demoData.plans;
  const filterItems = [
    { value: "all", label: "Все", count: catalogItems.length },
    {
      value: "active",
      label: "В работе",
      count: catalogItems.filter((plan) => plan.status === "active").length,
    },
    {
      value: "draft",
      label: "Черновики",
      count: catalogItems.filter((plan) => plan.status === "draft").length,
    },
    {
      value: "completed",
      label: "Завершённые",
      count: catalogItems.filter((plan) => plan.status === "completed").length,
    },
    {
      value: "cancelled",
      label: "Отменённые",
      count: catalogItems.filter((plan) => plan.status === "cancelled").length,
    },
  ];
  const matchedItems = catalogItems.filter((plan) => {
    const matchesQuery = `${plan.title} ${plan.key} ${plan.summary}`
      .toLocaleLowerCase("ru")
      .includes(query.toLocaleLowerCase("ru"));
    return matchesQuery && (state === "all" || plan.status === state);
  });
  const planItems = matchedItems.slice(0, limit);
  const hasFilters = query !== "" || state !== "all";
  const isEmpty = isEmptyArray(planItems);
  const hasMore = matchedItems.length > limit;
  const emptyTitle = hasFilters ? "Подходящих планов нет" : "Большие результаты начинаются с плана";
  const emptyDescription = hasFilters
    ? "Попробуйте другой запрос или сбросьте фильтры."
    : "Обозначьте цель, разбейте путь на этапы и выберите существующие задачи.";
  const emptyAction = hasFilters ? "Сбросить фильтры" : createLabel;

  useEffect(() => {
    document.title = `${title} · Relay`;
    headingRef.current?.focus({ preventScroll: true });
  }, [title]);

  /**
   * Сохраняет фильтры в адресе, начиная выдачу с первой порции.
   */
  const handleFilter = (name: string, nextValue: string) => {
    setSearchParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        next.delete("kind");
        if (nextValue === "" || nextValue === "all") next.delete(name);
        else next.set(name, nextValue);
        if (name !== "limit") next.delete("limit");
        return next;
      },
      { replace: name === "q" },
    );
  };

  return (
    <div className={styles.root}>
      <header className={styles.heading}>
        <div>
          <h1 className={styles.title} ref={headingRef} tabIndex={-1}>
            {title}
          </h1>
          <p className={styles.description}>{description}</p>
        </div>
        <Button leftSection={<Plus size={16} />} onClick={onCreate}>
          {createLabel}
        </Button>
      </header>

      <div className={styles.controls}>
        <div className={styles.filters} role="group" aria-label="Состояние плана">
          {filterItems.map((filter) => (
            <button
              key={filter.value}
              className={styles.filter}
              type="button"
              aria-pressed={state === filter.value}
              onClick={() => handleFilter("status", filter.value)}
            >
              {filter.label}
              <span className={styles.count}>{filter.count}</span>
            </button>
          ))}
        </div>
        <div className={styles.searchRow}>
          <TextInput
            className={styles.search}
            leftSection={<Search size={15} />}
            placeholder="Найти план по названию или ключу"
            aria-label="Поиск планов"
            value={query}
            onChange={(event) => handleFilter("q", event.currentTarget.value)}
            rightSection={
              query !== "" && (
                <button
                  type="button"
                  className={styles.clear}
                  aria-label="Очистить поиск"
                  onClick={() => handleFilter("q", "")}
                >
                  <X size={14} />
                </button>
              )
            }
          />
          <span className={styles.resultCount} role="status">
            Найдено: {matchedItems.length}
          </span>
        </div>
      </div>

      {isEmpty && (
        <div className={styles.empty}>
          <span className={styles.emptyIcon}>
            <Flag size={28} strokeWidth={1.4} />
          </span>
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
        {planItems.map((plan) => (
          <PlanCard key={plan.id} plan={plan} tasks={demoData.tasks} basePath={basePath} />
        ))}
      </div>
      {hasMore && (
        <Button
          variant="default"
          className={styles.more}
          onClick={() => handleFilter("limit", String(limit + 12))}
        >
          Показать ещё · {planItems.length} из {matchedItems.length}
        </Button>
      )}
      <footer className={styles.footer}>
        <Flag size={13} aria-hidden="true" />
        <span>План задаёт цель. Этапы делают путь обозримым. Задачи сохраняют свои доски.</span>
      </footer>
    </div>
  );
};
